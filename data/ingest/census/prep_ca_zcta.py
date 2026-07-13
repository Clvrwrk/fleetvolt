#!/usr/bin/env python3
"""Prep routable CA ZIP polygons from the California State Geoportal.

Source GeoJSON (local, no API pull):
  data/raw/CA GEO Data/USA_ZIP_Code_Areas_anaylsis_-8030337519481127108.geojson

Filters to California by interior point, simplifies geometry for Convex
(doc size budget), and emits bbox + exterior ring for choropleth fill.

Run:
  services/simulator/.venv/bin/python data/ingest/census/prep_ca_zcta.py

Output:
  data/ingest/census/out/ca_zcta.json
"""
from __future__ import annotations

import json
from pathlib import Path

try:
    from shapely.geometry import Polygon, MultiPolygon, shape as shapely_shape
    from shapely.ops import unary_union
except ImportError:
    print("Need shapely (run with uv --with shapely)")
    raise SystemExit(1)

REPO = Path(__file__).resolve().parents[3]
SOURCE = REPO / "data/raw/CA GEO Data/USA_ZIP_Code_Areas_anaylsis_-8030337519481127108.geojson"
OUT_DIR = Path(__file__).resolve().parent / "out"
OUT_FILE = OUT_DIR / "ca_zcta.json"

# California Geoportal includes synthetic 000xx service areas. Keep only
# routable postal codes in California's primary range.
def is_ca_zcta(zcta: str) -> bool:
    try:
        n = int(zcta)
    except ValueError:
        return False
    return 90001 <= n <= 96162

# ~550 m simplify; then hard-cap vertex count for Convex docs.
SIMPLIFY_TOL = 0.005
MAX_RING_PTS = 48


def evenly_sample_ring(ring, max_points):
    """Downsample the full open ring without truncating its trailing boundary."""
    if len(ring) <= max_points:
        return ring
    last = len(ring) - 1
    indices = sorted({round((index / (max_points - 1)) * last) for index in range(max_points)})
    return [ring[index] for index in indices]


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
    ring = evenly_sample_ring(ring, MAX_RING_PTS)
    # Ensure closed for Google Maps Polygon path consumers if they need it —
    # we store open rings; UI closes.
    return [{"lat": lat, "lng": lng} for lng, lat in ring]


def main() -> int:
    if not SOURCE.exists():
        print(f"Missing California Geoportal ZIP GeoJSON: {SOURCE}")
        return 1
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))

    rows: list[dict] = []
    skipped = 0
    for feature in payload.get("features", []):
        properties = feature.get("properties") or {}
        zcta = str(properties.get("ZIP_CODE") or "").strip()
        if properties.get("STATE") != "CA" or not is_ca_zcta(zcta):
            continue
        if not feature.get("geometry"):
            skipped += 1
            continue
        try:
            geom = shapely_shape(feature["geometry"])
        except Exception:
            skipped += 1
            continue
        if geom.is_empty:
            skipped += 1
            continue
        if not geom.is_valid:
            geom = geom.buffer(0)
        representative = geom.representative_point()
        lat = float(representative.y)
        lng = float(representative.x)
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
        f"Wrote {len(rows)} California Geoportal ZIP areas → {OUT_FILE} "
        f"(skipped={skipped}, simplify={SIMPLIFY_TOL}, maxPts={MAX_RING_PTS})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
