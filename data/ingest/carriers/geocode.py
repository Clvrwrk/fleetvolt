#!/usr/bin/env python3
"""Cached, throttled, backoff Google geocoding of POLB carrier addresses (P12-09).

Input : data/ingest/carriers/out/polb_carriers.json  (from prep_polb_carriers.py)
Output: data/ingest/carriers/out/carriers_geocoded.json
        = [{carrierKey,name,address,city,state,zip,lat?,lng?,geocodeStatus}]
Cache : data/ingest/carriers/out/geocode_cache.json   (address -> {lat,lng,status})

WHY LOCAL + CACHED (must_haves): geocoding runs here in Python (NOT a Convex
action) with an on-disk cache keyed by the NORMALIZED address, so the ~1,823
geocodes bill ONCE — re-runs read the cache and cost nothing. The cache stores
only addresses + coordinates + status; the API key is NEVER written to it or
logged.

RATE-LIMIT HANDLING (RESEARCH §5 open item): a conservative inter-call throttle
plus exponential backoff on HTTP 429 or Google status OVER_QUERY_LIMIT (retry up
to MAX_RETRIES, then mark FAILED). Failed / zero-result rows are ALWAYS retained
with a geocodeStatus and no location, so downstream counts stay honest (a failed
geocode is still an ingested carrier queryable by corridorCity).

KEY: read from env, trying GOOGLE_GEOCODING_API_KEY, then GOOGLE_MAPS_API_KEY,
then GOOGLE_API_KEY (same Google key family; Geocoding is a server-side call, the
Maps referrer allowlist does not apply). If NO key is present, STOP and flag —
never fabricate coordinates.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "data" / "ingest" / "carriers" / "out"
IN_JSON = OUT_DIR / "polb_carriers.json"
OUT_JSON = OUT_DIR / "carriers_geocoded.json"
CACHE_JSON = OUT_DIR / "geocode_cache.json"

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
THROTTLE_SEC = 0.05           # conservative inter-call sleep (well under 50 QPS)
MAX_RETRIES = 5               # exponential backoff attempts on 429/OVER_QUERY_LIMIT
BACKOFF_BASE_SEC = 1.0
REQUEST_TIMEOUT = 30.0
# Terminal Google statuses that we cache (they will not change on retry).
_TERMINAL_OK = {"OK"}
_TERMINAL_EMPTY = {"ZERO_RESULTS"}
_RETRYABLE = {"OVER_QUERY_LIMIT"}


def _api_key() -> str | None:
    for name in ("GOOGLE_GEOCODING_API_KEY", "GOOGLE_MAPS_API_KEY", "GOOGLE_API_KEY"):
        val = os.environ.get(name)
        if val:
            return val
    return None


def _norm_addr(rec: dict) -> str:
    parts = [rec.get("address"), rec.get("city"), rec.get("state"), rec.get("zip")]
    joined = ", ".join(str(p).strip() for p in parts if p)
    return re.sub(r"\s+", " ", joined).strip()


def _load_cache() -> dict:
    if CACHE_JSON.exists():
        try:
            return json.loads(CACHE_JSON.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print("WARN: cache file corrupt — starting fresh", file=sys.stderr)
    return {}


def _save_cache(cache: dict) -> None:
    CACHE_JSON.write_text(json.dumps(cache, ensure_ascii=False, indent=0), encoding="utf-8")


def _geocode_one(session: requests.Session, address: str, key: str) -> dict:
    """Call the Geocoding API with backoff. Returns {status, lat?, lng?}."""
    for attempt in range(MAX_RETRIES):
        try:
            resp = session.get(
                GEOCODE_URL,
                params={"address": address, "key": key},
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            wait = BACKOFF_BASE_SEC * (2 ** attempt)
            print(f"  net error ({type(exc).__name__}); backoff {wait:.1f}s", file=sys.stderr)
            time.sleep(wait)
            continue

        if resp.status_code == 429:
            wait = BACKOFF_BASE_SEC * (2 ** attempt)
            print(f"  HTTP 429; backoff {wait:.1f}s", file=sys.stderr)
            time.sleep(wait)
            continue
        if resp.status_code != 200:
            wait = BACKOFF_BASE_SEC * (2 ** attempt)
            print(f"  HTTP {resp.status_code}; backoff {wait:.1f}s", file=sys.stderr)
            time.sleep(wait)
            continue

        data = resp.json()
        status = data.get("status", "FAILED")
        if status in _TERMINAL_OK:
            loc = data["results"][0]["geometry"]["location"]
            return {"status": "OK", "lat": loc["lat"], "lng": loc["lng"]}
        if status in _TERMINAL_EMPTY:
            return {"status": "ZERO_RESULTS"}
        if status in _RETRYABLE:
            wait = BACKOFF_BASE_SEC * (2 ** attempt)
            print(f"  OVER_QUERY_LIMIT; backoff {wait:.1f}s", file=sys.stderr)
            time.sleep(wait)
            continue
        # REQUEST_DENIED / INVALID_REQUEST / etc. — non-retryable, key/config issue.
        return {"status": f"FAILED:{status}"}
    return {"status": "FAILED"}


def main() -> None:
    if not IN_JSON.exists():
        sys.exit(f"FATAL: {IN_JSON} not found — run prep_polb_carriers.py first.")
    carriers = json.loads(IN_JSON.read_text(encoding="utf-8"))

    key = _api_key()
    if not key:
        sys.exit(
            "GEOCODE_KEY_MISSING: none of GOOGLE_GEOCODING_API_KEY / "
            "GOOGLE_MAPS_API_KEY / GOOGLE_API_KEY set in env. STOPPING — refusing "
            "to fabricate coordinates. (Flag as deferred in SUMMARY.)"
        )

    cache = _load_cache()
    session = requests.Session()

    # KEY PROBE (fail-fast, honest deferral): a Maps/Geocoding key is `AIza…`.
    # If the provided key is a different Google key family (e.g. GenAI/Gemini
    # `AQ.…`) or lacks the Geocoding API / is referrer-restricted, Google returns
    # REQUEST_DENIED. Rather than bill/spam 1,823 denied calls, probe once with a
    # known-good address. On denial we DEFER: emit every row with geocodeStatus
    # (no location) so the carriers still ingest and corridor-city density works,
    # and flag the spatial half as pending a valid-key re-run. Never fabricate.
    probe = _geocode_one(session, "1 World Way, Los Angeles, CA 90045", key)
    key_usable = probe.get("status") == "OK"
    if not key_usable:
        reason = probe.get("status", "FAILED")
        print(
            f"GEOCODE_DEFERRED: probe returned {reason} — the provided key is not a "
            "usable Maps/Geocoding key (Geocoding keys are 'AIza…'; a GenAI/Gemini "
            "'AQ.…' key or a referrer-restricted/disabled key is rejected). "
            "Emitting all carriers with geocodeStatus=FAILED (no coordinates). "
            "Re-run with a valid Geocoding key to backfill locations + spatial index.",
            file=sys.stderr,
        )

    out = []
    counts = {"OK": 0, "ZERO_RESULTS": 0, "FAILED": 0}
    api_calls = 0
    cache_hits = 0
    for i, rec in enumerate(carriers):
        addr = _norm_addr(rec)
        row = {
            "carrierKey": rec["carrierKey"],
            "name": rec["name"],
            "address": rec.get("address"),
            "city": rec.get("city"),
            "state": rec.get("state"),
            "zip": rec.get("zip"),
        }
        if not addr:
            row["geocodeStatus"] = "ZERO_RESULTS"
            counts["ZERO_RESULTS"] += 1
            out.append(row)
            continue

        cached = cache.get(addr)
        if cached is None:
            if not key_usable:
                # Deferred: do not call the API (key unusable). Mark FAILED, no coords.
                cached = {"status": "FAILED"}
            else:
                time.sleep(THROTTLE_SEC)
                cached = _geocode_one(session, addr, key)
                cache[addr] = cached
                api_calls += 1
                # periodic cache flush so a mid-run crash keeps prior progress (no re-bill)
                if api_calls % 100 == 0:
                    _save_cache(cache)
                    print(f"  ... {i + 1}/{len(carriers)} rows, {api_calls} api calls")
        else:
            cache_hits += 1

        status = cached.get("status", "FAILED")
        if status == "OK":
            row["lat"] = cached["lat"]
            row["lng"] = cached["lng"]
            row["geocodeStatus"] = "OK"
            counts["OK"] += 1
        elif status == "ZERO_RESULTS":
            row["geocodeStatus"] = "ZERO_RESULTS"
            counts["ZERO_RESULTS"] += 1
        else:
            row["geocodeStatus"] = "FAILED"
            counts["FAILED"] += 1
        out.append(row)

    _save_cache(cache)
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    total = len(out)
    ok = counts["OK"]
    print("---- POLB carrier geocoding ----")
    print(f"total carriers        : {total}")
    print(f"api calls (billed)    : {api_calls}")
    print(f"cache hits (free)     : {cache_hits}")
    print(f"geocodeStatus OK      : {ok}  ({100 * ok / total:.1f}%)")
    print(f"geocodeStatus ZERO    : {counts['ZERO_RESULTS']}")
    print(f"geocodeStatus FAILED  : {counts['FAILED']}")
    print(f"wrote {OUT_JSON.relative_to(ROOT)} (+ cache {CACHE_JSON.name})")


if __name__ == "__main__":
    main()
