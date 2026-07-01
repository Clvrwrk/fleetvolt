"""GET /v1/physics/validation API contract tests (D-12)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from alembic.config import Config  # noqa: E402
from alembic import command  # noqa: E402
from data.ingest.elevation import precompute_all  # noqa: E402
from data.ingest.seed_trucks import seed_trucks  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
def validation_db(db_session):
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
def client(validation_db):
    from app.db import get_db

    def override_get_db():
        try:
            yield validation_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_validation_endpoint_returns_two_cases(client: TestClient):
    response = client.get("/v1/physics/validation")
    assert response.status_code == 200, response.text
    body = response.json()
    assert "cases" in body
    assert len(body["cases"]) == 2
    assert "overall_pass" in body

    names = {c["name"] for c in body["cases"]}
    assert names == {"flat_highway_oem", "polb_cajon_grade"}

    for case in body["cases"]:
        assert "expected_kwh" in case
        assert "actual_kwh" in case
        assert "mape_pct" in case
        assert "pass" in case
