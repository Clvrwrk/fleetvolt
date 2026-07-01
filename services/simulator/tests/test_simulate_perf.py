"""Simulation performance smoke tests (ROUT-04)."""

from __future__ import annotations

import sys
import time
from pathlib import Path
from unittest.mock import MagicMock

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from alembic.config import Config  # noqa: E402
from alembic import command  # noqa: E402
from data.ingest.elevation import build_profile_from_fixture, precompute_all  # noqa: E402
from data.ingest.seed_trucks import seed_trucks  # noqa: E402

from app.simulation.elevation_service import ElevationProfileResult, ElevationService  # noqa: E402
from app.simulation.orchestrator import run_simulation  # noqa: E402
from app.simulation.route_provider import RouteGeometry, RouteProvider  # noqa: E402
from app.simulation.schemas import ConditionsSpec, RouteSpec, SimulateRequest, TruckSpec  # noqa: E402


@pytest.fixture
def perf_db(db_session):
    alembic_cfg = Config(str(REPO_ROOT / "services" / "simulator" / "alembic.ini"))
    alembic_cfg.set_main_option(
        "script_location",
        str(REPO_ROOT / "services" / "simulator" / "alembic"),
    )
    command.upgrade(alembic_cfg, "head")
    seed_trucks(db_session)
    precompute_all(db_session, use_fixture=True)
    db_session.commit()
    return db_session


def _polb_cajon_mocks() -> tuple[RouteProvider, ElevationService]:
    coordinates, profile = build_profile_from_fixture("polb_cajon_pass")
    dist_m = float(profile[-1]["dist_m"])

    mock_route = MagicMock(spec=RouteProvider)
    mock_route.get_route.return_value = RouteGeometry(
        distance_m=dist_m,
        duration_s=3600.0,
        coordinates=coordinates,
    )
    mock_route.get_edge_speeds.return_value = []

    mock_elevation = MagicMock(spec=ElevationService)
    mock_elevation.get_profile.return_value = ElevationProfileResult(
        profile=profile,
        max_grade_pct=max(
            abs((profile[i + 1]["elev_m"] - profile[i]["elev_m"]) / max(profile[i + 1]["dist_m"] - profile[i]["dist_m"], 1) * 100)
            for i in range(len(profile) - 1)
        ),
        source="perf-fixture",
        corridor_key="polb_cajon_pass",
    )
    return mock_route, mock_elevation


def test_simulate_perf_fixture(perf_db, monkeypatch: pytest.MonkeyPatch):
    """ROUT-04: fixture-based simulate completes under 10s without Valhalla."""
    mock_route, mock_elevation = _polb_cajon_mocks()
    monkeypatch.setattr(
        "app.simulation.orchestrator.RouteProvider",
        lambda *args, **kwargs: mock_route,
    )
    monkeypatch.setattr(
        "app.simulation.orchestrator.ElevationService",
        lambda *args, **kwargs: mock_elevation,
    )

    request = SimulateRequest(
        route=RouteSpec(corridor_key="polb_cajon_pass"),
        truck=TruckSpec(slug="ecascadia_438"),
        conditions=ConditionsSpec(payload_lbs=45000, port_drayage_enabled=False),
    )

    start = time.perf_counter()
    response = run_simulation(perf_db, request)
    elapsed = time.perf_counter() - start

    assert response.kpis.total_kwh > 0
    assert elapsed < 10.0, f"simulate took {elapsed:.2f}s, exceeds 10s ROUT-04 cap"


@pytest.mark.integration
def test_simulate_perf_integration(perf_db):
    """Optional live stack timing when Valhalla and DB are available."""
    from fastapi.testclient import TestClient

    from app.db import get_db
    from app.main import app

    def override_get_db():
        try:
            yield perf_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)

    body = {
        "route": {"corridor_key": "polb_cajon_pass"},
        "truck": {"slug": "ecascadia_438"},
        "conditions": {
            "weather_preset": "ideal",
            "payload_lbs": 45000,
            "port_drayage_enabled": False,
        },
        "overrides": {},
    }

    try:
        start = time.perf_counter()
        response = test_client.post("/v1/simulate", json=body)
        elapsed = time.perf_counter() - start
    finally:
        app.dependency_overrides.clear()

    if response.status_code == 503:
        pytest.skip("Valhalla or simulator stack unavailable")

    assert response.status_code == 200, response.text
    assert elapsed < 10.0, f"live simulate took {elapsed:.2f}s"
