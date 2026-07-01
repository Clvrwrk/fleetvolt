"""Weather preset adjustments for physics pipeline (D-09)."""

from __future__ import annotations

from dataclasses import dataclass

from app.simulation.physics_engine import TruckParams, air_density
from app.simulation.schemas import ConditionsSpec, WeatherPreset

WEATHER_PRESETS: dict[str, dict[str, float]] = {
    "ideal": {"temp_c": 20, "headwind_mph": 0, "thermal_factor": 1.0, "aux_mult": 1.0},
    "hot": {"temp_c": 35, "headwind_mph": 0, "thermal_factor": 0.94, "aux_mult": 1.15},
    "cold": {"temp_c": 0, "headwind_mph": 0, "thermal_factor": 0.92, "aux_mult": 1.5},
    "headwind": {"temp_c": 20, "headwind_mph": 15, "thermal_factor": 1.0, "aux_mult": 1.0},
}


@dataclass(frozen=True)
class WeatherAdjustment:
    """Per-run weather multipliers applied before segment force computation."""

    rho: float
    thermal_factor: float
    aux_mult: float
    headwind_mph: float
    temp_c: float


def apply_weather(truck: TruckParams, conditions: ConditionsSpec) -> WeatherAdjustment:
    """Return weather-adjusted air density and multipliers for physics_engine."""
    _ = truck  # reserved for truck-specific thermal curves in future plans
    preset = WEATHER_PRESETS[conditions.weather_preset.value]
    temp_c = float(preset["temp_c"])
    return WeatherAdjustment(
        rho=air_density(temp_c),
        thermal_factor=float(preset["thermal_factor"]),
        aux_mult=float(preset["aux_mult"]),
        headwind_mph=float(preset["headwind_mph"]),
        temp_c=temp_c,
    )
