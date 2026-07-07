#!/usr/bin/env python3
"""FAF5 freight-out-of-port prep (P12-03).

Two steps, each a CLI subcommand:

  lookups  — parse FAF5_metadata.xlsx (+ CFS<->FAF crosswalk) into
             out/faf_lookups.json = {zones, modes, commodities}
  filter   — STREAM the 695MB FAF5.7.1_2018-2024.csv row-by-row, keep ONLY
             dms_orig == "061" (LA-Long Beach port zone), aggregate by
             (year, dms_dest, dms_mode, sctg2), emit out/faf_zone061.json.

Why a Python prep instead of loading the CSV into Convex directly (RESEARCH
§2/§3): the source is 695MB / 2.6M rows — far past a Convex action's 5MiB arg
cap. We stream-filter to zone 061 and aggregate down to a few-thousand-row
JSON that the Convex action then ingests in ≤5MiB chunks.

CRITICAL: dms_orig/dms_dest/dms_mode/sctg2 are ZERO-PADDED STRINGS ("061").
csv.reader yields them as strings natively, so the =="061" filter is exact.
FAILS LOUDLY if zero rows match 061 (would mean a wrong column / int coercion).

Units (confirmed vs FAF5_metadata.xlsx): tons_<year> = THOUSAND tons (ktons),
value_<year> = MILLIONS of USD (constant-dollar series). current_value_* is the
nominal series and is intentionally NOT loaded.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

# Repo-root-relative paths (this file lives at data/ingest/faf/).
HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
FAF_DIR = REPO_ROOT / "data" / "raw" / "FAF"
CSV_PATH = FAF_DIR / "FAF5.7.1_2018-2024" / "FAF5.7.1_2018-2024.csv"
METADATA_PATH = FAF_DIR / "FAF5.7.1_2018-2024" / "FAF5_metadata.xlsx"
CROSSWALK_PATH = FAF_DIR / "CFS-area-code-FAF5-zone-id.xlsx"
OUT_DIR = HERE / "out"

ZONE_061 = "061"  # LA-Long Beach port zone
YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024]


def build_lookups() -> dict:
    """Parse the metadata workbook (+ crosswalk) into zones/modes/commodities."""
    import openpyxl  # local import so `filter` works without openpyxl

    if not METADATA_PATH.exists():
        raise SystemExit(f"FATAL: metadata workbook missing: {METADATA_PATH}")

    wb = openpyxl.load_workbook(METADATA_PATH, read_only=True, data_only=True)

    def sheet_rows(name: str):
        ws = wb[name]
        rows = list(ws.iter_rows(min_row=2, values_only=True))
        return rows

    # State (crosswalk) enrichment: FAF zone id -> state postal.
    zone_state: dict[str, str] = {}
    if CROSSWALK_PATH.exists():
        cw = openpyxl.load_workbook(CROSSWALK_PATH, read_only=True, data_only=True)
        cws = cw.active
        header = [str(c) for c in next(cws.iter_rows(min_row=1, max_row=1, values_only=True))]
        idx = {h: i for i, h in enumerate(header)}
        for row in cws.iter_rows(min_row=2, values_only=True):
            faf = row[idx["FAF"]]
            st = row[idx["STPOSTAL"]]
            if faf is not None:
                zone_state[str(faf).zfill(3)] = str(st) if st is not None else None
        cw.close()
    else:
        print(f"WARN: crosswalk absent ({CROSSWALK_PATH}); state left null, flagged")

    zones = []
    for label, short_desc, *_rest in sheet_rows("FAF Zone (Domestic)"):
        if label is None:
            continue
        zid = str(label).zfill(3)
        zones.append({"zoneId": zid, "name": str(short_desc), "state": zone_state.get(zid)})
    # Foreign zones (2-column: label, description) — no state.
    for row in sheet_rows("FAF Zone (Foreign)"):
        label, desc = row[0], row[1]
        if label is None:
            continue
        zones.append({"zoneId": str(label).zfill(3), "name": str(desc), "state": None})

    modes = []
    for label, desc in [(r[0], r[1]) for r in sheet_rows("Mode")]:
        if label is None:
            continue
        modes.append({"modeId": str(label), "label": str(desc)})

    commodities = []
    for label, desc in [(r[0], r[1]) for r in sheet_rows("Commodity (SCTG2)")]:
        if label is None:
            continue
        # SCTG2 codes are zero-padded 2-digit strings ("01".."43").
        commodities.append({"sctg2": str(label).zfill(2), "label": str(desc)})

    wb.close()

    if not zones or not modes or not commodities:
        raise SystemExit("FATAL: empty lookups parsed — workbook structure changed")

    return {"zones": zones, "modes": modes, "commodities": commodities}


def cmd_lookups() -> None:
    lk = build_lookups()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "faf_lookups.json"
    out.write_text(json.dumps(lk, indent=0))
    z061 = [z for z in lk["zones"] if z["zoneId"] == ZONE_061]
    print(f"zones={len(lk['zones'])} modes={len(lk['modes'])} commodities={len(lk['commodities'])}")
    print(f"zone 061 -> {z061[0] if z061 else 'MISSING'}")
    if not z061:
        raise SystemExit("FATAL: zone 061 not found in metadata")
    print(f"wrote {out}")


def aggregate_rows(reader) -> dict:
    """PURE reduction: stream csv rows -> {(year,dest,mode,sctg2): {tons,value}}.

    `reader` is an iterable of dict-like rows (csv.DictReader). Mirrors the TS
    unit test's reduction. Only dms_orig=="061" rows contribute.
    """
    acc: dict[tuple, dict] = {}
    matched = 0
    for row in reader:
        if row["dms_orig"] != ZONE_061:
            continue
        matched += 1
        dest = row["dms_dest"]
        mode = row["dms_mode"]
        sctg2 = row["sctg2"]
        for y in YEARS:
            tons = row.get(f"tons_{y}")
            val = row.get(f"value_{y}")
            if tons in (None, "") and val in (None, ""):
                continue
            key = (y, dest, mode, sctg2)
            bucket = acc.setdefault(key, {"tons": 0.0, "value": 0.0})
            bucket["tons"] += float(tons) if tons not in (None, "") else 0.0
            bucket["value"] += float(val) if val not in (None, "") else 0.0
    return {"acc": acc, "matched": matched}


def cmd_filter() -> None:
    if not CSV_PATH.exists():
        raise SystemExit(f"FATAL: CSV missing: {CSV_PATH}")

    with CSV_PATH.open("r", newline="") as fh:
        header = fh.readline().rstrip("\r\n").split(",")
        print(f"CSV header ({len(header)} cols): {header[:12]} ...")
        required = {"dms_orig", "dms_dest", "dms_mode", "sctg2"}
        missing = required - set(header)
        if missing:
            raise SystemExit(f"FATAL: header missing columns {missing}")
        fh.seek(0)
        reader = csv.DictReader(fh)  # streams row-by-row; never loads whole file
        result = aggregate_rows(reader)

    acc, matched = result["acc"], result["matched"]
    if matched == 0:
        raise SystemExit(
            "FATAL: zero rows matched dms_orig=='061' — wrong column or int "
            "coercion. Aborting (would emit fake/empty JSON)."
        )

    out_rows = []
    for (year, dest, mode, sctg2), b in acc.items():
        out_rows.append({
            "year": year,
            "dmsOrig": ZONE_061,
            "dmsDest": dest,
            "dmsMode": mode,
            "sctg2": sctg2,
            "tonsKtons": round(b["tons"], 6),  # THOUSAND tons (ktons)
            "valueUSD": round(b["value"], 6),  # MILLIONS USD
        })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "faf_zone061.json"
    out.write_text(json.dumps(out_rows))

    # ── Sanity line vs RESEARCH-verified zone-061 magnitude (~$1.3T / 395M truck-ktons) ──
    latest = max(YEARS)
    truck_ktons_latest = sum(
        r["tonsKtons"] for r in out_rows if r["dmsMode"] == "1" and r["year"] == latest
    )
    value_latest_all = sum(r["valueUSD"] for r in out_rows if r["year"] == latest)
    value_all_years = sum(r["valueUSD"] for r in out_rows)
    print(f"raw 061 rows matched: {matched}")
    print(f"aggregated rows emitted: {len(out_rows)}")
    print(f"SANITY {latest}: truck(mode=1) tons = {truck_ktons_latest:,.0f} ktons "
          f"(~395M expected)")
    print(f"SANITY {latest}: total value = {value_latest_all:,.0f} millions USD "
          f"= ${value_latest_all/1e6:,.2f}T (~$1.3T expected)")
    print(f"SANITY all-years total value = {value_all_years:,.0f} millions USD")
    print(f"wrote {out} ({out.stat().st_size/1024:.0f} KB)")


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "lookups":
        cmd_lookups()
    elif cmd == "filter":
        cmd_filter()
    else:
        raise SystemExit("usage: prep_faf_zone061.py {lookups|filter}")


if __name__ == "__main__":
    main()
