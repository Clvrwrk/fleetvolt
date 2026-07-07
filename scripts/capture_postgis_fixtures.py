#!/usr/bin/env python3
"""Capture LIVE PostGIS charger-near ground truth for the P12-05 parity gate.

This is CAPTURED GROUND TRUTH, not hand-authored fixtures. For each corridor
probe point it hits the SAME ST_DWithin / ST_Distance query the app uses — via
the simulator's GET /v1/chargers/near endpoint (services/simulator/app/routes/
chargers.py) — and writes apps/web/convex/fixtures/postgis-nearest.json.

REGENERATE after a live charger ingest (12-04): the fixtures reflect whatever is
currently in the docker PostGIS `chargers` table.

FAILS LOUDLY (exit 1, no file written) if the stack/table is unreachable or the
probes return zero rows across the board — it NEVER fabricates a fixture. Bring
the stack up with:

    docker compose up -d postgres simulator

Usage:
    python3 scripts/capture_postgis_fixtures.py
    SIM_BASE_URL=http://localhost:8000 python3 scripts/capture_postgis_fixtures.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Corridor probe points (FLAGSHIP / route_provider.py).
PROBES = [
    {"name": "POLB_ORIGIN", "lat": 33.754, "lon": -118.216},
    {"name": "SAN_BERNARDINO_DEST", "lat": 34.108, "lon": -117.290},
    {"name": "CAJON_PASS_DEST", "lat": 34.280, "lon": -117.470},
]

RADIUS_M = 8047  # 5 miles — the flagship detour radius

SIM_BASE_URL = os.environ.get("SIM_BASE_URL", "http://localhost:8000")

# repo root = two levels up from this script (scripts/ -> repo root)
REPO_ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = REPO_ROOT / "apps" / "web" / "convex" / "fixtures" / "postgis-nearest.json"


def fetch_near(lat: float, lon: float, radius_m: float, hd_only: bool) -> list[dict]:
    """Call GET /v1/chargers/near (the ST_DWithin/ST_Distance query)."""
    url = (
        f"{SIM_BASE_URL}/v1/chargers/near"
        f"?lat={lat}&lon={lon}&radius_m={radius_m}"
        f"&hd_only={'true' if hd_only else 'false'}"
    )
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        die(
            f"Could not reach the simulator at {url}: {exc}\n"
            "Bring the stack up first:\n"
            "    docker compose up -d postgres simulator"
        )
    return []  # unreachable; die() exits


def die(msg: str) -> None:
    print(f"FIXTURE CAPTURE FAILED: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    fixtures: list[dict] = []
    total_rows = 0

    for probe in PROBES:
        rows = fetch_near(probe["lat"], probe["lon"], RADIUS_M, hd_only=False)
        # hd_only pass so downstream can assert the class8 subset too
        hd_rows = fetch_near(probe["lat"], probe["lon"], RADIUS_M, hd_only=True)
        hd_ids = {r["station_id"] for r in hd_rows}

        norm = sorted(
            (
                {
                    "station_id": r["station_id"],
                    "name": r.get("name"),
                    "power_kw": float(r["power_kw"]),
                    "hd_capable": bool(r["hd_capable"]),
                    "distance_m": float(r["distance_m"]),
                }
                for r in rows
            ),
            key=lambda r: r["distance_m"],
        )
        total_rows += len(norm)
        fixtures.append(
            {
                "probe": {"name": probe["name"], "lat": probe["lat"], "lon": probe["lon"]},
                "radiusM": RADIUS_M,
                "rows": norm,
                "hdStationIds": sorted(hd_ids),
            }
        )
        print(f"  {probe['name']}: {len(norm)} rows (hd: {len(hd_ids)})")

    if total_rows == 0:
        die(
            "all probes returned 0 rows — the chargers table is empty or the "
            "query is not matching. Refusing to write an empty/fabricated fixture.\n"
            "Verify: docker compose exec postgres psql -U fleetvolt -d fleetvolt "
            "-c 'SELECT count(*) FROM chargers;'"
        )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(fixtures, indent=2) + "\n")
    print(
        f"Wrote {len(fixtures)} probes / {total_rows} total rows to {OUT_PATH} "
        f"(source: {SIM_BASE_URL} ST_DWithin/ST_Distance @ {RADIUS_M}m)"
    )


if __name__ == "__main__":
    main()
