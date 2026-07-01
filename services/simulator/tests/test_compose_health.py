"""Compose stack health integration tests."""

from __future__ import annotations

import os

import httpx
import pytest

SIMULATOR_URL = os.environ.get("SIMULATOR_URL", "http://localhost:8000")

EXPECTED_TABLES = (
    "nhfn_network",
    "chargers",
    "elevation_profiles",
    "truck_configs",
    "data_freshness",
)


def _simulator_reachable() -> bool:
    try:
        response = httpx.get(f"{SIMULATOR_URL}/health", timeout=3.0)
        return response.status_code == 200
    except httpx.HTTPError:
        return False


@pytest.mark.integration
def test_fastapi_health():
    if not _simulator_reachable():
        pytest.skip(f"Simulator unreachable at {SIMULATOR_URL}")
    response = httpx.get(f"{SIMULATOR_URL}/health", timeout=5.0)
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.integration
def test_stack_meta_table_counts():
    if not _simulator_reachable():
        pytest.skip(f"Simulator unreachable at {SIMULATOR_URL}")
    response = httpx.get(f"{SIMULATOR_URL}/v1/meta/stack", timeout=10.0)
    assert response.status_code == 200
    payload = response.json()
    assert "postgres_version" in payload
    assert "table_counts" in payload
    counts = payload["table_counts"]
    for table in EXPECTED_TABLES:
        assert table in counts
        assert counts[table] >= 0
