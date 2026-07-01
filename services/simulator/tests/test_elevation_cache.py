"""Elevation pre-cache and bridge filtering tests."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.ingest.elevation import filter_bridge_spikes, precompute_all  # noqa: E402

from app.main import app  # noqa: E402

FT_PER_M = 3.28084
MAX_DROP_FT = 40
WINDOW_M = 200
MAX_GRADE_PCT = 12.0


@pytest.fixture
def elevation_db(db_session):
    """Apply migrations and pre-cache both corridors via fixture mode."""
    from alembic.config import Config

    from alembic import command

    alembic_cfg = Config(str(REPO_ROOT / "services" / "simulator" / "alembic.ini"))
    alembic_cfg.set_main_option(
        "script_location",
        str(REPO_ROOT / "services" / "simulator" / "alembic"),
    )
    command.upgrade(alembic_cfg, "head")

    precompute_all(db_session, use_fixture=True)
    db_session.commit()
    return db_session


def test_filter_bridge_spikes_removes_synthetic_drop():
    """Unit test: 50 ft drop over 100 m is interpolated away (D-09)."""
    profile = [
        {"dist_m": 0.0, "elev_m": 100.0},
        {"dist_m": 100.0, "elev_m": 84.76},
        {"dist_m": 200.0, "elev_m": 100.0},
    ]
    filtered = filter_bridge_spikes(profile, max_drop_ft=MAX_DROP_FT, window_m=WINDOW_M)
    mid_elev = filtered[1]["elev_m"]
    assert mid_elev == pytest.approx(100.0, abs=0.01)


def test_two_corridors_cached(elevation_db):
    count = elevation_db.execute(
        text(
            """
            SELECT COUNT(DISTINCT corridor_key)
            FROM elevation_profiles
            WHERE corridor_key IN ('polb_san_bernardino', 'polb_cajon_pass')
            """
        )
    ).scalar_one()
    assert count == 2


def test_cajon_no_spikes(elevation_db):
    row = elevation_db.execute(
        text(
            """
            SELECT profile
            FROM elevation_profiles
            WHERE corridor_key = 'polb_cajon_pass'
            LIMIT 1
            """
        )
    ).scalar_one()
    profile = row
    for i in range(1, len(profile)):
        dist = profile[i]["dist_m"] - profile[i - 1]["dist_m"]
        if dist <= 0 or dist >= WINDOW_M:
            continue
        drop_ft = (profile[i - 1]["elev_m"] - profile[i]["elev_m"]) * FT_PER_M
        assert drop_ft <= MAX_DROP_FT, f"Spike at index {i}: {drop_ft:.1f} ft over {dist:.0f} m"
        grade_pct = abs(profile[i]["elev_m"] - profile[i - 1]["elev_m"]) / dist * 100
        assert grade_pct <= MAX_GRADE_PCT, (
            f"Grade {grade_pct:.1f}% exceeds {MAX_GRADE_PCT}% over {dist:.0f} m"
        )


def test_profile_structure(elevation_db):
    rows = elevation_db.execute(
        text(
            """
            SELECT corridor_key, profile
            FROM elevation_profiles
            WHERE corridor_key IN ('polb_san_bernardino', 'polb_cajon_pass')
            """
        )
    ).fetchall()
    assert len(rows) == 2
    for row in rows:
        profile = row.profile
        assert len(profile) >= 50, f"{row.corridor_key} has only {len(profile)} points"
        for point in profile:
            assert "dist_m" in point and "elev_m" in point


def test_elevation_api_endpoint(elevation_db):
    def override_get_db():
        try:
            yield elevation_db
        finally:
            pass

    from app.db import get_db

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    try:
        response = client.get("/v1/elevation/polb_cajon_pass")
        assert response.status_code == 200
        payload = response.json()
        assert payload["corridor_key"] == "polb_cajon_pass"
        assert payload["point_count"] >= 50
        assert isinstance(payload["max_grade_pct"], (int, float))
        assert payload["source"] is not None
        assert "first" in payload["profile_preview"]
        assert "last" in payload["profile_preview"]
    finally:
        app.dependency_overrides.clear()
