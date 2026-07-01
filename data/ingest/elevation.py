"""Elevation profile pre-cache with Open-Elevation batch fetch and bridge filtering (D-07, D-09)."""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

REPO_ROOT = Path(__file__).resolve().parents[2]
CORRIDORS_DIR = REPO_ROOT / "data" / "corridors"
FIXTURE_PATH = REPO_ROOT / "data" / "raw" / "elevation" / "sample_profile.json"

OPEN_ELEVATION_URL = os.environ.get(
    "OPEN_ELEVATION_URL", "https://api.open-elevation.com"
).rstrip("/")
VALHALLA_BASE_URL = os.environ.get("VALHALLA_URL", "http://valhalla:8002").rstrip("/")

SAMPLE_INTERVAL_M = 150.0
BATCH_SIZE = 100
BATCH_SLEEP_S = 1.2
FRESHNESS_DATASET = "elevation_profiles"

CLASS8_TRUCK_OPTIONS = {
    "height": 4.11,
    "weight": 36287,
    "axle_count": 5,
    "hazmat": False,
}

logger = logging.getLogger(__name__)


def load_corridor(corridor_key: str) -> dict:
    """Load corridor definition JSON by corridor_key."""
    path = CORRIDORS_DIR / f"{corridor_key}.json"
    if not path.exists():
        raise FileNotFoundError(f"Corridor definition not found: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("corridor_key") != corridor_key:
        raise ValueError(f"corridor_key mismatch in {path}")
    return payload


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in meters between two WGS84 points."""
    radius = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


def sample_polyline(
    coordinates: list[list[float]],
    interval_m: float = SAMPLE_INTERVAL_M,
) -> list[tuple[float, float, float]]:
    """Sample [lon, lat] pairs every ``interval_m`` along the polyline."""
    if len(coordinates) < 2:
        if coordinates:
            lon, lat = coordinates[0]
            return [(lon, lat, 0.0)]
        return []

    samples: list[tuple[float, float, float]] = []
    dist_along = 0.0
    next_sample_at = 0.0

    lon0, lat0 = coordinates[0]
    samples.append((lon0, lat0, 0.0))
    next_sample_at = interval_m

    for i in range(1, len(coordinates)):
        lon1, lat1 = coordinates[i]
        lon_prev, lat_prev = coordinates[i - 1]
        segment_len = haversine_m(lat_prev, lon_prev, lat1, lon1)
        if segment_len <= 0:
            continue

        dist_start = dist_along
        dist_along += segment_len

        while next_sample_at <= dist_along:
            frac = (next_sample_at - dist_start) / segment_len
            lon = lon_prev + frac * (lon1 - lon_prev)
            lat = lat_prev + frac * (lat1 - lat_prev)
            samples.append((lon, lat, next_sample_at))
            next_sample_at += interval_m

    last_lon, last_lat = coordinates[-1]
    if samples[-1][0] != last_lon or samples[-1][1] != last_lat:
        samples.append((last_lon, last_lat, dist_along))

    return samples


def filter_bridge_spikes(
    profile: list[dict],
    max_drop_ft: float = 40,
    window_m: float = 200,
) -> list[dict]:
    """GradeIT-inspired bridge deck interpolation for DEM artifacts (D-09)."""
    if len(profile) < 3:
        return [point.copy() for point in profile]

    out = [point.copy() for point in profile]
    for i in range(1, len(out) - 1):
        dist = out[i]["dist_m"] - out[i - 1]["dist_m"]
        drop = (out[i - 1]["elev_m"] - out[i]["elev_m"]) * 3.28084
        if 0 < dist < window_m and drop > max_drop_ft:
            out[i]["elev_m"] = (out[i - 1]["elev_m"] + out[i + 1]["elev_m"]) / 2
    return out


def compute_max_grade_pct(profile: list[dict]) -> float:
    """Maximum absolute grade percent between consecutive profile points."""
    max_grade = 0.0
    for i in range(1, len(profile)):
        dist = profile[i]["dist_m"] - profile[i - 1]["dist_m"]
        if dist <= 0:
            continue
        elev_delta = profile[i]["elev_m"] - profile[i - 1]["elev_m"]
        grade = abs(elev_delta / dist) * 100.0
        max_grade = max(max_grade, grade)
    return max_grade


def coordinates_to_wkt(coordinates: list[list[float]]) -> str:
    """Normalized LINESTRING WKT from [lon, lat] pairs."""
    coords = ", ".join(f"{lon:.6f} {lat:.6f}" for lon, lat in coordinates)
    return f"LINESTRING({coords})"


def route_hash_from_coordinates(coordinates: list[list[float]]) -> str:
    """SHA256 of normalized route WKT for cache keying."""
    wkt = coordinates_to_wkt(coordinates)
    return hashlib.sha256(wkt.encode("utf-8")).hexdigest()


def fetch_valhalla_route(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
) -> list[list[float]]:
    """Fetch truck route GeoJSON coordinates from Valhalla."""
    body = {
        "locations": [
            {"lat": origin_lat, "lon": origin_lon},
            {"lat": dest_lat, "lon": dest_lon},
        ],
        "costing": "truck",
        "costing_options": {"truck": CLASS8_TRUCK_OPTIONS},
        "shape_format": "geojson",
    }
    with httpx.Client(timeout=30.0) as client:
        response = client.post(f"{VALHALLA_BASE_URL}/route", json=body)
        response.raise_for_status()
        payload = response.json()

    shape = payload["trip"]["legs"][0]["shape"]
    coordinates: list[list[float]] = []
    for point in shape:
        if isinstance(point, (list, tuple)) and len(point) >= 2:
            coordinates.append([float(point[0]), float(point[1])])
    return coordinates


def fetch_elevations_batch(
    points: list[tuple[float, float, float]],
    *,
    client: httpx.Client | None = None,
) -> list[float]:
    """Batch-fetch elevations from Open-Elevation (<=100 locations per request)."""
    elevations: list[float] = []
    own_client = client is None
    http = client or httpx.Client(timeout=60.0)

    try:
        for start in range(0, len(points), BATCH_SIZE):
            batch = points[start : start + BATCH_SIZE]
            payload = {
                "locations": [
                    {"latitude": lat, "longitude": lon} for lon, lat, _ in batch
                ]
            }
            response = http.post(
                f"{OPEN_ELEVATION_URL}/api/v1/lookup",
                json=payload,
            )
            response.raise_for_status()
            results = response.json()["results"]
            elevations.extend(float(item["elevation"]) for item in results)
            if start + BATCH_SIZE < len(points):
                time.sleep(BATCH_SLEEP_S)
    finally:
        if own_client:
            http.close()

    return elevations


def _interpolate_elevations(
    coordinates: list[list[float]],
    control_elevations: list[float],
    samples: list[tuple[float, float, float]],
) -> list[dict]:
    """Linearly interpolate elevations along sampled points from sparse control."""
    if len(control_elevations) != len(coordinates):
        raise ValueError("control_elevations length must match coordinates")

    seg_cum: list[float] = [0.0]
    for i in range(1, len(coordinates)):
        lon0, lat0 = coordinates[i - 1]
        lon1, lat1 = coordinates[i]
        seg_cum.append(seg_cum[-1] + haversine_m(lat0, lon0, lat1, lon1))

    profile: list[dict] = []
    seg_idx = 0
    for lon, lat, dist_m in samples:
        while seg_idx < len(seg_cum) - 2 and dist_m > seg_cum[seg_idx + 1]:
            seg_idx += 1

        if seg_idx >= len(seg_cum) - 1:
            elev = control_elevations[-1]
        else:
            seg_start = seg_cum[seg_idx]
            seg_end = seg_cum[seg_idx + 1]
            seg_len = seg_end - seg_start
            frac = (dist_m - seg_start) / seg_len if seg_len > 0 else 0.0
            elev = control_elevations[seg_idx] + frac * (
                control_elevations[seg_idx + 1] - control_elevations[seg_idx]
            )
        profile.append({"dist_m": round(dist_m, 2), "elev_m": round(elev, 2)})

    return profile


def build_profile_from_fixture(
    corridor_key: str,
    fixture_path: Path = FIXTURE_PATH,
) -> tuple[list[list[float]], list[dict]]:
    """Build profile from offline fixture for CI without network."""
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    corridor = payload["corridors"][corridor_key]
    coordinates = corridor["coordinates"]
    control_elevations = [float(e) for e in corridor["elevations_m"]]
    resolution = float(payload.get("resolution_m", SAMPLE_INTERVAL_M))
    samples = sample_polyline(coordinates, interval_m=resolution)
    profile = _interpolate_elevations(coordinates, control_elevations, samples)
    return coordinates, profile


def build_profile_live(
    origin: tuple[float, float],
    dest: tuple[float, float],
) -> tuple[list[list[float]], list[dict]]:
    """Fetch route from Valhalla, sample, and query Open-Elevation."""
    origin_lat, origin_lon = origin
    dest_lat, dest_lon = dest
    coordinates = fetch_valhalla_route(origin_lat, origin_lon, dest_lat, dest_lon)
    samples = sample_polyline(coordinates)
    elevations = fetch_elevations_batch(samples)
    profile = [
        {"dist_m": round(dist_m, 2), "elev_m": round(elev, 2)}
        for (_, _, dist_m), elev in zip(samples, elevations, strict=True)
    ]
    return coordinates, profile


def upsert_profile(
    session: Session,
    *,
    corridor_key: str,
    route_hash: str,
    profile: list[dict],
    source: str,
    resolution_m: float,
) -> None:
    """Upsert elevation_profiles row keyed by route_hash."""
    session.execute(
        text(
            """
            INSERT INTO elevation_profiles
                (corridor_key, route_hash, profile, source, resolution_m, ingested_at, created_at)
            VALUES
                (:corridor_key, :route_hash, CAST(:profile AS jsonb), :source, :resolution_m, NOW(), NOW())
            ON CONFLICT (route_hash) DO UPDATE SET
                corridor_key = EXCLUDED.corridor_key,
                profile = EXCLUDED.profile,
                source = EXCLUDED.source,
                resolution_m = EXCLUDED.resolution_m,
                ingested_at = NOW()
            """
        ),
        {
            "corridor_key": corridor_key,
            "route_hash": route_hash,
            "profile": json.dumps(profile),
            "source": source,
            "resolution_m": resolution_m,
        },
    )


def update_freshness(session: Session) -> None:
    """Upsert data_freshness for elevation_profiles dataset."""
    row = session.execute(
        text("SELECT COUNT(*) FROM elevation_profiles")
    ).scalar_one()
    now = datetime.now(tz=UTC)
    session.execute(
        text(
            """
            INSERT INTO data_freshness (dataset_name, last_ingested_at, row_count, source)
            VALUES (:dataset_name, :last_ingested_at, :row_count, :source)
            ON CONFLICT (dataset_name) DO UPDATE SET
                last_ingested_at = EXCLUDED.last_ingested_at,
                row_count = EXCLUDED.row_count,
                source = EXCLUDED.source
            """
        ),
        {
            "dataset_name": FRESHNESS_DATASET,
            "last_ingested_at": now,
            "row_count": int(row),
            "source": "Open-Elevation pre-cache",
        },
    )


def precompute_corridor(
    session: Session,
    corridor_key: str,
    *,
    use_fixture: bool = False,
) -> int:
    """Precompute and store elevation profile for one corridor."""
    corridor = load_corridor(corridor_key)
    origin = tuple(corridor["origin"])
    dest = tuple(corridor["dest"])

    if use_fixture:
        coordinates, raw_profile = build_profile_from_fixture(corridor_key)
        source = "Open-Elevation-fixture"
    else:
        coordinates, raw_profile = build_profile_live(origin, dest)
        source = "Open-Elevation"

    filtered = filter_bridge_spikes(raw_profile)
    route_hash = route_hash_from_coordinates(coordinates)
    upsert_profile(
        session,
        corridor_key=corridor_key,
        route_hash=route_hash,
        profile=filtered,
        source=source,
        resolution_m=SAMPLE_INTERVAL_M,
    )
    session.commit()
    return len(filtered)


def precompute_all(
    session: Session,
    *,
    corridor_keys: list[str] | None = None,
    use_fixture: bool = False,
) -> dict[str, int]:
    """Precompute elevation for all (or selected) corridors."""
    keys = corridor_keys or [
        "polb_san_bernardino",
        "polb_cajon_pass",
    ]
    counts: dict[str, int] = {}
    for key in keys:
        counts[key] = precompute_corridor(session, key, use_fixture=use_fixture)
    update_freshness(session)
    session.commit()
    return counts


def main() -> None:
    """CLI: python -m data.ingest.elevation --precompute [--corridor KEY] [--fixture]."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description="Pre-cache corridor elevation profiles")
    parser.add_argument("--precompute", action="store_true", help="Run elevation pre-cache")
    parser.add_argument(
        "--corridor",
        action="append",
        dest="corridors",
        help="Corridor key (repeatable; default: both validation corridors)",
    )
    parser.add_argument(
        "--fixture",
        action="store_true",
        help="Use offline fixture instead of Valhalla + Open-Elevation",
    )
    args = parser.parse_args()

    if not args.precompute:
        parser.error("--precompute is required")

    if str(REPO_ROOT) not in sys.path:
        sys.path.insert(0, str(REPO_ROOT))

    from app.db import SessionLocal

    session = SessionLocal()
    try:
        counts = precompute_all(
            session,
            corridor_keys=args.corridors,
            use_fixture=args.fixture,
        )
        for key, point_count in counts.items():
            logger.info("Cached %s: %d points", key, point_count)
    finally:
        session.close()


if __name__ == "__main__":
    main()
