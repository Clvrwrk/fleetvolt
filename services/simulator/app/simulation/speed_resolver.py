"""Posted speed limits with route-history overlay (D-08)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.simulation.constants import MPS_PER_MPH
from app.simulation.route_provider import DEFAULT_TRUCK_TOP_SPEED_MPH, EdgeSpeed

OVERLAY_MIN = 0.85
OVERLAY_MAX = 1.0
DEFAULT_POSTED_MPH = 55.0


@dataclass(frozen=True)
class TruckSpeedParams:
    """Truck speed cap for Class 8 costing limits."""

    top_speed_mph: float = DEFAULT_TRUCK_TOP_SPEED_MPH


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def posted_speed_for_segment(
    start_m: float,
    end_m: float,
    edge_speeds: list[EdgeSpeed],
    *,
    default_mph: float = DEFAULT_POSTED_MPH,
) -> float:
    """Distance-weighted average posted speed across segment span."""
    if end_m <= start_m:
        return default_mph
    if not edge_speeds:
        return default_mph

    total_dist = 0.0
    weighted_speed = 0.0

    for edge in edge_speeds:
        overlap_start = max(start_m, edge.start_m)
        overlap_end = min(end_m, edge.end_m)
        overlap = overlap_end - overlap_start
        if overlap <= 0:
            continue
        total_dist += overlap
        weighted_speed += overlap * edge.speed_limit_mph

    if total_dist <= 0:
        return default_mph
    return weighted_speed / total_dist


def resolve_speeds(
    segments: list[dict[str, Any]],
    edge_speeds: list[EdgeSpeed],
    truck_params: TruckSpeedParams,
) -> list[float]:
    """Forward pass: posted limits with route-history overlay per D-08."""
    if not segments:
        return []

    effective_speeds: list[float] = []
    prior_realized_dist = 0.0
    prior_realized_speed_sum = 0.0
    prior_posted_dist = 0.0
    prior_posted_speed_sum = 0.0

    for segment in segments:
        start_m = float(segment["start_m"])
        end_m = float(segment["end_m"])
        dist_m = float(segment.get("dist_m", end_m - start_m))
        posted_mph = posted_speed_for_segment(start_m, end_m, edge_speeds)

        if prior_realized_dist <= 0 or prior_posted_dist <= 0:
            overlay_factor = OVERLAY_MAX
        else:
            prior_avg_realized = prior_realized_speed_sum / prior_realized_dist
            prior_avg_posted = prior_posted_speed_sum / prior_posted_dist
            if prior_avg_posted <= 0:
                overlay_factor = OVERLAY_MAX
            else:
                overlay_factor = _clamp(
                    prior_avg_realized / prior_avg_posted,
                    OVERLAY_MIN,
                    OVERLAY_MAX,
                )

        effective = min(posted_mph * overlay_factor, truck_params.top_speed_mph)
        effective_speeds.append(effective)

        prior_realized_dist += dist_m
        prior_realized_speed_sum += effective * dist_m
        prior_posted_dist += dist_m
        prior_posted_speed_sum += posted_mph * dist_m

    return effective_speeds


def segment_travel_time_s(dist_m: float, speed_mph: float) -> float:
    """Estimate segment travel time for orchestrator hooks."""
    if speed_mph <= 0:
        return 0.0
    return dist_m / (speed_mph * MPS_PER_MPH)
