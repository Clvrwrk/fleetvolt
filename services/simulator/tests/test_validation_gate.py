"""MAPE validation CI gate for D-11 reference cases (PHYS-06)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from alembic.config import Config  # noqa: E402
from alembic import command  # noqa: E402
from data.ingest.elevation import precompute_all  # noqa: E402
from data.ingest.seed_trucks import seed_trucks  # noqa: E402

from app.simulation.validation_cases import (  # noqa: E402
    load_reference_cases,
    run_all_validation,
    validation_pass,
)


@pytest.fixture
def validation_db(db_session):
    """Migrations, truck seeds, and corridor elevation fixtures (no Valhalla)."""
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


def test_reference_cases_fixture_has_two_cases():
    payload = load_reference_cases()
    assert "flat_highway_oem" in payload["cases"]
    assert "polb_cajon_grade" in payload["cases"]


def test_validation_pass_band():
    assert validation_pass(8.0) is True
    assert validation_pass(12.0) is True
    assert validation_pass(10.0) is True
    assert validation_pass(7.9) is False
    assert validation_pass(12.1) is False


def test_flat_highway_oem_mape_in_band(validation_db):
    response = run_all_validation(validation_db)
    flat = next(c for c in response.cases if c.name == "flat_highway_oem")
    assert flat.pass_ is True
    assert 8.0 <= flat.mape_pct <= 12.0
    payload = load_reference_cases()
    assert flat.expected_kwh == pytest.approx(
        payload["cases"]["flat_highway_oem"]["expected_total_kwh"]
    )
    assert flat.actual_kwh > 0


def test_polb_cajon_grade_mape_in_band(validation_db):
    response = run_all_validation(validation_db)
    cajon = next(c for c in response.cases if c.name == "polb_cajon_grade")
    assert cajon.pass_ is True
    assert 8.0 <= cajon.mape_pct <= 12.0
    assert cajon.actual_kwh > 0


def test_overall_pass_when_both_cases_pass(validation_db):
    response = run_all_validation(validation_db)
    assert len(response.cases) == 2
    assert response.overall_pass is True
    assert all(c.pass_ for c in response.cases)
