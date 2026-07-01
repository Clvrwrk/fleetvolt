"""Truck config seed data and API tests."""

from __future__ import annotations

import os
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SIMULATOR_URL = os.environ.get("SIMULATOR_URL", "http://localhost:8000")

PHYSICS_FIELDS = (
    "regen_efficiency",
    "aux_kw_base",
    "drag_coefficient",
    "C_rr",
)


def _import_seed():
    import sys

    if str(PROJECT_ROOT) not in sys.path:
        sys.path.insert(0, str(PROJECT_ROOT))
    from data.ingest.seed_trucks import seed_trucks

    return seed_trucks


@pytest.fixture
def seeded_db(db_session):
    """Apply migrations and seed truck configs for DB-backed tests."""
    from alembic.config import Config

    from alembic import command

    alembic_cfg = Config(str(PROJECT_ROOT / "services" / "simulator" / "alembic.ini"))
    alembic_cfg.set_main_option(
        "script_location",
        str(PROJECT_ROOT / "services" / "simulator" / "alembic"),
    )
    command.upgrade(alembic_cfg, "head")

    seed_trucks = _import_seed()
    seed_trucks(db_session)
    db_session.commit()
    return db_session


def test_two_models_seeded(seeded_db):
    count = seeded_db.execute(
        text("SELECT COUNT(*) FROM truck_configs WHERE is_active = true")
    ).scalar_one()
    assert count == 2


def test_usable_kwh_bounds(seeded_db):
    rows = seeded_db.execute(
        text("SELECT params FROM truck_configs WHERE is_active = true")
    ).fetchall()
    assert len(rows) == 2
    for (params,) in rows:
        nameplate = params["nameplate_kwh"]
        usable = params["usable_kwh"]
        assert usable < nameplate
        assert usable >= 0.85 * nameplate


def test_charge_curve_piecewise(seeded_db):
    rows = seeded_db.execute(
        text("SELECT params FROM truck_configs WHERE is_active = true")
    ).fetchall()
    for (params,) in rows:
        curve = params["charge_curve"]
        assert len(curve) >= 3
        for point in curve:
            assert "soc_pct" in point
            assert "max_kw" in point
            assert isinstance(point["soc_pct"], (int, float))
            assert isinstance(point["max_kw"], (int, float))
        max_kw_values = [point["max_kw"] for point in curve]
        assert len(set(max_kw_values)) > 1
        sorted_curve = sorted(curve, key=lambda p: p["soc_pct"])
        for prev, nxt in zip(sorted_curve, sorted_curve[1:]):
            assert nxt["max_kw"] <= prev["max_kw"]


def test_physics_params_present(seeded_db):
    rows = seeded_db.execute(
        text("SELECT params FROM truck_configs WHERE is_active = true")
    ).fetchall()
    for (params,) in rows:
        for field in PHYSICS_FIELDS:
            assert field in params
            assert isinstance(params[field], (int, float))


def test_seed_idempotent(seeded_db):
    seed_trucks = _import_seed()
    seed_trucks(seeded_db)
    seed_trucks(seeded_db)
    seeded_db.commit()
    count = seeded_db.execute(
        text("SELECT COUNT(*) FROM truck_configs WHERE is_active = true")
    ).scalar_one()
    assert count == 2


def test_trucks_api_list(seeded_db):
    from app.db import get_db

    def override_get_db():
        try:
            yield seeded_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    try:
        client = TestClient(app)
        response = client.get("/v1/trucks")
        assert response.status_code == 200
        trucks = response.json()
        assert len(trucks) == 2
        names = " ".join(t["name"] for t in trucks)
        assert "eCascadia" in names
        assert "T680E" in names
        for truck in trucks:
            assert truck["usable_kwh"] < truck["nameplate_kwh"]

        detail = client.get(f"/v1/trucks/{trucks[0]['id']}")
        assert detail.status_code == 200
        body = detail.json()
        assert "charge_curve" in body["params"]
        assert len(body["params"]["charge_curve"]) >= 3
    finally:
        app.dependency_overrides.clear()


def _simulator_reachable() -> bool:
    try:
        response = httpx.get(f"{SIMULATOR_URL}/health", timeout=3.0)
        return response.status_code == 200
    except httpx.HTTPError:
        return False


@pytest.mark.integration
def test_trucks_api_list_live():
    if not _simulator_reachable():
        pytest.skip(f"Simulator unreachable at {SIMULATOR_URL}")
    response = httpx.get(f"{SIMULATOR_URL}/v1/trucks", timeout=10.0)
    if response.status_code == 404:
        pytest.skip("GET /v1/trucks not deployed yet")
    assert response.status_code == 200
    trucks = response.json()
    assert len(trucks) >= 2
