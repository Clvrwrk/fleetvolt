"""PTV truck routing endpoint integration tests + corridor constant checks."""

from __future__ import annotations

import os

import httpx
import pytest

from app.routes.routing import (
    CAJON_PASS_DEST,
    POLB_ORIGIN,
    SAN_BERNARDINO_DEST,
)

SIMULATOR_URL = os.environ.get("SIMULATOR_URL", "http://localhost:8000")


def _simulator_reachable() -> bool:
    try:
        response = httpx.get(f"{SIMULATOR_URL}/health", timeout=3.0)
        return response.status_code == 200
    except httpx.HTTPError:
        return False


@pytest.mark.integration
def test_polb_to_san_bernardino():
    if not _simulator_reachable():
        pytest.skip(f"Simulator unreachable at {SIMULATOR_URL}")
    if not os.environ.get("PTV_DEVELOPER_API_KEY"):
        pytest.skip("PTV_DEVELOPER_API_KEY not configured")

    origin_lat, origin_lon = POLB_ORIGIN
    dest_lat, dest_lon = SAN_BERNARDINO_DEST
    response = httpx.get(
        f"{SIMULATOR_URL}/v1/routing/route",
        params={
            "origin_lat": origin_lat,
            "origin_lon": origin_lon,
            "dest_lat": dest_lat,
            "dest_lon": dest_lon,
        },
        timeout=30.0,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["distance_m"] > 50_000
    # Field name retained for wire-compat; value now reflects PTV provider readiness.
    assert payload["valhalla_status"] == "ptv-ready"
    assert len(payload["coordinates"]) > 10


def test_corridor_constants_defined():
    assert POLB_ORIGIN == (33.754, -118.216)
    assert SAN_BERNARDINO_DEST == (34.108, -117.290)
    assert CAJON_PASS_DEST == (34.280, -117.470)
