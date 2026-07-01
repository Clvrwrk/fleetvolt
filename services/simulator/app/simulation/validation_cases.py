"""OEM validation reference cases and MAPE gate (D-11, PHYS-06)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

from sqlalchemy.orm import Session

from app.simulation.constants import US_MILE_M
from app.simulation.elevation_service import ElevationProfileResult, ElevationService
from app.simulation.orchestrator import run_simulation
from app.simulation.route_provider import EdgeSpeed, RouteGeometry, RouteProvider
from app.simulation.schemas import (
    ConditionsSpec,
    RouteSpec,
    SimulateRequest,
    TruckSpec,
    ValidationCaseResult,
    ValidationResponse,
    WeatherPreset,
)

REPO_ROOT = Path(__file__).resolve().parents[4]
REFERENCE_CASES_PATH = REPO_ROOT / "data" / "validation" / "reference_cases.json"


def load_reference_cases(path: Path = REFERENCE_CASES_PATH) -> dict[str, Any]:
    """Load D-11 reference case definitions from disk."""
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def mape_pct(actual_kwh: float, expected_kwh: float) -> float:
    """Mean absolute percentage error on total energy."""
    if expected_kwh <= 0:
        raise ValueError("expected_kwh must be positive")
    return abs(actual_kwh - expected_kwh) / expected_kwh * 100.0


def validation_pass(mape: float, lo: float = 8.0, hi: float = 12.0) -> bool:
    """Pass when MAPE falls within the documented ±8–12% calibration band."""
    return lo <= mape <= hi


def _resolve_expected_kwh(case: dict[str, Any]) -> float:
    expected = case["expected_total_kwh"]
    if isinstance(expected, list):
        return (float(expected[0]) + float(expected[1])) / 2.0
    return float(expected)


def _flat_highway_mocks(case: dict[str, Any]) -> tuple[RouteProvider, ElevationService]:
    """Synthetic flat route with fixture elevation — no Valhalla or HTTP."""
    distance_mi = float(case["distance_mi"])
    speed_mph = float(case["speed_mph"])
    dist_m = distance_mi * US_MILE_M
    num_points = 64
    coords = [[-118.0 + i / (num_points - 1), 34.0] for i in range(num_points)]
    profile = [
        {"dist_m": i * dist_m / (num_points - 1), "elev_m": 100.0}
        for i in range(num_points)
    ]

    mock_route = MagicMock(spec=RouteProvider)
    mock_route.get_route.return_value = RouteGeometry(
        distance_m=dist_m,
        duration_s=dist_m / (speed_mph * 0.44704),
        coordinates=coords,
    )
    mock_route.get_edge_speeds.return_value = [
        EdgeSpeed(start_m=0.0, edge_length_m=dist_m, speed_limit_mph=speed_mph)
    ]

    mock_elevation = MagicMock(spec=ElevationService)
    mock_elevation.get_profile.return_value = ElevationProfileResult(
        profile=profile,
        max_grade_pct=0.0,
        source="validation-fixture",
        corridor_key=None,
    )
    return mock_route, mock_elevation


def _build_simulate_request(name: str, case: dict[str, Any]) -> SimulateRequest:
    conditions = ConditionsSpec(
        weather_preset=WeatherPreset(case.get("weather_preset", "ideal")),
        payload_lbs=float(case.get("payload_lbs", 0)),
        port_drayage_enabled=False,
    )
    truck = TruckSpec(slug=case["truck_id"])

    if name == "flat_highway_oem":
        return SimulateRequest(
            route=RouteSpec(origin={"lat": 34.0, "lon": -118.0}, dest={"lat": 34.0, "lon": -117.0}),
            truck=truck,
            conditions=conditions,
        )

    if case.get("corridor_key"):
        return SimulateRequest(
            route=RouteSpec(corridor_key=case["corridor_key"]),
            truck=truck,
            conditions=conditions,
        )

    raise ValueError(f"Unsupported reference case: {name}")


def run_validation_case(
    db: Session,
    name: str,
    case: dict[str, Any],
) -> ValidationCaseResult:
    """Run one reference case through the simulation orchestrator."""
    request = _build_simulate_request(name, case)
    expected_kwh = _resolve_expected_kwh(case)
    lo, hi = (float(x) for x in case.get("tolerance_mape_pct", [8, 12]))

    route_provider: RouteProvider | None = None
    elevation_service: ElevationService | None = None
    if name == "flat_highway_oem":
        route_provider, elevation_service = _flat_highway_mocks(case)

    response = run_simulation(
        db,
        request,
        route_provider=route_provider,
        elevation_service=elevation_service,
    )
    actual_kwh = response.kpis.total_kwh
    mape = mape_pct(actual_kwh, expected_kwh)

    return ValidationCaseResult(
        name=name,
        expected_kwh=round(expected_kwh, 2),
        actual_kwh=round(actual_kwh, 2),
        mape_pct=round(mape, 2),
        pass_=validation_pass(mape, lo, hi),
    )


def run_all_validation(db: Session) -> ValidationResponse:
    """Execute all D-11 reference cases and return aggregate pass/fail."""
    payload = load_reference_cases()
    results = [
        run_validation_case(db, name, case)
        for name, case in payload["cases"].items()
    ]
    return ValidationResponse(
        cases=results,
        overall_pass=all(c.pass_ for c in results),
    )
