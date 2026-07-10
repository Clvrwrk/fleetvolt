#!/usr/bin/env python3
"""Prep CA ZCTA5 polygons from Census TIGER tl_2022_us_zcta520.

Source shapefile (local, no API pull):
  data/raw/Open Data Gov/tl_2022_us_zcta520/tl_2022_us_zcta520.shp

Filters to California by interior point, simplifies geometry for Convex
(doc size budget), and emits bbox + exterior ring for choropleth fill.

Run:
  services/simulator/.venv/bin/python data/ingest/census/prep_ca_zcta.py

Output:
  data/ingest/census/out/ca_zcta.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import shapefile  # pyshp
except ImportError:
    print("Need pyshp: pip install pyshp", file=sys.stderr)
    sys.exit(1)

try:
    from shapely.geometry import Polygon, MultiPolygon, shape as shapely_shape
    from shapely.ops import unary_union
except ImportError:
    print("Need shapely (use services/simulator/.venv)", file=sys.stderr)
    sys.exit(1)

REPO = Path(__file__).resolve().parents[3]
SHP = (
    REPO
    / "data/raw/Open Data Gov/tl_2022_us_zcta520/tl_2022_us_zcta520"
)
OUT_DIR = Path(__file__).resolve().parent / "out"
OUT_FILE = OUT_DIR / "ca_zcta.json"

# Inclusive CA interior-point box (excludes HI / AK / PR).
CA_LAT = (32.40, 42.10)
CA_LNG = (-124.60, -114.00)

# Primary CA ZIP range (excludes NV 89xxx / AZ 85–86 that sit on the box edge).
# Also allow scarce 96xxx north-coast codes.
def is_ca_zcta(zcta: str) -> bool:
    try:
        n = int(zcta)
    except ValueError:
        return False
    return 90001 <= n <= 96162

# ~550 m simplify; then hard-cap vertex count for Convex docs.
SIMPLIFY_TOL = 0.005
MAX_RING_PTS = 48


def in_ca(lat: float, lng: float) -> bool:
    return CA_LAT[0] <= lat <= CA_LAT[1] and CA_LNG[0] <= lng <= CA_LNG[1]


def exterior_ring(geom) -> list[tuple[float, float]]:
    """Largest exterior ring as (lng, lat) pairs (closed)."""
    if geom.is_empty:
        return []
    if isinstance(geom, MultiPolygon):
        geom = max(geom.geoms, key=lambda g: g.area)
    if not isinstance(geom, Polygon):
        return []
    coords = list(geom.exterior.coords)
    return [(float(x), float(y)) for x, y in coords]


def simplify_ring(coords: list[tuple[float, float]]) -> list[dict[str, float]]:
    if len(coords) < 4:
        return []
    poly = Polygon(coords)
    if not poly.is_valid:
        poly = poly.buffer(0)
    simplify = poly.simplify(SIMPLIFY_TOL, preserve_topology=True)
    ring = exterior_ring(simplify)
    if len(ring) < 4:
        ring = exterior_ring(poly)
    # Drop closing duplicate for storage, then re-cap.
    if len(ring) >= 2 and ring[0] == ring[-1]:
        ring = ring[:-1]
    if len(ring) > MAX_RING_PTS:
        step = max(1, len(ring) // MAX_RING_PTS)
        ring = ring[::step][:MAX_RING_PTS]
    # Ensure closed for Google Maps Polygon path consumers if they need it —
    # we store open rings; UI closes.
    return [{"lat": lat, "lng": lng} for lng, lat in ring]


def main() -> int:
    if not SHP.with_suffix(".shp").exists():
        print(f"Missing shapefile: {SHP}.shp", file=sys.stderr)
        return 1

    reader = shapefile.Reader(str(SHP))
    fields = [f[0] for f in reader.fields[1:]]
    zi = fields.index("ZCTA5CE20")
    lati = fields.index("INTPTLAT20")
    lngi = fields.index("INTPTLON20")

    rows: list[dict] = []
    skipped = 0
    for sr in reader.iterShapeRecords():
        rec = sr.record
        zcta = str(rec[zi]).strip()
        lat = float(rec[lati])
        lng = float(rec[lngi])
        if not is_ca_zcta(zcta) or not in_ca(lat, lng):
            continue
        shp = sr.shape
        if shp.shapeType not in (shapefile.POLYGON, shapefile.POLYGONZ, 5, 15):
            skipped += 1
            continue
        # pyshp __geo_interface__ → shapely
        try:
            geom = shapely_shape(shp.__geo_interface__)
        except Exception:
            skipped += 1
            continue
        if geom.is_empty:
            skipped += 1
            continue
        if not geom.is_valid:
            geom = geom.buffer(0)
        ring = simplify_ring(exterior_ring(geom))
        if len(ring) < 3:
            skipped += 1
            continue
        min_lng, min_lat, max_lng, max_lat = geom.bounds
        rows.append(
            {
                "zcta": zcta,
                "name": f"ZIP {zcta}",
                "centroid": {"lat": lat, "lng": lng},
                "bbox": {
                    "minLat": min_lat,
                    "minLng": min_lng,
                    "maxLat": max_lat,
                    "maxLng": max_lng,
                },
                "ring": ring,
            }
        )

    rows.sort(key=lambda r: r["zcta"])
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(rows), encoding="utf-8")
    print(
        f"Wrote {len(rows)} CA ZCTAs → {OUT_FILE} "
        f"(skipped={skipped}, simplify={SIMPLIFY_TOL}, maxPts={MAX_RING_PTS})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
