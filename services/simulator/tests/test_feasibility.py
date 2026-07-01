"""Unit tests for feasibility classifier (CHRG-04, CHRG-05, D-07, D-10–D-13)."""

from __future__ import annotations

from app.simulation.feasibility import (
    PlannerOutcome,
    classify_feasibility,
    get_charging_assumptions,
)
from app.simulation.schemas import ChargingConditionsSpec, ChargingStopResult


def _conditions() -> ChargingConditionsSpec:
    return ChargingConditionsSpec(min_arrival_soc_pct=10.0)


def _stop(dwell_s: float = 2400.0, **kwargs) -> ChargingStopResult:
    defaults = {
        "station_id": "test-station",
        "name": "Test HD",
        "lat": 34.0,
        "lon": -117.5,
        "power_kw": 350.0,
        "arrival_soc_pct": 17.0,
        "departure_soc_pct": 80.0,
        "dwell_s": dwell_s,
        "energy_added_kwh": 200.0,
        "detour_s": 300.0,
    }
    defaults.update(kwargs)
    return ChargingStopResult(**defaults)


def test_feasible_high_arrival_soc():
    stops = [_stop()]
    result = classify_feasibility(
        stops,
        final_soc_pct=15.0,
        conditions=_conditions(),
        planner_outcome=PlannerOutcome(public_complete=True),
    )
    assert result.verdict == "feasible"
    assert result.tier == "public_hd"
    assert result.stop_count == 1


def test_critical_tight_arrival():
    stops = [_stop()]
    result = classify_feasibility(
        stops,
        final_soc_pct=7.0,
        conditions=_conditions(),
        planner_outcome=PlannerOutcome(public_complete=True),
    )
    assert result.verdict == "critical"
    assert result.tier == "public_hd"


def test_critical_single_stop_low_buffer():
    stops = [_stop(dwell_s=1200.0)]
    result = classify_feasibility(
        stops,
        final_soc_pct=12.0,
        conditions=_conditions(),
        planner_outcome=PlannerOutcome(public_complete=True),
    )
    assert result.verdict == "critical"
    assert result.tier == "public_hd"


def test_infeasible_soc_deficit():
    result = classify_feasibility(
        [],
        final_soc_pct=8.0,
        conditions=_conditions(),
        planner_outcome=PlannerOutcome(
            public_complete=False,
            shadow_depot_complete=False,
            blocking_reason="cannot_reach_destination",
            soc_deficit_kwh=12.5,
        ),
    )
    assert result.verdict == "infeasible"
    assert result.tier == "infrastructure_gap"
    assert result.soc_deficit_kwh is not None
    assert result.soc_deficit_kwh > 0
    assert result.blocking_reason == "cannot_reach_destination"


def test_public_hd_tier():
    stops = [_stop(), _stop(station_id="second")]
    result = classify_feasibility(
        stops,
        final_soc_pct=14.0,
        conditions=_conditions(),
        planner_outcome=PlannerOutcome(public_complete=True),
    )
    assert result.tier == "public_hd"
    assert result.verdict == "feasible"
    assert result.stop_count == 2


def test_depot_required_shadow():
    result = classify_feasibility(
        [],
        final_soc_pct=11.0,
        conditions=_conditions(),
        planner_outcome=PlannerOutcome(
            public_complete=False,
            shadow_depot_complete=True,
        ),
    )
    assert result.tier == "depot_required"
    assert result.verdict == "feasible"


def test_infrastructure_gap():
    result = classify_feasibility(
        [],
        final_soc_pct=6.0,
        conditions=_conditions(),
        planner_outcome=PlannerOutcome(
            public_complete=False,
            shadow_depot_complete=False,
            blocking_reason="no_charger_in_radius",
            soc_deficit_kwh=25.0,
        ),
    )
    assert result.tier == "infrastructure_gap"
    assert result.verdict == "infeasible"
    assert result.blocking_reason == "no_charger_in_radius"


def test_greedy_assumption_entry():
    assumptions = get_charging_assumptions()
    assert len(assumptions) >= 1
    text = " ".join(
        f"{entry.field} {getattr(entry, 'note', '')} {entry.source}" for entry in assumptions
    )
    assert "0.4" in text or "time" in text.lower()
    assert "0.35" in text or "energy" in text.lower()
    assert "0.25" in text or "cost" in text.lower()
    assert "greedy" in text.lower() or "first-feasible" in text.lower()
