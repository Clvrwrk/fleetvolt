"""Pydantic request/response models for POST /v1/simulate (D-03, D-04)."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, model_validator


class WeatherPreset(str, Enum):
    ideal = "ideal"
    hot = "hot"
    cold = "cold"
    headwind = "headwind"


class LatLon(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class RouteSpec(BaseModel):
    """Route selection: corridor preset, custom O/D, or terminal origin."""

    corridor_key: str | None = None
    origin: LatLon | None = None
    dest: LatLon | None = None
    terminal_key: str | None = None

    @model_validator(mode="after")
    def validate_route_mode(self) -> RouteSpec:
        has_corridor = self.corridor_key is not None
        has_od = self.origin is not None and self.dest is not None
        has_terminal = self.terminal_key is not None

        modes = sum([has_corridor, has_od, has_terminal])
        if modes != 1:
            raise ValueError(
                "Provide exactly one of: corridor_key, origin+dest pair, or terminal_key"
            )
        return self


class TruckSpec(BaseModel):
    slug: str = Field(
        min_length=1,
        description="Truck config slug matching data/trucks/{slug}.json",
    )


class ConditionsSpec(BaseModel):
    weather_preset: WeatherPreset = WeatherPreset.ideal
    payload_lbs: float = Field(default=0, ge=0, le=80000)
    port_drayage_enabled: bool = False


class OverridesSpec(BaseModel):
    """Inline physics overrides — expanded in Plan 04."""

    model_config = {"extra": "allow"}


class SimulateRequest(BaseModel):
    route: RouteSpec
    truck: TruckSpec
    conditions: ConditionsSpec = Field(default_factory=ConditionsSpec)
    overrides: OverridesSpec = Field(default_factory=OverridesSpec)


class SegmentResult(BaseModel):
    dist_m: float
    grade: float
    speed: float
    energy_kwh: float
    soc_pct: float


class KpiResult(BaseModel):
    total_kwh: float
    wh_per_mi: float
    regen_kwh: float
    total_time_s: float


class SimulateResponse(BaseModel):
    segments: list[SegmentResult]
    kpis: KpiResult
    disclaimer: str
    assumptions: list[str] = Field(default_factory=list)
    corridor_key: str | None = None
    truck_slug: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
