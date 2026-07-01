"""Unit tests for 10-mile grade-aware segment builder (D-05, D-07)."""

from __future__ import annotations

import pytest

from app.simulation.constants import BASE_SEGMENT_M, GRADE_SCAN_INTERVAL_M, US_MILE_M
from app.simulation.segment_builder import build_segments, grade_between


def _flat_profile(distance_m: float, interval_m: float = 150.0) -> list[dict[str, float]]:
    profile: list[dict[str, float]] = []
    d = 0.0
    while d <= distance_m:
        profile.append({"dist_m": d, "elev_m": 100.0})
        d += interval_m
    if profile[-1]["dist_m"] != distance_m:
        profile.append({"dist_m": distance_m, "elev_m": 100.0})
    return profile


def _cajon_like_profile(distance_m: float) -> list[dict[str, float]]:
    """Synthetic profile with a steep climb mid-route (Cajon-like)."""
    profile: list[dict[str, float]] = []
    d = 0.0
    while d <= distance_m:
        if d < 20_000:
            elev = 100.0
        elif d < 35_000:
            elev = 100.0 + (d - 20_000) * 0.08  # ~8% average over climb
        else:
            elev = 100.0 + 15_000 * 0.08
        profile.append({"dist_m": d, "elev_m": elev})
        d += GRADE_SCAN_INTERVAL_M
    if profile[-1]["dist_m"] != distance_m:
        profile[-1] = {"dist_m": distance_m, "elev_m": profile[-1]["elev_m"]}
    return profile


def _straight_coords(distance_m: float, step_m: float = 1000.0) -> list[list[float]]:
    coords: list[list[float]] = []
    d = 0.0
    lon = -118.0
    lat = 34.0
    while d <= distance_m:
        coords.append([lon, lat + d / 111_000.0])
        d += step_m
    return coords


def test_flat_profile_single_base_segment():
    distance = BASE_SEGMENT_M * 2
    profile = _flat_profile(distance)
    coords = _straight_coords(distance)
    segments = build_segments(distance, coords, profile)

    assert len(segments) == 2
    assert all(abs(s["grade_pct"]) < 0.01 for s in segments)


def test_steep_profile_subdivides_more_than_flat():
    distance = BASE_SEGMENT_M * 2
    flat = build_segments(distance, _straight_coords(distance), _flat_profile(distance))
    steep = build_segments(
        distance, _straight_coords(distance), _cajon_like_profile(distance),
    )
    assert len(steep) > len(flat)


def test_cajon_synthetic_has_steep_segment():
    distance = BASE_SEGMENT_M * 2
    segments = build_segments(
        distance,
        _straight_coords(distance),
        _cajon_like_profile(distance),
    )
    max_grade = max(abs(s["grade_pct"]) for s in segments)
    assert max_grade > 4.0


def test_no_segment_spans_undivided_steep_interval():
    distance = BASE_SEGMENT_M * 2
    profile = _cajon_like_profile(distance)
    segments = build_segments(distance, _straight_coords(distance), profile)

    for seg in segments:
        g = grade_between(profile, seg["start_m"], seg["end_m"])
        scan = seg["start_m"] + GRADE_SCAN_INTERVAL_M
        while scan < seg["end_m"]:
            interval_end = min(scan + GRADE_SCAN_INTERVAL_M, seg["end_m"])
            interval_grade = grade_between(profile, scan - GRADE_SCAN_INTERVAL_M, interval_end)
            if abs(interval_grade) > 6.0:
                assert abs(g) > 4.0 or seg["dist_m"] <= GRADE_SCAN_INTERVAL_M * 1.5
            scan += GRADE_SCAN_INTERVAL_M


def test_segment_fields_present():
    distance = US_MILE_M * 15
    segments = build_segments(
        distance,
        _straight_coords(distance),
        _flat_profile(distance),
    )
    assert len(segments) >= 1
    for seg in segments:
        assert {"dist_m", "grade_pct", "start_m", "end_m", "mid_lon", "mid_lat"} <= seg.keys()
        assert seg["end_m"] > seg["start_m"]
        assert seg["dist_m"] == pytest.approx(seg["end_m"] - seg["start_m"], rel=1e-3)


def test_segment_cap_raises():
    distance = BASE_SEGMENT_M * 3
    profile: list[dict[str, float]] = []
    d = 0.0
    elev = 0.0
    while d <= distance:
        if int(d / GRADE_SCAN_INTERVAL_M) % 2 == 0:
            elev += GRADE_SCAN_INTERVAL_M * 0.10
        profile.append({"dist_m": d, "elev_m": elev})
        d += GRADE_SCAN_INTERVAL_M

    with pytest.raises(ValueError, match="exceeds cap"):
        build_segments(distance, _straight_coords(distance), profile)
