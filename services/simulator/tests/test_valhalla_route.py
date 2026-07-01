"""Valhalla truck routing integration tests."""

from __future__ import annotations

import os

import httpx
import pytest

from app.routes.routing import (
    CAJON_PASS_DEST,
    POLB_ORIGIN,
    SAN_BERNARDINO_DEST,
    VALHALLA_BASE_URL,
)

SIMULATOR_URL = os.environ.get("SIMULATOR_URL", "http://localhost:8000")


def _valhalla_ready() -> bool:
    try:
        response = httpx.get(f"{VALHALLA_BASE_URL}/status", timeout=5.0)
        if response.status_code != 200:
            return False
        payload = response.json()
        actions = payload.get("available_actions") or []
        return "route" in actions or payload.get("tileset_last_modified") is not None
    except httpx.HTTPError:
        return False


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
    if not _valhalla_ready():
        pytest.skip(f"Valhalla not ready at {VALHALLA_BASE_URL}")

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
    assert payload["valhalla_status"] == "ready"
    assert len(payload["coordinates"]) > 10


@pytest.mark.integration
def test_route_returns_503_when_valhalla_unavailable(monkeypatch):
    if not _simulator_reachable():
        pytest.skip(f"Simulator unreachable at {SIMULATOR_URL}")
    if _valhalla_ready():
        pytest.skip("Valhalla is ready — cannot assert unavailable path")

    response = httpx.get(
        f"{SIMULATOR_URL}/v1/routing/route",
        params={
            "origin_lat": POLB_ORIGIN[0],
            "origin_lon": POLB_ORIGIN[1],
            "dest_lat": SAN_BERNARDINO_DEST[0],
            "dest_lon": SAN_BERNARDINO_DEST[1],
        },
        timeout=10.0,
    )
    assert response.status_code == 503
    assert "Valhalla" in response.json()["detail"]


def test_corridor_constants_defined():
    assert POLB_ORIGIN == (33.754, -118.216)
    assert SAN_BERNARDINO_DEST == (34.108, -117.290)
    assert CAJON_PASS_DEST == (34.280, -117.470)
