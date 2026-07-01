"""Weather preset sensitivity tests (PHYS-04, D-09)."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from app.simulation.constants import US_MILE_M
from app.simulation.kpi_aggregator import aggregate_kpis
from app.simulation.physics_engine import TruckParams, segment_forces
from app.simulation.schemas import ConditionsSpec, WeatherPreset
from app.simulation.soc_integrator import integrate_soc
from app.simulation.weather import apply_weather

PROJECT_ROOT = Path(__file__).resolve().parents[3]


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


def _wh_per_mi_for_preset(truck: TruckParams, preset: WeatherPreset) -> float:
    """Flat 10-mile segment at 55 mph for preset comparison."""
    dist_m = np.array([US_MILE_M * 10])
    grade_pct = np.array([0.0])
    speed_mph = np.array([55.0])

    conditions = ConditionsSpec(weather_preset=preset)
    weather = apply_weather(truck, conditions)
    aux_kw = truck.aux_kw_base * weather.aux_mult

    p_traction, p_aux = segment_forces(
        dist_m,
        grade_pct,
        speed_mph,
        truck,
        rho=weather.rho,
        headwind_mph=weather.headwind_mph,
        thermal_factor=weather.thermal_factor,
        aux_kw=aux_kw,
    )
    soc_result = integrate_soc(p_traction, p_aux, dist_m, speed_mph, truck)
    kpis = aggregate_kpis(
        soc_result["energy_kwh"],
        soc_result["regen_kwh"],
        dist_m,
        speed_mph,
    )
    return kpis["wh_per_mi"]


def test_weather_preset_table_matches_d09():
    from app.simulation.weather import WEATHER_PRESETS

    assert WEATHER_PRESETS["ideal"]["temp_c"] == 20
    assert WEATHER_PRESETS["hot"]["thermal_factor"] == pytest.approx(0.94)
    assert WEATHER_PRESETS["cold"]["aux_mult"] == pytest.approx(1.5)
    assert WEATHER_PRESETS["headwind"]["headwind_mph"] == 15


def test_cold_wh_per_mi_at_least_5pct_higher_than_ideal(ecascadia_truck: TruckParams):
    ideal = _wh_per_mi_for_preset(ecascadia_truck, WeatherPreset.ideal)
    cold = _wh_per_mi_for_preset(ecascadia_truck, WeatherPreset.cold)
    assert cold >= ideal * 1.05, f"cold={cold:.1f} ideal={ideal:.1f}"


def test_headwind_wh_per_mi_higher_than_ideal(ecascadia_truck: TruckParams):
    ideal = _wh_per_mi_for_preset(ecascadia_truck, WeatherPreset.ideal)
    headwind = _wh_per_mi_for_preset(ecascadia_truck, WeatherPreset.headwind)
    assert headwind > ideal
