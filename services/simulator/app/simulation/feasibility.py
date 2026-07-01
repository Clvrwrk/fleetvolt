"""Feasibility verdict and infrastructure tier classifier (CHRG-04, CHRG-05, D-10–D-13)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

import numpy as np
from sqlalchemy.orm import Session

from app.simulation.charging_planner import (
    PlannerStatus,
    inject_soc_from_index,
    plan_greedy_stops,
)
from app.simulation.physics_engine import TruckParams
from app.simulation.route_provider import RouteProvider
from app.simulation.schemas import (
    AssumptionEntry,
    ChargingConditionsSpec,
    ChargingStopResult,
    FeasibilityResult,
)

BlockingReason = Literal["no_charger_in_radius", "detour_exceeded", "cannot_reach_destination"]

CRITICAL_SOC_FLOOR_PCT = 5.0
MIN_DWELL_BUFFER_S = 1800.0

GREEDY_ASSUMPTION_NOTE = (
    "CHRG-06 deferred to v2 scored-greedy: intended weights time=0.4, energy=0.35, cost=0.25. "
    "v1 uses first-feasible greedy with shortest detour then highest power tie-break."
)


@dataclass(frozen=True)
class PlannerOutcome:
    public_complete: bool
    shadow_depot_complete: bool | None = None
    blocking_reason: BlockingReason | None = None
    soc_deficit_kwh: float | None = None


def _is_critical(
    final_soc_pct: float,
    stops: list[ChargingStopResult],
    conditions: ChargingConditionsSpec,
) -> bool:
    """Comfort-margin critical per D-12."""
    min_arrival = float(conditions.min_arrival_soc_pct)
    if CRITICAL_SOC_FLOOR_PCT <= final_soc_pct < min_arrival:
        return True
    if len(stops) == 1 and stops[0].dwell_s < MIN_DWELL_BUFFER_S:
        return True
    return False


def _resolve_tier(planner_outcome: PlannerOutcome) -> Literal[
    "public_hd", "depot_required", "infrastructure_gap"
]:
    if planner_outcome.public_complete:
        return "public_hd"
    if planner_outcome.shadow_depot_complete:
        return "depot_required"
    return "infrastructure_gap"


def classify_feasibility(
    stops: list[ChargingStopResult],
    final_soc_pct: float,
    conditions: ChargingConditionsSpec,
    planner_outcome: PlannerOutcome,
) -> FeasibilityResult:
    """Pure classifier — no side effects (D-10, D-22)."""
    tier = _resolve_tier(planner_outcome)
    completable = planner_outcome.public_complete or planner_outcome.shadow_depot_complete is True

    if not completable:
        return FeasibilityResult(
            verdict="infeasible",
            tier=tier,
            soc_deficit_kwh=planner_outcome.soc_deficit_kwh,
            blocking_reason=planner_outcome.blocking_reason,
            stop_count=len(stops),
        )

    verdict: Literal["feasible", "critical"] = (
        "critical" if _is_critical(final_soc_pct, stops, conditions) else "feasible"
    )
    return FeasibilityResult(
        verdict=verdict,
        tier=tier,
        stop_count=len(stops),
    )


def get_charging_assumptions() -> list[AssumptionEntry]:
    """Document CHRG-06 deferred multi-objective weights per D-07."""
    return [
        AssumptionEntry(
            field="charging_greedy_strategy",
            value=0.4,
            source="documented_deferred_v2",
            oem_default=0.35,
            category="charging",
            note=GREEDY_ASSUMPTION_NOTE,
        )
    ]


def shadow_pass_depot_at_origin(
    db: Session,
    segments: list[dict[str, Any]],
    soc_pct: np.ndarray,
    coordinates: list[list[float]],
    truck: TruckParams,
    charge_curve: list[dict[str, Any]],
    conditions: ChargingConditionsSpec,
    route_provider: RouteProvider,
) -> bool:
    """Shadow pass: unlimited depot charge at route origin (D-11, RESEARCH Q1)."""
    soc = np.asarray(soc_pct, dtype=np.float64, copy=True)
    energy_to_full = ((100.0 - float(soc[0])) / 100.0) * truck.usable_kwh
    if energy_to_full > 0:
        inject_soc_from_index(soc, 0, energy_to_full, truck.usable_kwh)

    _, status = plan_greedy_stops(
        db,
        segments,
        soc,
        coordinates,
        truck,
        charge_curve,
        conditions,
        route_provider,
    )
    return status.complete


def planner_outcome_from_status(
    public_status: PlannerStatus,
    *,
    shadow_depot_complete: bool | None = None,
) -> PlannerOutcome:
    """Build classifier input from greedy planner status."""
    if public_status.complete:
        return PlannerOutcome(public_complete=True)

    return PlannerOutcome(
        public_complete=False,
        shadow_depot_complete=shadow_depot_complete,
        blocking_reason=public_status.blocking_reason,
        soc_deficit_kwh=public_status.soc_deficit_kwh,
    )
