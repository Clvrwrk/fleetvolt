"""Unit tests for ElevationService cache-first profile loading."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import text

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.ingest.elevation import precompute_all  # noqa: E402

from app.simulation.elevation_service import (  # noqa: E402
    ElevationProfileResult,
    ElevationService,
    ElevationServiceError,
)


@pytest.fixture
def elevation_db(db_session):
    """Apply migrations and seed corridor profiles via fixture mode."""
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


def test_corridor_cache_hit_no_open_elevation(elevation_db):
    service = ElevationService()
    with patch("app.simulation.elevation_service.fetch_elevations_batch") as mock_fetch:
        result = service.get_profile(elevation_db, corridor_key="polb_cajon_pass")

    mock_fetch.assert_not_called()
    assert isinstance(result, ElevationProfileResult)
    assert result.corridor_key == "polb_cajon_pass"
    assert result.source == "cache"
    assert len(result.profile) >= 50
    assert result.max_grade_pct >= 0


def test_invalid_corridor_key_rejected(elevation_db):
    service = ElevationService()
    with pytest.raises(ElevationServiceError, match="Invalid corridor_key"):
        service.get_profile(elevation_db, corridor_key="polb; DROP TABLE--")


def test_cache_miss_uses_open_elevation(elevation_db):
    coordinates = [
        [-118.216, 33.754],
        [-117.5, 34.0],
        [-117.290, 34.108],
    ]

    service = ElevationService()
    with patch("app.simulation.elevation_service.fetch_elevations_batch") as mock_fetch:
        mock_fetch.side_effect = lambda samples: [10.0 + i for i in range(len(samples))]
        result = service.get_profile(elevation_db, coordinates=coordinates)

    mock_fetch.assert_called_once()
    assert result.source == "Open-Elevation"
    assert result.corridor_key is None
    assert len(result.profile) >= 2
    assert all("dist_m" in p and "elev_m" in p for p in result.profile)
    assert result.max_grade_pct >= 0


def test_cache_miss_requires_coordinates_or_od(elevation_db):
    service = ElevationService()
    with pytest.raises(ElevationServiceError, match="coordinates or origin/dest"):
        service.get_profile(elevation_db)


@patch("app.simulation.elevation_service.fetch_elevations_batch")
def test_open_elevation_failure_returns_clear_error(mock_fetch, elevation_db):
    mock_fetch.side_effect = RuntimeError("API down")
    coordinates = [[-118.216, 33.754], [-117.290, 34.108]]
    service = ElevationService()

    with pytest.raises(ElevationServiceError, match="Open-Elevation|corridor preset"):
        service.get_profile(elevation_db, coordinates=coordinates)


def test_missing_corridor_key_not_found(elevation_db):
    service = ElevationService()
    with pytest.raises(ElevationServiceError, match="No elevation profile cached"):
        service.get_profile(elevation_db, corridor_key="nonexistent_corridor")


def test_cached_profile_matches_db(elevation_db):
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

    service = ElevationService()
    result = service.get_profile(elevation_db, corridor_key="polb_cajon_pass")
    assert result.profile == row
