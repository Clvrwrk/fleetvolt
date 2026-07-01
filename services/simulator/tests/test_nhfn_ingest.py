"""NHFN SoCal ingest integration tests."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from sqlalchemy import text

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.ingest import nhfn  # noqa: E402

FIXTURE_PATH = REPO_ROOT / "data" / "fixtures" / "nhfn_socal_sample.geojson"
SOCAL_ENVELOPE = (-121.0, 32.5, -114.0, 37.0)


@pytest.fixture
def nhfn_loaded(db_session):
    """Load sample NHFN fixture into the test database."""
    count = nhfn.load_nhfn(
        db_session,
        source_path=FIXTURE_PATH,
        download_year=2024,
    )
    assert count > 0
    return count


@pytest.mark.integration
def test_socal_coverage(db_session, nhfn_loaded):
    west, south, east, north = SOCAL_ENVELOPE
    result = db_session.execute(
        text(
            """
            SELECT COUNT(*)
            FROM nhfn_network
            WHERE geom && ST_MakeEnvelope(:west, :south, :east, :north, 4326)
            """
        ),
        {"west": west, "south": south, "east": east, "north": north},
    ).scalar_one()
    assert int(result) > 0


@pytest.mark.integration
def test_provenance_columns(db_session, nhfn_loaded):
    rows = db_session.execute(
        text(
            """
            SELECT source, ingested_at
            FROM nhfn_network
            """
        ),
    ).all()
    assert len(rows) > 0
    for source, ingested_at in rows:
        assert source is not None
        assert "BTS NHFN" in source
        assert ingested_at is not None


@pytest.mark.integration
def test_gist_index_exists(db_engine):
    row = db_engine.connect().execute(
        text(
            """
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'nhfn_network'
              AND indexname = 'nhfn_network_geom_idx'
            """
        ),
    ).first()
    assert row is not None
    assert "gist" in row.indexdef.lower()


@pytest.mark.integration
def test_load_idempotent(db_session):
    first = nhfn.load_nhfn(
        db_session,
        source_path=FIXTURE_PATH,
        download_year=2024,
    )
    second = nhfn.load_nhfn(
        db_session,
        source_path=FIXTURE_PATH,
        download_year=2024,
    )
    assert first == second
