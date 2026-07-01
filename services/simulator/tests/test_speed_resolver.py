"""Unit tests for SpeedResolver posted limits and route-history overlay (D-08)."""

from __future__ import annotations

import pytest

from app.simulation.route_provider import EdgeSpeed
from app.simulation.speed_resolver import (
    TruckSpeedParams,
    posted_speed_for_segment,
    resolve_speeds,
)


def _edge(start_m: float, length_m: float, speed_mph: float) -> EdgeSpeed:
    return EdgeSpeed(start_m=start_m, edge_length_m=length_m, speed_limit_mph=speed_mph)


def test_first_segment_uses_posted_only():
    segments = [
        {"start_m": 0.0, "end_m": 10_000.0, "dist_m": 10_000.0},
        {"start_m": 10_000.0, "end_m": 20_000.0, "dist_m": 10_000.0},
    ]
    edge_speeds = [
        _edge(0.0, 20_000.0, 65.0),
    ]
    truck = TruckSpeedParams(top_speed_mph=74.0)

    speeds = resolve_speeds(segments, edge_speeds, truck)
    assert speeds[0] == pytest.approx(65.0)
    assert speeds[1] == pytest.approx(65.0)


def test_second_segment_slower_when_prior_below_posted():
    """When segment 1 is truck-capped below posted, overlay reduces segment 2."""
    segments = [
        {"start_m": 0.0, "end_m": 10_000.0, "dist_m": 10_000.0},
        {"start_m": 10_000.0, "end_m": 20_000.0, "dist_m": 10_000.0},
    ]
    edge_speeds = [
        _edge(0.0, 10_000.0, 65.0),
        _edge(10_000.0, 10_000.0, 70.0),
    ]
    truck = TruckSpeedParams(top_speed_mph=74.0)

    speeds = resolve_speeds(segments, edge_speeds, truck)
    assert speeds[0] == pytest.approx(65.0)

    truck_capped = TruckSpeedParams(top_speed_mph=55.0)
    capped_speeds = resolve_speeds(segments, edge_speeds, truck_capped)
    assert capped_speeds[0] == pytest.approx(55.0)
    assert capped_speeds[1] < 70.0
    assert capped_speeds[1] < speeds[1]


def test_no_segment_exceeds_truck_cap():
    segments = [
        {"start_m": 0.0, "end_m": 5_000.0, "dist_m": 5_000.0},
        {"start_m": 5_000.0, "end_m": 15_000.0, "dist_m": 10_000.0},
        {"start_m": 15_000.0, "end_m": 25_000.0, "dist_m": 10_000.0},
    ]
    edge_speeds = [
        _edge(0.0, 10_000.0, 70.0),
        _edge(10_000.0, 15_000.0, 75.0),
    ]
    truck = TruckSpeedParams(top_speed_mph=60.0)

    speeds = resolve_speeds(segments, edge_speeds, truck)
    assert all(s <= 60.0 + 1e-6 for s in speeds)


def test_posted_speed_distance_weighted_average():
    edge_speeds = [
        _edge(0.0, 5_000.0, 55.0),
        _edge(5_000.0, 10_000.0, 65.0),
    ]
    posted = posted_speed_for_segment(2_000.0, 8_000.0, edge_speeds)
    expected = (3_000.0 * 55.0 + 3_000.0 * 65.0) / 6_000.0
    assert posted == pytest.approx(expected)


def test_overlay_factor_clamped_at_085():
    segments = [
        {"start_m": 0.0, "end_m": 10_000.0, "dist_m": 10_000.0},
        {"start_m": 10_000.0, "end_m": 20_000.0, "dist_m": 10_000.0},
    ]
    edge_speeds = [_edge(0.0, 20_000.0, 80.0)]
    truck = TruckSpeedParams(top_speed_mph=68.0)

    speeds = resolve_speeds(segments, edge_speeds, truck)
    assert speeds[0] == pytest.approx(68.0)
    assert speeds[1] == pytest.approx(80.0 * 0.85, rel=0.01)


def test_empty_segments_returns_empty():
    assert resolve_speeds([], [], TruckSpeedParams()) == []
