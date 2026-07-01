"""Simulate API contract tests (D-03, D-04)."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.ingest.elevation import precompute_all  # noqa: E402
from data.ingest.seed_trucks import seed_trucks  # noqa: E402

from app.main import app  # noqa: E402
from app.simulation.elevation_service import ElevationProfileResult  # noqa: E402
from app.simulation.route_provider import RouteGeometry  # noqa: E402

SEGMENT_KEYS = ("dist_m", "grade", "speed", "energy_kwh", "soc_pct")
KPI_KEYS = ("total_kwh", "wh_per_mi", "regen_kwh", "total_time_s")
CHARGING_STOP_KEYS = (
    "station_id",
    "lat",
    "lon",
    "power_kw",
    "arrival_soc_pct",
    "departure_soc_pct",
    "dwell_s",
    "energy_added_kwh",
    "detour_s",
)
FEASIBILITY_KEYS = ("verdict", "tier", "stop_count")

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


@pytest.fixture
def simulate_db(db_session):
    """Migrations, truck seeds, and corridor elevation cache."""
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


def _corridor_body() -> dict:
    return {
        "route": {"corridor_key": "polb_cajon_pass"},
        "truck": {"slug": "ecascadia_438"},
        "conditions": {
            "weather_preset": "ideal",
            "payload_lbs": 34000,
            "port_drayage_enabled": False,
        },
        "overrides": {},
        "options": {"include_charging": False},
    }


def _custom_od_body() -> dict:
    return {
        "route": {
            "origin": {"lat": 33.754, "lon": -118.216},
            "dest": {"lat": 34.108, "lon": -117.290},
        },
        "truck": {"slug": "ecascadia_438"},
        "conditions": {
            "weather_preset": "ideal",
            "payload_lbs": 34000,
            "port_drayage_enabled": False,
        },
        "overrides": {},
        "options": {"include_charging": False},
    }


def _assert_simulate_response(body: dict, *, include_charging: bool = False) -> None:
    assert "segments" in body
    assert len(body["segments"]) > 0
    for segment in body["segments"]:
        for key in SEGMENT_KEYS:
            assert key in segment, f"missing segment key {key}"
    assert "kpis" in body
    for key in KPI_KEYS:
        assert key in body["kpis"], f"missing kpi key {key}"
    assert "disclaimer" in body
    assert body["disclaimer"]
    assert "assumptions" in body
    assert isinstance(body["assumptions"], list)
    assert "job_id" not in body

    if include_charging:
        assert "charging_stops" in body
        assert isinstance(body["charging_stops"], list)
        for stop in body["charging_stops"]:
            for key in CHARGING_STOP_KEYS:
                assert key in stop, f"missing charging stop key {key}"
        assert "feasibility" in body
        feasibility = body["feasibility"]
        for key in FEASIBILITY_KEYS:
            assert key in feasibility, f"missing feasibility key {key}"
        assert feasibility["verdict"] in {"feasible", "critical", "infeasible"}
        assert feasibility["tier"] in {"public_hd", "depot_required", "infrastructure_gap"}
    else:
        assert "charging_stops" not in body or body.get("charging_stops") in (None, [])
        assert "feasibility" not in body or body.get("feasibility") is None


def test_simulate_corridor_preset_happy_path(client: TestClient):
    response = client.post("/v1/simulate", json=_corridor_body())
    assert response.status_code == 200, response.text
    _assert_simulate_response(response.json(), include_charging=False)


def test_simulate_custom_od_happy_path(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    mock_route_provider = MagicMock()
    mock_route_provider.get_route.return_value = MOCK_ROUTE
    mock_route_provider.get_edge_speeds.return_value = []

    mock_elevation = MagicMock()
    mock_elevation.get_profile.return_value = MOCK_ELEVATION

    monkeypatch.setattr(
        "app.simulation.orchestrator.RouteProvider",
        lambda *args, **kwargs: mock_route_provider,
    )
    monkeypatch.setattr(
        "app.simulation.orchestrator.ElevationService",
        lambda *args, **kwargs: mock_elevation,
    )

    response = client.post("/v1/simulate", json=_custom_od_body())
    assert response.status_code == 200, response.text
    _assert_simulate_response(response.json(), include_charging=False)


def test_overrides_audit(client: TestClient):
    body = _corridor_body()
    body["overrides"] = {"C_rr": 0.0070}
    response = client.post("/v1/simulate", json=body)
    assert response.status_code == 200, response.text
    assumptions = response.json()["assumptions"]
    c_rr_entries = [a for a in assumptions if a["field"] == "C_rr"]
    assert len(c_rr_entries) == 1
    entry = c_rr_entries[0]
    assert entry["value"] == pytest.approx(0.0070)
    assert entry["source"] == "user_override"
    assert entry["oem_default"] == pytest.approx(0.0065)


def test_reset_to_oem(client: TestClient):
    body = _corridor_body()
    body["overrides"] = {"reset_to_oem": True, "C_rr": 0.0070, "usable_kwh": 450.0}
    response = client.post("/v1/simulate", json=body)
    assert response.status_code == 200, response.text
    assumptions = response.json()["assumptions"]
    c_rr_entries = [a for a in assumptions if a["field"] == "C_rr"]
    assert len(c_rr_entries) == 1
    assert c_rr_entries[0]["value"] == pytest.approx(0.0065)
    assert c_rr_entries[0]["source"] == "oem_default"
    usable_entries = [a for a in assumptions if a["field"] == "usable_kwh"]
    assert usable_entries[0]["value"] == pytest.approx(394.0)
    assert usable_entries[0]["source"] == "oem_default"


def test_overrides_out_of_bounds_returns_422(client: TestClient):
    body = _corridor_body()
    body["overrides"] = {"C_rr": 0.02}
    response = client.post("/v1/simulate", json=body)
    assert response.status_code == 422


def test_overrides_defaults_oem_assumptions(client: TestClient):
    body = _corridor_body()
    body["overrides"] = {}
    response = client.post("/v1/simulate", json=body)
    assert response.status_code == 200, response.text
    assumptions = response.json()["assumptions"]
    assert len(assumptions) >= 5
    assert all(a["source"] == "oem_default" for a in assumptions)
    fields = {a["field"] for a in assumptions}
    assert "C_rr" in fields
    assert "usable_kwh" in fields


def test_simulate_with_charging_enabled(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    """POST polb_cajon_pass with include_charging=true returns charging_stops and feasibility."""
    monkeypatch.setattr(
        "app.simulation.charging_planner.search_hd_chargers",
        lambda db, lat, lon, radius_m: [],
    )
    monkeypatch.setattr(
        "app.simulation.charging_planner.detour_seconds",
        lambda *a, **k: 9999.0,
    )

    body = _corridor_body()
    body["options"] = {"include_charging": True}
    response = client.post("/v1/simulate", json=body)
    assert response.status_code == 200, response.text
    payload = response.json()
    _assert_simulate_response(payload, include_charging=True)
    assert payload["feasibility"]["verdict"] in {"feasible", "critical", "infeasible"}


def test_simulate_charging_disabled_parity(client: TestClient):
    """POST with include_charging=false preserves Phase 2 segment shape without charging fields."""
    body = _corridor_body()
    body["options"] = {"include_charging": False}
    response = client.post("/v1/simulate", json=body)
    assert response.status_code == 200, response.text
    payload = response.json()
    _assert_simulate_response(payload, include_charging=False)
    for segment in payload["segments"]:
        assert set(segment.keys()) >= set(SEGMENT_KEYS)
        assert "charging_event" not in segment or segment.get("charging_event") is False
