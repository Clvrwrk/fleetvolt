#!/usr/bin/env python3
"""Prepare California Geoportal county rings for the CaaS overlay."""
from __future__ import annotations

import json
from pathlib import Path

try:
    from shapely.geometry import MultiPolygon, Polygon, shape as shapely_shape
except ImportError:
    print("Need shapely (run with uv --with shapely)")
    raise SystemExit(1)

REPO = Path(__file__).resolve().parents[3]
SOURCE = REPO / "data/raw/CA GEO Data/California_County_Boundaries_and_Identifiers_Blue_Version_view_8849997206380496822.geojson"
OUT = Path(__file__).resolve().parent / "out/ca_counties.json"
SIMPLIFY_TOL = 0.003
MAX_RING_PTS = 96


def evenly_sample_ring(coordinates, max_points):
    """Downsample the full open ring without dropping its trailing boundary."""
    if len(coordinates) <= max_points:
        return coordinates
    last = len(coordinates) - 1
    indices = sorted({round((index / (max_points - 1)) * last) for index in range(max_points)})
    return [coordinates[index] for index in indices]


def polygon_rings(geometry) -> list[list[dict[str, float]]]:
    if geometry.is_empty:
        return []
    polygons = list(geometry.geoms) if isinstance(geometry, MultiPolygon) else [geometry]
    rings: list[list[dict[str, float]]] = []
    for polygon in polygons:
        if not isinstance(polygon, Polygon) or polygon.is_empty:
            continue
        simplified = polygon.simplify(SIMPLIFY_TOL, preserve_topology=True)
        if not isinstance(simplified, Polygon):
            simplified = polygon
        coordinates = list(simplified.exterior.coords)
        if len(coordinates) >= 2 and coordinates[0] == coordinates[-1]:
            coordinates = coordinates[:-1]
        coordinates = evenly_sample_ring(coordinates, MAX_RING_PTS)
        if len(coordinates) >= 3:
            rings.append([{"lat": float(lat), "lng": float(lng)} for lng, lat in coordinates])
    return rings


def main() -> int:
    if not SOURCE.exists():
        print(f"Missing California Geoportal county GeoJSON: {SOURCE}")
        return 1
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    rows: list[dict] = []
    for feature in payload.get("features", []):
        properties = feature.get("properties") or {}
        fips = str(properties.get("CENSUS_GEOID") or "").strip()
        if not fips.startswith("06") or not feature.get("geometry"):
            continue
        geometry = shapely_shape(feature["geometry"])
        if not geometry.is_valid:
            geometry = geometry.buffer(0)
        rings = polygon_rings(geometry)
        if not rings:
            continue
        min_lng, min_lat, max_lng, max_lat = geometry.bounds
        point = geometry.representative_point()
        rows.append({
            "fips": fips,
            "centroid": {"lat": float(point.y), "lng": float(point.x)},
            "bbox": {
                "minLat": float(min_lat),
                "minLng": float(min_lng),
                "maxLat": float(max_lat),
                "maxLng": float(max_lng),
            },
            "rings": rings,
        })
    rows.sort(key=lambda row: row["fips"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows), encoding="utf-8")
    print(f"Wrote {len(rows)} California Geoportal counties to {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
