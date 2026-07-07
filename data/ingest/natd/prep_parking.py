#!/usr/bin/env python3
"""Prep NATD truck-stop parking (P12-06 item 6) -> Convex `parking` point rows.

Reads the NATD truck-stop parking GeoJSON (data/raw/NATD/NTAD_Truck_Stop_Parking_*.geojson),
filters to California, and emits data/ingest/natd/out/natd_parking.json:
    [{parkingKey, name, lat, lng, numberOfSpots, hgv:true}]

`number_of_spots` is the P12-12 capacity PROXY the 12-08 hotspot score consumes.
Truck-stop parking is HGV by definition, so hgv is set true for every row.
parkingKey = stable md5(name|lat|lng) so re-runs upsert idempotently.

The spots column in the NATD truck-stop parking GeoJSON is `number_of_spots`
(an integer count of truck parking spaces at the site). We fail LOUDLY (print
the property keys and exit non-zero) if that column cannot be found, rather than
emit rows without the capacity proxy.

Also emits (lightweight enrichment, P12-06 alt-fuel) data/ingest/natd/out/natd_altfuel.json
from NTAD_Alternative_Fuel_Corridors_*.csv: [{name, ...any coords}] — corridor
signage names only; the core deliverable is parking capacity, alt-fuel is a note.

Run (isolated venv, per the executor env note):
    env -i HOME="$HOME" PATH="/usr/bin:/bin" .venv/bin/python data/ingest/natd/prep_parking.py
"""
import csv
import glob
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
RAW_DIR = os.path.join(REPO, "data", "raw", "NATD")
OUT_DIR = os.path.join(HERE, "out")

# California bounding box (fallback if the `state` property is absent).
CA_BBOX = {"minLat": 32.5, "minLng": -124.5, "maxLat": 42.1, "maxLng": -114.1}

# Candidate spots/capacity column names, most-specific first.
SPOTS_COLUMNS = [
    "number_of_spots",
    "TRUCK_PARKING_SPACES",
    "truck_parking_spaces",
    "SPACES",
    "spaces",
    "num_spaces",
    "capacity",
]


def find_geojson():
    hits = sorted(glob.glob(os.path.join(RAW_DIR, "NTAD_Truck_Stop_Parking_*.geojson")))
    if not hits:
        sys.exit(f"FATAL: no NTAD_Truck_Stop_Parking_*.geojson under {RAW_DIR}")
    return hits[0]


def find_altfuel_csv():
    hits = sorted(glob.glob(os.path.join(RAW_DIR, "NTAD_Alternative_Fuel_Corridors_*.csv")))
    return hits[0] if hits else None


def parking_key(name, lat, lng):
    h = hashlib.md5(f"{name}|{lat:.6f}|{lng:.6f}".encode()).hexdigest()[:16]
    return f"NATD-{h}"


def in_ca_bbox(lat, lng):
    return (
        CA_BBOX["minLat"] <= lat <= CA_BBOX["maxLat"]
        and CA_BBOX["minLng"] <= lng <= CA_BBOX["maxLng"]
    )


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    gj_path = find_geojson()
    with open(gj_path) as f:
        gj = json.load(f)
    feats = gj.get("features", [])
    if not feats:
        sys.exit(f"FATAL: {gj_path} has zero features")

    props0 = feats[0].get("properties", {})
    print(f"NATD geojson: {os.path.basename(gj_path)}  features={len(feats)}")
    print(f"property keys: {list(props0.keys())}")

    spots_col = next((c for c in SPOTS_COLUMNS if c in props0), None)
    if spots_col is None:
        print("FATAL: could not find a spots/capacity column. Looked for:")
        print(f"  {SPOTS_COLUMNS}")
        print(f"  available: {list(props0.keys())}")
        sys.exit(1)
    print(f"spots column resolved -> '{spots_col}'")

    has_state = "state" in props0

    rows = []
    ca_total = 0
    with_spots = 0
    seen = set()
    for feat in feats:
        p = feat.get("properties", {})
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates")
        if geom.get("type") != "Point" or not coords or len(coords) < 2:
            continue
        lng, lat = float(coords[0]), float(coords[1])

        if has_state:
            if str(p.get("state", "")).strip().upper() != "CA":
                continue
        else:
            if not in_ca_bbox(lat, lng):
                continue
        ca_total += 1

        name = p.get("nhs_rest_stop") or p.get("name") or p.get("municipality") or None
        raw_spots = p.get(spots_col)
        spots = None
        if isinstance(raw_spots, (int, float)):
            spots = int(raw_spots)
        elif isinstance(raw_spots, str) and raw_spots.strip().isdigit():
            spots = int(raw_spots.strip())
        if spots is not None:
            with_spots += 1

        key = parking_key(name or "", lat, lng)
        if key in seen:
            continue
        seen.add(key)
        row = {
            "parkingKey": key,
            "name": name,
            "lat": lat,
            "lng": lng,
            "hgv": True,  # NATD truck-stop parking is HGV by definition
        }
        if spots is not None:
            row["numberOfSpots"] = spots
        rows.append(row)

    out_path = os.path.join(OUT_DIR, "natd_parking.json")
    with open(out_path, "w") as f:
        json.dump(rows, f)
    print(
        f"CA truck-stop parking: {ca_total} matched, {len(rows)} unique rows emitted, "
        f"{with_spots} with numeric numberOfSpots"
    )
    print(f"wrote {out_path}")

    # ── Lightweight alt-fuel corridor enrichment (names only) ──────────────────
    af_path = find_altfuel_csv()
    if af_path:
        af_rows = []
        with open(af_path, newline="") as f:
            reader = csv.DictReader(f)
            cols = reader.fieldnames or []
            name_col = next(
                (c for c in cols if "corridor" in c.lower() or c.lower() in ("name", "route")),
                cols[0] if cols else None,
            )
            state_col = next((c for c in cols if c.lower() in ("state", "state_abbr")), None)
            for r in reader:
                if state_col and str(r.get(state_col, "")).strip().upper() not in ("CA", "CALIFORNIA"):
                    continue
                af_rows.append({"name": r.get(name_col) if name_col else None})
        af_out = os.path.join(OUT_DIR, "natd_altfuel.json")
        with open(af_out, "w") as f:
            json.dump(af_rows, f)
        print(f"alt-fuel corridors (CA enrichment note): {len(af_rows)} rows -> {af_out}")
    else:
        print("alt-fuel corridors csv not found — skipping enrichment note (non-fatal)")


if __name__ == "__main__":
    main()
