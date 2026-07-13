#!/usr/bin/env python3
"""Prepare topology-safe CARB air-district rings for the CaaS overlay."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from shapely.geometry import MultiPolygon, Polygon, shape as shapely_shape
from shapely.ops import unary_union

REPO = Path(__file__).resolve().parents[3]
SOURCE = REPO / "data/raw/CA GEO Data/Air_District_WFL1_-841210503623017823.geojson"
OUT = Path(__file__).resolve().parent / "out/ca_air_districts.json"
SIMPLIFY_TOL = 0.0015
MAX_RING_PTS = 160


def evenly_sample_ring(coordinates, max_points):
    if len(coordinates) <= max_points:
        return coordinates
    last = len(coordinates) - 1
    indices = sorted({round((index / (max_points - 1)) * last) for index in range(max_points)})
    return [coordinates[index] for index in indices]


def polygon_rings(geometry):
    polygons = list(geometry.geoms) if isinstance(geometry, MultiPolygon) else [geometry]
    rings = []
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


def main():
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    grouped = defaultdict(list)
    names = {}
    for feature in payload.get("features", []):
        props = feature.get("properties") or {}
        code = str(props.get("Air_District_Code") or "").strip()
        if not code or not feature.get("geometry"):
            continue
        geometry = shapely_shape(feature["geometry"])
        if not geometry.is_valid:
            geometry = geometry.buffer(0)
        if geometry.is_empty:
            continue
        grouped[code].append(geometry)
        names[code] = str(props.get("Air_District_Name") or code).strip()

    rows = []
    for code, geometries in grouped.items():
        geometry = unary_union(geometries)
        if not geometry.is_valid:
            geometry = geometry.buffer(0)
        rings = polygon_rings(geometry)
        if not rings:
            continue
        min_lng, min_lat, max_lng, max_lat = geometry.bounds
        point = geometry.representative_point()
        rows.append({
            "code": code,
            "name": names[code],
            "centroid": {"lat": float(point.y), "lng": float(point.x)},
            "bbox": {
                "minLat": float(min_lat),
                "minLng": float(min_lng),
                "maxLat": float(max_lat),
                "maxLng": float(max_lng),
            },
            "rings": rings,
        })
    rows.sort(key=lambda row: row["code"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows), encoding="utf-8")
    print(f"Wrote {len(rows)} CARB air districts to {OUT}")


if __name__ == "__main__":
    main()
