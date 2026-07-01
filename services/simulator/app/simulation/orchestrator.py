"""End-to-end simulation pipeline: route → elevation → physics → SoC → KPIs (D-01)."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.simulation.constants import US_MILE_M
from app.simulation.elevation_service import ElevationService, ElevationServiceError
from app.simulation.kpi_aggregator import aggregate_kpis
from app.simulation.physics_engine import TruckParams, segment_forces
from app.simulation.route_provider import RouteProvider
from app.simulation.overrides import apply_truck_overrides
from app.simulation.port_drayage import apply_port_drayage
from app.simulation.charging_planner import plan_greedy_stops
from app.simulation.feasibility import (
    classify_feasibility,
    get_charging_assumptions,
    planner_outcome_from_status,
    shadow_pass_depot_at_origin,
)
from app.simulation.schemas import (
    ChargingStopResult,
    ConditionsSpec,
    FeasibilityResult,
    KpiResult,
    SegmentResult,
    SimulateRequest,
    SimulateResponse,
)
from app.simulation.segment_builder import build_segments
from app.simulation.soc_integrator import integrate_soc
from app.simulation.speed_resolver import TruckSpeedParams, resolve_speeds
from app.simulation.weather import apply_weather

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[4]
CORRIDORS_DIR = REPO_ROOT / "data" / "corridors"
TERMINALS_PATH = REPO_ROOT / "data" / "terminals" / "polb_terminals.json"
TRUCKS_DIR = REPO_ROOT / "data" / "trucks"

MAX_ROUTE_MI = 800.0
MAX_ROUTE_M = MAX_ROUTE_MI * US_MILE_M

DISCLAIMER = (
    "Planning and feasibility tool only — not real-time dispatch guidance. "
    "Results depend on OEM assumptions, cached elevation, and posted speed limits. "
    "Verify against manufacturer claims before stakeholder decisions."
)


def _load_corridor_fixture(corridor_key: str) -> dict[str, Any]:
    path = CORRIDORS_DIR / f"{corridor_key}.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"Unknown corridor preset: {corridor_key}")
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _load_terminals() -> list[dict[str, Any]]:
    if not TERMINALS_PATH.is_file():
        return []
    with TERMINALS_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload if isinstance(payload, list) else []


def _terminal_by_key(terminal_key: str) -> dict[str, Any]:
    for terminal in _load_terminals():
        if terminal.get("terminal_key") == terminal_key:
            return terminal
    raise HTTPException(status_code=404, detail=f"Unknown terminal preset: {terminal_key}")


def _synthetic_coordinates(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    *,
    num_points: int = 32,
) -> list[list[float]]:
    """Linear lon/lat interpolation for corridor preset geometry."""
    if num_points < 2:
        num_points = 2
    coords: list[list[float]] = []
    for i in range(num_points):
        t = i / (num_points - 1)
        lon = origin_lon + t * (dest_lon - origin_lon)
        lat = origin_lat + t * (dest_lat - origin_lat)
        coords.append([lon, lat])
    return coords


def _load_truck_params(
    db: Session,
    slug: str,
    conditions: ConditionsSpec,
) -> tuple[TruckParams, dict[str, Any], dict[str, Any]]:
    truck_path = TRUCKS_DIR / f"{slug}.json"
    if not truck_path.is_file():
        raise HTTPException(status_code=404, detail=f"Unknown truck slug: {slug}")

    with truck_path.open(encoding="utf-8") as handle:
        file_payload = json.load(handle)
    model_name = file_payload["name"]

    row = db.execute(
        text(
            """
            SELECT params
            FROM truck_configs
            WHERE model_name = :model_name AND is_active = true
            LIMIT 1
            """
        ),
        {"model_name": model_name},
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Truck config not seeded: {slug}")

    params = row.params
    truck = TruckParams(
        usable_kwh=float(params["usable_kwh"]),
        curb_weight_lbs=float(params.get("curb_weight_lbs", file_payload.get("curb_weight_lbs", 26000))),
        payload_lbs=float(conditions.payload_lbs),
        C_rr=float(params.get("C_rr", file_payload.get("C_rr", 0.0065))),
        drag_coefficient=float(params.get("drag_coefficient", file_payload.get("drag_coefficient", 0.65))),
        frontal_area_m2=float(params.get("frontal_area_m2", file_payload.get("frontal_area_m2", 9.8))),
        regen_efficiency=float(params.get("regen_efficiency", file_payload.get("regen_efficiency", 0.70))),
        regen_power_cap_kw=float(params.get("regen_power_cap_kw", 350.0)),
        regen_soc_cutoff=float(params.get("regen_soc_cutoff", 90.0)),
        aux_kw_base=float(params.get("aux_kw_base", file_payload.get("aux_kw_base", 10.0))),
        drivetrain_efficiency=float(
            params.get("drivetrain_efficiency", file_payload.get("drivetrain_efficiency", 0.92))
        ),
    )
    return truck, params, file_payload


def _resolve_endpoints(request: SimulateRequest) -> tuple[float, float, float, float, str | None]:
    route = request.route
    if route.corridor_key:
        fixture = _load_corridor_fixture(route.corridor_key)
        origin = fixture["origin"]
        dest = fixture["dest"]
        return float(origin[0]), float(origin[1]), float(dest[0]), float(dest[1]), route.corridor_key

    if route.terminal_key:
        terminal = _terminal_by_key(route.terminal_key)
        raise HTTPException(
            status_code=422,
            detail="terminal_key origin-only drayage requires destination — use corridor_key or origin/dest",
        )

    assert route.origin is not None and route.dest is not None
    return route.origin.lat, route.origin.lon, route.dest.lat, route.dest.lon, None


def run_simulation(
    db: Session,
    request: SimulateRequest,
    *,
    route_provider: RouteProvider | None = None,
    elevation_service: ElevationService | None = None,
) -> SimulateResponse:
    """Synchronous simulation pipeline per D-01."""
    provider = route_provider or RouteProvider()
    elevation = elevation_service or ElevationService(route_provider=provider)

    origin_lat, origin_lon, dest_lat, dest_lon, corridor_key = _resolve_endpoints(request)
    truck, oem_params, file_payload = _load_truck_params(db, request.truck.slug, request.conditions)
    truck, assumptions = apply_truck_overrides(
        truck,
        request.overrides,
        oem=oem_params,
        file_payload=file_payload,
    )
    weather = apply_weather(truck, request.conditions)

    try:
        if corridor_key:
            elev_result = elevation.get_profile(db, corridor_key=corridor_key)
            distance_m = float(elev_result.profile[-1]["dist_m"])
            coordinates = _synthetic_coordinates(origin_lat, origin_lon, dest_lat, dest_lon)
            edge_speeds: list = []
        else:
            geometry = provider.get_route(origin_lat, origin_lon, dest_lat, dest_lon)
            distance_m = geometry.distance_m
            coordinates = geometry.coordinates
            elev_result = elevation.get_profile(
                db,
                coordinates=coordinates,
                origin_lat=origin_lat,
                origin_lon=origin_lon,
                dest_lat=dest_lat,
                dest_lon=dest_lon,
            )
            try:
                edge_speeds = provider.get_edge_speeds(coordinates)
            except (RuntimeError, ValueError) as exc:
                logger.warning("trace_attributes unavailable, using default posted speeds: %s", exc)
                edge_speeds = []
    except ElevationServiceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if distance_m > MAX_ROUTE_M:
        raise HTTPException(
            status_code=422,
            detail=f"Route distance {distance_m / US_MILE_M:.1f} mi exceeds cap {MAX_ROUTE_MI} mi",
        )

    try:
        raw_segments = build_segments(distance_m, coordinates, elev_result.profile)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    speed_mph = resolve_speeds(raw_segments, edge_speeds, TruckSpeedParams())
    dist_m = np.array([s["dist_m"] for s in raw_segments], dtype=np.float64)
    grade_pct = np.array([s["grade_pct"] for s in raw_segments], dtype=np.float64)
    speed_arr = np.array(speed_mph, dtype=np.float64)

    aux_kw = np.full(len(raw_segments), truck.aux_kw_base * weather.aux_mult, dtype=np.float64)
    speed_arr, aux_kw = apply_port_drayage(
        raw_segments,
        speed_arr,
        aux_kw,
        enabled=request.conditions.port_drayage_enabled,
    )

    p_traction, p_aux = segment_forces(
        dist_m,
        grade_pct,
        speed_arr,
        truck,
        rho=weather.rho,
        headwind_mph=weather.headwind_mph,
        thermal_factor=weather.thermal_factor,
        aux_kw=aux_kw,
    )
    soc_result = integrate_soc(p_traction, p_aux, dist_m, speed_arr, truck)
    kpis_raw = aggregate_kpis(
        soc_result["energy_kwh"],
        soc_result["regen_kwh"],
        dist_m,
        speed_arr,
    )

    soc_working = np.array(soc_result["soc_pct"], dtype=np.float64, copy=True)
    charging_stops: list[ChargingStopResult] = []
    feasibility: FeasibilityResult | None = None
    stop_segment_indices: list[int] = []

    if request.options.include_charging:
        charge_curve = file_payload.get("charge_curve", [])
        stop_dicts, public_status = plan_greedy_stops(
            db,
            raw_segments,
            soc_working,
            coordinates,
            truck,
            charge_curve,
            request.conditions.charging,
            provider,
        )
        stop_segment_indices = [int(s.pop("segment_index", 0)) for s in stop_dicts]
        charging_stops = [ChargingStopResult(**stop) for stop in stop_dicts]

        shadow_complete: bool | None = None
        if not public_status.complete:
            shadow_complete = shadow_pass_depot_at_origin(
                db,
                raw_segments,
                soc_working,
                coordinates,
                truck,
                charge_curve,
                request.conditions.charging,
                provider,
            )

        planner_outcome = planner_outcome_from_status(
            public_status,
            shadow_depot_complete=shadow_complete,
        )
        feasibility = classify_feasibility(
            charging_stops,
            float(soc_working[-1]),
            request.conditions.charging,
            planner_outcome,
        )
        assumptions = assumptions + get_charging_assumptions()

    soc_for_segments = soc_working if request.options.include_charging else soc_result["soc_pct"]

    charging_by_segment: dict[int, int] = {
        idx: seq + 1 for seq, idx in enumerate(stop_segment_indices)
    }

    segments = [
        SegmentResult(
            dist_m=round(float(dist_m[i]), 2),
            grade=round(float(grade_pct[i]), 4),
            speed=round(float(speed_arr[i]), 2),
            energy_kwh=round(float(soc_result["energy_kwh"][i]), 4),
            soc_pct=round(float(soc_for_segments[i]), 2),
            charging_event=i in charging_by_segment,
            stop_sequence=charging_by_segment.get(i),
        )
        for i in range(len(raw_segments))
    ]

    response_kwargs: dict[str, Any] = {
        "segments": segments,
        "kpis": KpiResult(**kpis_raw),
        "disclaimer": DISCLAIMER,
        "assumptions": assumptions,
        "corridor_key": corridor_key,
        "truck_slug": request.truck.slug,
        "metadata": {
            "elevation_source": elev_result.source,
            "segment_count": len(segments),
            "weather_preset": request.conditions.weather_preset.value,
            "port_drayage_enabled": request.conditions.port_drayage_enabled,
            "payload_lbs": request.conditions.payload_lbs,
        },
    }

    if request.options.include_charging:
        response_kwargs["charging_stops"] = charging_stops
        response_kwargs["feasibility"] = feasibility

    return SimulateResponse(**response_kwargs)
