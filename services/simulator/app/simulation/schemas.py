"""Pydantic request/response models for POST /v1/simulate (D-03, D-04)."""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

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


class ChargingConditionsSpec(BaseModel):
    """Charging planner thresholds (D-08, D-09, D-15)."""

    soc_trigger_pct: float = Field(default=18.0, ge=0, le=100)
    soc_floor_pct: float = Field(default=10.0, ge=0, le=100)
    target_soc_pct: float = Field(default=80.0, ge=0, le=100)
    min_arrival_soc_pct: float = Field(default=10.0, ge=0, le=100)


class ConditionsSpec(BaseModel):
    weather_preset: WeatherPreset = WeatherPreset.ideal
    payload_lbs: float = Field(default=0, ge=0, le=80000)
    port_drayage_enabled: bool = False
    charging: ChargingConditionsSpec = Field(default_factory=ChargingConditionsSpec)


class AssumptionEntry(BaseModel):
    """Single physics parameter audit record for consulting deliverables (D-14)."""

    field: str
    value: float
    source: str = Field(description="oem_default or user_override")
    oem_default: float
    category: str | None = None
    note: str | None = None


class OverridesSpec(BaseModel):
    """Inline physics overrides with ±20% OEM bounds (D-14)."""

    reset_to_oem: bool = False
    C_rr: float | None = Field(default=None, gt=0)
    drag_coefficient: float | None = Field(default=None, gt=0)
    usable_kwh: float | None = Field(default=None, gt=0)
    aux_kw_base: float | None = Field(default=None, gt=0)
    regen_efficiency: float | None = Field(default=None, gt=0, le=1)


class SimulateOptions(BaseModel):
    include_charging: bool = Field(default=True, description="Run greedy charging planner (D-02)")


class SimulateRequest(BaseModel):
    route: RouteSpec
    truck: TruckSpec
    conditions: ConditionsSpec = Field(default_factory=ConditionsSpec)
    overrides: OverridesSpec = Field(default_factory=OverridesSpec)
    options: SimulateOptions = Field(default_factory=SimulateOptions)


class SegmentResult(BaseModel):
    dist_m: float
    grade: float
    speed: float
    energy_kwh: float
    soc_pct: float
    charging_event: bool = False
    stop_sequence: int | None = None


class KpiResult(BaseModel):
    total_kwh: float
    wh_per_mi: float
    regen_kwh: float
    total_time_s: float


class ChargingStopResult(BaseModel):
    """Recommended HD charging stop (D-21)."""

    station_id: str
    name: str | None = None
    lat: float
    lon: float
    power_kw: float
    arrival_soc_pct: float
    departure_soc_pct: float
    dwell_s: float
    energy_added_kwh: float
    detour_s: float


class FeasibilityResult(BaseModel):
    """Three-tier feasibility verdict with infrastructure framing (D-10, D-22)."""

    verdict: Literal["feasible", "critical", "infeasible"]
    tier: Literal["public_hd", "depot_required", "infrastructure_gap"]
    soc_deficit_kwh: float | None = None
    blocking_reason: Literal[
        "no_charger_in_radius", "detour_exceeded", "cannot_reach_destination"
    ] | None = None
    stop_count: int = 0


class SimulateResponse(BaseModel):
    segments: list[SegmentResult]
    kpis: KpiResult
    disclaimer: str
    assumptions: list[AssumptionEntry] = Field(default_factory=list)
    corridor_key: str | None = None
    truck_slug: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    charging_stops: list[ChargingStopResult] | None = None
    feasibility: FeasibilityResult | None = None


JobStatus = Literal["PENDING", "RUNNING", "COMPLETE", "FAILED"]


class SimulationJobSubmitResponse(BaseModel):
    """POST /v1/simulations response (PLAT-02, D-01) — implemented on API gateway."""

    job_id: str
    status: JobStatus
    outputs: SimulateResponse | None = None
    inputs_hash: str | None = None
    physics_version: str | None = None
    charger_version: str | None = None
    inputs: dict[str, Any] | None = None


class SimulationJobPollResponse(BaseModel):
    """GET /v1/simulations/{id} response (PLAT-02, D-01) — implemented on API gateway."""

    job_id: str
    status: JobStatus
    outputs: SimulateResponse | None = None
    error: dict[str, Any] | None = None
    duration_ms: int | None = None
    inputs_hash: str | None = None
    physics_version: str | None = None
    charger_version: str | None = None
    inputs: dict[str, Any] | None = None


class PdfExportRequest(BaseModel):
    """POST /v1/exports/pdf request body (EXPR-02, D-23) — implemented on API gateway."""

    job_id: str = Field(description="Simulation run UUID")
    map_snapshot_base64: str | None = Field(
        default=None,
        description="Optional PNG map snapshot as base64 (no data: prefix)",
    )


class ValidationCaseResult(BaseModel):
    """Single OEM reference case MAPE result."""

    name: str
    expected_kwh: float
    actual_kwh: float
    mape_pct: float
    pass_: bool = Field(alias="pass", description="True when MAPE is within ±8–12% band")

    model_config = {"populate_by_name": True}


class ValidationResponse(BaseModel):
    """Aggregate validation gate response for GET /v1/physics/validation."""

    cases: list[ValidationCaseResult]
    overall_pass: bool
