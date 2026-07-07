#!/usr/bin/env python3
"""Prep CalTrans Truck AADT (P12-06 item 4) -> highwaySegments rows.

Reads data/raw/CalTrans/Truck_Volumes_AADT.geojson (the authoritative export;
6,865 features) and emits data/ingest/caltrans/out/caltrans_segments.json for
the Convex highways ingest (highways/ingest.ts).

## Source shape (verified against the actual bytes, not the catalog)

The CalTrans "Truck Volumes AADT" geojson features are POINT postmiles, NOT
LINESTRINGs. Each feature's `properties` already carries every AADT column we
need, so the Truck__Average_Daily_Traffic.csv (same X/Y/OBJECTID + identical
AADT columns, just in projected State-Plane meters) is REDUNDANT — the geojson
is self-sufficient and already in WGS84 lng/lat. We therefore read the geojson
alone (documented deviation from the plan's "join the csv" wording — the join is
a no-op because the columns are identical and the geojson geometry is already
geographic). If a future export splits geometry from AADT, re-introduce the
OBJECTID join here.

### The axle -> Class-8 mapping (Phase-7 PITFALLS #7 — never conflate)

CalTrans breaks truck AADT out by axle count. The properties are:

  VEHICLE_AADT_TOTAL  total vehicle AADT (all classes)       -> (context only)
  TOT_TRK_AADT        total truck AADT (2+3+4+5-axle trucks)  -> `aadt` (total truck)
  TRK_2_AXLE          2-axle truck AADT
  TRK_3_AXLE          3-axle truck AADT
  TRK_4_AXLE          4-axle truck AADT
  TRK_5_AXLE          >=5-axle truck AADT  ->  **`truckAADT` (Class-8 proxy)**

The 5-axle count (TRK_5_AXLE) is the Class-8 / heavy-combination proxy the
flagship "most congested freight route" ranks on. It is kept STRICTLY DISTINCT
from `aadt`. We populate:

  truckAADT  <- TRK_5_AXLE          (5-axle = Class-8 proxy)
  aadt       <- TOT_TRK_AADT        (total TRUCK AADT — the freight denominator)

NB: `aadt` here is total *truck* AADT (TOT_TRK_AADT), NOT VEHICLE_AADT_TOTAL —
this table is a freight layer, so both fields stay in the truck domain and the
5-axle share is a clean subset of the total. VEHICLE_AADT_TOTAL is intentionally
NOT loaded (it would conflate all-vehicle with truck volumes; PITFALLS #7).

## Geometry

Points, not lines, so there is nothing to Douglas-Peucker simplify. Each
segment's `path` is a single WGS84 vertex [{lat,lng}] and its `bbox` is the
degenerate envelope (min==max) of that vertex. This trivially satisfies the
~1MB Convex doc guard (PITFALLS #11) and remains compatible with the 12-02
line-spatial path (segmentsInBbox uses bbox-intersection; a degenerate bbox is
just a point-in-rectangle test). Documented deviation: the plan assumed
LINESTRINGs; the real export is postmile points.

## Idempotency key

Each feature has a unique OBJECTID (route/postmile/leg can repeat across the two
travel directions), so segmentId = f"CT-{OBJECTID}" is the stable upsert key.
This namespace ("CT-...") cannot collide with any Phase-7 seed segmentId.
"""

import json
import os
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
GEOJSON = os.path.join(REPO, "data", "raw", "CalTrans", "Truck_Volumes_AADT.geojson")
OUT_DIR = os.path.join(HERE, "out")
OUT = os.path.join(OUT_DIR, "caltrans_segments.json")

# The column we treat as the 5-axle Class-8 proxy and the total-truck denominator.
COL_5AXLE = "TRK_5_AXLE"
COL_TOTAL_TRUCK = "TOT_TRK_AADT"
COL_YEAR = "EST_YEAR"  # 2-digit estimate year (e.g. 19 -> 2019)


def num(v):
    """Coerce to a finite number or None (never fabricate a 0)."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f:  # NaN
        return None
    return f


def main() -> int:
    if not os.path.exists(GEOJSON):
        print(f"FATAL: missing {GEOJSON}", file=sys.stderr)
        return 1

    with open(GEOJSON) as fh:
        gj = json.load(fh)
    features = gj.get("features", [])
    if not features:
        print("FATAL: geojson has zero features — refusing to emit.", file=sys.stderr)
        return 1

    props0 = features[0].get("properties", {})
    available = list(props0.keys())
    # FAIL LOUDLY if the 5-axle column can't be identified.
    if COL_5AXLE not in props0:
        print(
            f"FATAL: 5-axle column {COL_5AXLE!r} not found in feature properties.\n"
            f"Available columns: {available}",
            file=sys.stderr,
        )
        return 1
    print(f"[prep] 5-axle Class-8 proxy source column = {COL_5AXLE!r}")
    print(f"[prep] total-truck AADT source column     = {COL_TOTAL_TRUCK!r}")
    print(f"[prep] available property columns: {available}")

    rows = []
    skipped_no_geom = 0
    truck_vals = []
    for feat in features:
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates")
        gtype = geom.get("type")
        if gtype != "Point" or not coords or len(coords) < 2:
            skipped_no_geom += 1
            continue
        lng, lat = float(coords[0]), float(coords[1])
        p = feat.get("properties", {})

        oid = p.get("OBJECTID")
        if oid is None:
            skipped_no_geom += 1
            continue
        segment_id = f"CT-{oid}"

        rte = p.get("RTE")
        route = str(rte) if rte is not None else "UNKNOWN"

        truck_aadt = num(p.get(COL_5AXLE))       # 5-axle = Class-8 proxy
        total_truck = num(p.get(COL_TOTAL_TRUCK))  # total truck AADT
        if truck_aadt is not None:
            truck_vals.append(truck_aadt)

        yr = p.get(COL_YEAR)
        year = None
        if yr is not None:
            try:
                y = int(yr)
                # 2-digit CalTrans estimate year -> 4-digit
                year = 2000 + y if y < 100 else y
            except (TypeError, ValueError):
                year = None

        # Degenerate single-vertex path + bbox (points, not lines).
        path = [{"lat": lat, "lng": lng}]
        bbox = {"minLat": lat, "minLng": lng, "maxLat": lat, "maxLng": lng}

        row = {
            "segmentId": segment_id,
            "route": route,
            "path": path,
            "bbox": bbox,
        }
        if truck_aadt is not None:
            row["truckAADT"] = truck_aadt   # 5-axle Class-8 proxy (DISTINCT from aadt)
        if total_truck is not None:
            row["aadt"] = total_truck       # total TRUCK AADT
        if year is not None:
            row["year"] = year
        rows.append(row)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(rows, fh)

    with_truck = sum(1 for r in rows if r.get("truckAADT") is not None)
    max_truck = max(truck_vals) if truck_vals else None
    med_truck = statistics.median(truck_vals) if truck_vals else None
    print(
        f"[prep] emitted {len(rows)} segments -> {OUT}\n"
        f"[prep]   skipped (no geom/id): {skipped_no_geom}\n"
        f"[prep]   with truckAADT(5-axle): {with_truck}\n"
        f"[prep]   truckAADT max={max_truck} median={med_truck}\n"
        f"[prep]   sample: {rows[0] if rows else None}"
    )
    if len(rows) < 6000:
        print(
            f"WARN: expected ~6,865 segments, got {len(rows)}", file=sys.stderr
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
