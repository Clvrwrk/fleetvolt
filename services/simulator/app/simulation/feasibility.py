"""Feasibility verdict and infrastructure tier classifier (CHRG-04, CHRG-05, D-10–D-13)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.simulation.schemas import AssumptionEntry, ChargingConditionsSpec, ChargingStopResult

BlockingReason = Literal["no_charger_in_radius", "detour_exceeded", "cannot_reach_destination"]


@dataclass(frozen=True)
class PlannerOutcome:
    public_complete: bool
    shadow_depot_complete: bool | None = None
    blocking_reason: BlockingReason | None = None
    soc_deficit_kwh: float | None = None


def classify_feasibility(
    stops: list[ChargingStopResult],
    final_soc_pct: float,
    conditions: ChargingConditionsSpec,
    planner_outcome: PlannerOutcome,
) -> "FeasibilityResult":
    raise NotImplementedError("classify_feasibility — Plan 03-02 Task 2")


def get_charging_assumptions() -> list[AssumptionEntry]:
    raise NotImplementedError("get_charging_assumptions — Plan 03-02 Task 2")
