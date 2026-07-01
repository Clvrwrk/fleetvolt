"""Route segmentation — 10 US mile base cuts with 6% grade subdivision (D-05, D-07)."""

from __future__ import annotations

import math
from typing import Any

from app.simulation.constants import (
    BASE_SEGMENT_M,
    GRADE_SCAN_INTERVAL_M,
    GRADE_SPLIT_THRESHOLD_PCT,
    MAX_PHYSICS_SEGMENTS,
    US_MILE_M,
)


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


def interpolate_elev(profile: list[dict[str, float]], dist_m: float) -> float:
    """Linearly interpolate elevation at distance along profile."""
    if not profile:
        return 0.0
    if dist_m <= profile[0]["dist_m"]:
        return float(profile[0]["elev_m"])
    if dist_m >= profile[-1]["dist_m"]:
        return float(profile[-1]["elev_m"])

    for i in range(1, len(profile)):
        d1 = float(profile[i - 1]["dist_m"])
        d2 = float(profile[i]["dist_m"])
        if d1 <= dist_m <= d2:
            e1 = float(profile[i - 1]["elev_m"])
            e2 = float(profile[i]["elev_m"])
            span = d2 - d1
            if span <= 0:
                return e1
            frac = (dist_m - d1) / span
            return e1 + frac * (e2 - e1)

    return float(profile[-1]["elev_m"])


def grade_between(profile: list[dict[str, float]], start_m: float, end_m: float) -> float:
    """Average grade percent between start and end distances."""
    dist = end_m - start_m
    if dist <= 0:
        return 0.0
    elev_start = interpolate_elev(profile, start_m)
    elev_end = interpolate_elev(profile, end_m)
    return ((elev_end - elev_start) / dist) * 100.0


def _grade_at_interval(profile: list[dict[str, float]], start_m: float, end_m: float) -> float:
    """Grade over a scan interval (matches elevation ingest pattern)."""
    return grade_between(profile, start_m, end_m)


def interpolate_point_at_dist(
    coordinates: list[list[float]],
    dist_m: float,
) -> tuple[float, float]:
    """Interpolate (lon, lat) at distance along route polyline."""
    if not coordinates:
        return 0.0, 0.0
    if len(coordinates) == 1:
        return float(coordinates[0][0]), float(coordinates[0][1])

    cum: list[float] = [0.0]
    for i in range(1, len(coordinates)):
        lon0, lat0 = coordinates[i - 1]
        lon1, lat1 = coordinates[i]
        cum.append(cum[-1] + haversine_m(lat0, lon0, lat1, lon1))

    if dist_m <= 0:
        return float(coordinates[0][0]), float(coordinates[0][1])
    if dist_m >= cum[-1]:
        return float(coordinates[-1][0]), float(coordinates[-1][1])

    for i in range(1, len(cum)):
        if cum[i] >= dist_m:
            seg_len = cum[i] - cum[i - 1]
            frac = (dist_m - cum[i - 1]) / seg_len if seg_len > 0 else 0.0
            lon0, lat0 = coordinates[i - 1]
            lon1, lat1 = coordinates[i]
            lon = lon0 + frac * (lon1 - lon0)
            lat = lat0 + frac * (lat1 - lat0)
            return float(lon), float(lat)

    return float(coordinates[-1][0]), float(coordinates[-1][1])


def _subdivide_base_segment(
    profile: list[dict[str, float]],
    base_start: float,
    base_end: float,
) -> list[tuple[float, float]]:
    """Split a base segment where |grade| exceeds threshold at 150m scan resolution."""
    span = base_end - base_start
    if span <= GRADE_SCAN_INTERVAL_M:
        return [(base_start, base_end)]

    scan_points = [base_start]
    d = base_start + GRADE_SCAN_INTERVAL_M
    while d < base_end:
        scan_points.append(d)
        d += GRADE_SCAN_INTERVAL_M
    if scan_points[-1] != base_end:
        scan_points.append(base_end)

    intervals: list[tuple[float, float, bool]] = []
    for i in range(len(scan_points) - 1):
        s, e = scan_points[i], scan_points[i + 1]
        g = _grade_at_interval(profile, s, e)
        intervals.append((s, e, abs(g) > GRADE_SPLIT_THRESHOLD_PCT))

    if not any(steep for _, _, steep in intervals):
        return [(base_start, base_end)]

    merged: list[tuple[float, float]] = []
    seg_start, _, seg_steep = intervals[0]
    for s, e, steep in intervals:
        if steep != seg_steep and s > seg_start:
            merged.append((seg_start, s))
            seg_start = s
            seg_steep = steep
    merged.append((seg_start, base_end))
    return merged


def build_segments(
    distance_m: float,
    coordinates: list[list[float]],
    elevation_profile: list[dict[str, float]],
) -> list[dict[str, Any]]:
    """Build physics segments with 10-mile base cuts and 6% grade splits."""
    if distance_m <= 0:
        return []

    base_cuts = [0.0]
    d = BASE_SEGMENT_M
    while d < distance_m:
        base_cuts.append(d)
        d += BASE_SEGMENT_M
    base_cuts.append(distance_m)

    raw_segments: list[tuple[float, float]] = []
    for i in range(len(base_cuts) - 1):
        raw_segments.extend(
            _subdivide_base_segment(elevation_profile, base_cuts[i], base_cuts[i + 1])
        )

    if len(raw_segments) > MAX_PHYSICS_SEGMENTS:
        raise ValueError(
            f"Segment count {len(raw_segments)} exceeds cap {MAX_PHYSICS_SEGMENTS}"
        )

    segments: list[dict[str, Any]] = []
    for start_m, end_m in raw_segments:
        seg_dist = end_m - start_m
        mid_m = (start_m + end_m) / 2.0
        mid_lon, mid_lat = interpolate_point_at_dist(coordinates, mid_m)
        grade_pct = grade_between(elevation_profile, start_m, end_m)
        segments.append(
            {
                "dist_m": round(seg_dist, 2),
                "grade_pct": round(grade_pct, 4),
                "start_m": round(start_m, 2),
                "end_m": round(end_m, 2),
                "mid_lon": round(mid_lon, 6),
                "mid_lat": round(mid_lat, 6),
            }
        )

    return segments
