"""Async simulation job worker and enqueue tests (PLAT-02)."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.ingest.elevation import precompute_all  # noqa: E402
from data.ingest.seed_trucks import seed_trucks  # noqa: E402

from app.main import app  # noqa: E402
from app.simulation.elevation_service import ElevationProfileResult  # noqa: E402
from app.simulation.inputs_hash import (  # noqa: E402
    CHARGER_VERSION,
    PHYSICS_VERSION,
    compute_inputs_hash,
)
from app.simulation.route_provider import RouteGeometry  # noqa: E402
from app.worker import execute_simulation_run  # noqa: E402

MOCK_ROUTE = RouteGeometry(
    distance_m=50_000.0,
    duration_s=3600.0,
    coordinates=[
        [-118.216, 33.754],
        [-117.9, 33.9],
        [-117.5, 34.0],
    ],
)

MOCK_ELEVATION = ElevationProfileResult(
    profile=[
        {"dist_m": 0.0, "elev_m": 10.0},
        {"dist_m": 25_000.0, "elev_m": 50.0},
        {"dist_m": 50_000.0, "elev_m": 20.0},
    ],
    max_grade_pct=0.16,
    source="test",
    corridor_key=None,
)


def _corridor_inputs() -> dict:
    return {
        "route": {"corridor_key": "polb_cajon_pass"},
        "truck": {"slug": "ecascadia_438"},
        "conditions": {
            "weather_preset": "ideal",
            "payload_lbs": 34000,
            "port_drayage_enabled": False,
        },
        "overrides": {},
        "options": {"include_charging": True},
    }


@pytest.fixture
def simulate_db(db_session):
    from alembic.config import Config

    from alembic import command

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


@pytest.fixture
def client(simulate_db):
    from app.db import get_db

    def override_get_db():
        try:
            yield simulate_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def _insert_pending_run(db, inputs: dict | None = None) -> str:
    run_id = str(uuid.uuid4())
    scenario = inputs or _corridor_inputs()
    inputs_hash = compute_inputs_hash(scenario, PHYSICS_VERSION, CHARGER_VERSION)
    db.execute(
        text(
            """
            INSERT INTO simulation_runs (
                id, inputs, inputs_hash, status, physics_version, charger_version
            )
            VALUES (
                CAST(:id AS uuid),
                CAST(:inputs AS jsonb),
                :inputs_hash,
                'PENDING',
                :physics_version,
                :charger_version
            )
            """
        ),
        {
            "id": run_id,
            "inputs": __import__("json").dumps(scenario),
            "inputs_hash": inputs_hash,
            "physics_version": PHYSICS_VERSION,
            "charger_version": CHARGER_VERSION,
        },
    )
    db.commit()
    return run_id


def test_worker_task_completes_row(simulate_db, monkeypatch: pytest.MonkeyPatch):
    mock_route_provider = MagicMock()
    mock_route_provider.get_route.return_value = MOCK_ROUTE
    mock_route_provider.get_edge_speeds.return_value = []

    mock_elevation = MagicMock()
    mock_elevation.get_profile.return_value = MOCK_ELEVATION

    class _SessionWrapper:
        def __init__(self, session):
            self._session = session

        def execute(self, *args, **kwargs):
            return self._session.execute(*args, **kwargs)

        def commit(self):
            return self._session.commit()

        def close(self):
            return None

    monkeypatch.setattr(
        "app.worker.SessionLocal",
        lambda: _SessionWrapper(simulate_db),
    )
    monkeypatch.setattr(
        "app.simulation.orchestrator.RouteProvider",
        lambda *args, **kwargs: mock_route_provider,
    )
    monkeypatch.setattr(
        "app.simulation.orchestrator.ElevationService",
        lambda *args, **kwargs: mock_elevation,
    )
    monkeypatch.setattr(
        "app.simulation.charging_planner.search_hd_chargers",
        lambda db, lat, lon, radius_m: [],
    )
    monkeypatch.setattr(
        "app.simulation.charging_planner.detour_seconds",
        lambda *a, **k: 9999.0,
    )

    run_id = _insert_pending_run(simulate_db)
    execute_simulation_run(run_id)

    row = (
        simulate_db.execute(
            text(
                """
                SELECT status, outputs
                FROM simulation_runs
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"id": run_id},
        )
        .mappings()
        .first()
    )
    assert row is not None
    assert row["status"] == "COMPLETE"
    outputs = row["outputs"]
    assert "segments" in outputs
    assert "charging_stops" in outputs
    assert "feasibility" in outputs
    assert outputs["feasibility"]["verdict"] in {"feasible", "critical", "infeasible"}


def test_enqueue_pending_run(client: TestClient, simulate_db, monkeypatch: pytest.MonkeyPatch):
    delayed: list[str] = []

    def fake_delay(run_id: str) -> None:
        delayed.append(run_id)

    monkeypatch.setattr("app.routes.simulations.run_simulation_task.delay", fake_delay)

    run_id = _insert_pending_run(simulate_db)
    response = client.post(
        f"/v1/internal/jobs/{run_id}/enqueue",
        json={"inputs": _corridor_inputs()},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["enqueued"] is True
    assert payload["run_id"] == run_id
    assert delayed == [run_id]


@pytest.mark.integration
def test_enqueue_to_worker_lifecycle(client: TestClient, simulate_db):
    """Full HTTP enqueue + Celery worker path — requires Redis (Plan 05)."""
    run_id = _insert_pending_run(simulate_db)
    response = client.post(
        f"/v1/internal/jobs/{run_id}/enqueue",
        json={"inputs": _corridor_inputs()},
    )
    assert response.status_code == 200
