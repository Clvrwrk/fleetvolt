"""Unit tests for physics engine force balance and SoC integration (PHYS-02, PHYS-05)."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from app.simulation.constants import G, MPS_PER_MPH, US_MILE_M
from app.simulation.physics_engine import (
    TruckParams,
    air_density,
    force_components,
    segment_forces,
)
from app.simulation.soc_integrator import integrate_soc
from app.simulation.kpi_aggregator import aggregate_kpis

PROJECT_ROOT = Path(__file__).resolve().parents[3]
REFERENCE_CASES_PATH = PROJECT_ROOT / "data" / "validation" / "reference_cases.json"


@pytest.fixture
def ecascadia_truck() -> TruckParams:
    truck_json = json.loads(
        (PROJECT_ROOT / "data" / "trucks" / "ecascadia_438.json").read_text()
    )
    return TruckParams(
        usable_kwh=truck_json["usable_kwh"],
        curb_weight_lbs=truck_json["curb_weight_lbs"],
        payload_lbs=45_000,
        C_rr=truck_json["C_rr"],
        drag_coefficient=truck_json["drag_coefficient"],
        frontal_area_m2=truck_json["frontal_area_m2"],
        regen_efficiency=truck_json["regen_efficiency"],
        aux_kw_base=truck_json["aux_kw_base"],
        drivetrain_efficiency=truck_json["drivetrain_efficiency"],
    )


def test_constants_exports():
    assert G == pytest.approx(9.80665)
    assert MPS_PER_MPH == pytest.approx(0.44704)
    assert US_MILE_M == pytest.approx(1609.344)


def test_reference_cases_fixture():
    payload = json.loads(REFERENCE_CASES_PATH.read_text())
    assert "flat_highway_oem" in payload["cases"]
    assert "polb_cajon_grade" in payload["cases"]
    assert payload["cases"]["polb_cajon_grade"]["corridor_key"] == "polb_cajon_pass"


def test_flat_segment_rolling_resistance_dominates(ecascadia_truck: TruckParams):
    """On zero-grade flat highway, rolling resistance exceeds aero at moderate speed."""
    dist_m = np.array([US_MILE_M * 10])
    grade_pct = np.array([0.0])
    speed_mph = np.array([40.0])
    rho = air_density(20.0)

    f_roll, f_aero, f_grade = force_components(
        grade_pct, speed_mph, ecascadia_truck.mass_kg, ecascadia_truck.C_rr,
        ecascadia_truck.drag_coefficient, ecascadia_truck.frontal_area_m2, rho,
    )

    assert f_grade[0] == pytest.approx(0.0, abs=1e-6)
    assert abs(f_roll[0]) > abs(f_aero[0])

    p_traction, _p_aux = segment_forces(
        dist_m, grade_pct, speed_mph, ecascadia_truck, temp_c=20.0,
    )
    assert p_traction[0] > 0


def test_regen_capped_on_steep_downhill(ecascadia_truck: TruckParams):
    """Regen power is capped at regen_power_cap_kw on long steep descent."""
    dist_m = np.array([5000.0])
    grade_pct = np.array([-8.0])
    speed_mph = np.array([45.0])

    p_traction, p_aux = segment_forces(
        dist_m, grade_pct, speed_mph, ecascadia_truck, temp_c=20.0,
    )
    assert p_traction[0] < 0

    result = integrate_soc(
        p_traction, p_aux, dist_m, speed_mph, ecascadia_truck, initial_soc_pct=50.0,
    )
    dt_s = dist_m[0] / (speed_mph[0] * MPS_PER_MPH)
    max_regen_kwh = (
        ecascadia_truck.regen_power_cap_kw * 1000
        * ecascadia_truck.regen_efficiency
        * dt_s
        / 3_600_000
    )
    assert result["regen_kwh"][0] <= max_regen_kwh * 1.001


def test_soc_decreases_monotonically_uphill(ecascadia_truck: TruckParams):
    """SoC decreases on uphill-only route without charging."""
    n = 5
    dist_m = np.full(n, US_MILE_M * 2)
    grade_pct = np.full(n, 4.0)
    speed_mph = np.full(n, 45.0)

    p_traction, p_aux = segment_forces(
        dist_m, grade_pct, speed_mph, ecascadia_truck, temp_c=20.0,
    )
    assert np.all(p_traction > 0)

    result = integrate_soc(
        p_traction, p_aux, dist_m, speed_mph, ecascadia_truck, initial_soc_pct=100.0,
    )
    soc = result["soc_pct"]
    for i in range(1, len(soc)):
        assert soc[i] < soc[i - 1]


def test_kpi_aggregator_hand_calc(ecascadia_truck: TruckParams):
    """KPI totals match hand-calculated fixture within 1%."""
    dist_m = np.array([US_MILE_M * 10])
    grade_pct = np.array([0.0])
    speed_mph = np.array([55.0])

    p_traction, p_aux = segment_forces(
        dist_m, grade_pct, speed_mph, ecascadia_truck, temp_c=20.0,
    )
    soc_result = integrate_soc(
        p_traction, p_aux, dist_m, speed_mph, ecascadia_truck,
    )
    kpis = aggregate_kpis(
        soc_result["energy_kwh"],
        soc_result["regen_kwh"],
        dist_m,
        speed_mph,
    )

    dt_s = dist_m[0] / (speed_mph[0] * MPS_PER_MPH)
    gross_w = p_traction[0] / ecascadia_truck.drivetrain_efficiency + p_aux[0]
    expected_kwh = gross_w * dt_s / 3_600_000
    expected_time_s = dt_s
    expected_wh_per_mi = expected_kwh / (dist_m[0] / US_MILE_M) * 1000

    assert kpis["total_kwh"] == pytest.approx(expected_kwh, rel=0.01)
    assert kpis["wh_per_mi"] == pytest.approx(expected_wh_per_mi, rel=0.01)
    assert kpis["regen_kwh"] == pytest.approx(0.0, abs=1e-9)
    assert kpis["total_time_s"] == pytest.approx(expected_time_s, rel=0.01)
