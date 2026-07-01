"""NHFN spatial stats API tests."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.ingest import nhfn  # noqa: E402
from app.main import app  # noqa: E402

FIXTURE_PATH = REPO_ROOT / "data" / "fixtures" / "nhfn_socal_sample.geojson"


@pytest.fixture
def nhfn_stats_client(db_session):
    """Test client with NHFN fixture loaded into the database."""
    nhfn.load_nhfn(
        db_session,
        source_path=FIXTURE_PATH,
        download_year=2024,
    )

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    from app.db import get_db

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.mark.integration
def test_nhfn_stats_endpoint(nhfn_stats_client):
    response = nhfn_stats_client.get("/v1/spatial/nhfn/stats")
    assert response.status_code == 200
    payload = response.json()
    assert "segment_count" in payload
    assert payload["segment_count"] >= 1
    assert payload["source_sample"] is not None
    assert "BTS NHFN" in payload["source_sample"]
    assert payload["ingested_at_max"] is not None
    for key in ("bbox_west", "bbox_south", "bbox_east", "bbox_north"):
        assert key in payload
