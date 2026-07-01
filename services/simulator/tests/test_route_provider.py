"""Unit and integration tests for RouteProvider (Valhalla route + trace_attributes)."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.routes.routing import POLB_ORIGIN, SAN_BERNARDINO_DEST
from app.simulation.route_provider import (
    CLASS8_TRUCK_OPTIONS,
    EdgeSpeed,
    RouteGeometry,
    RouteProvider,
    parse_trace_attributes,
)

VALHALLA_URL = os.environ.get("VALHALLA_URL", "http://localhost:8002")


MOCK_ROUTE_RESPONSE = {
    "trip": {
        "summary": {"length": 95.5, "time": 4200.0},
        "legs": [
            {
                "shape": {
                    "type": "LineString",
                    "coordinates": [
                        [-118.216, 33.754],
                        [-117.5, 34.0],
                        [-117.290, 34.108],
                    ],
                },
                "encoded_polyline": None,
            }
        ],
    }
}

MOCK_TRACE_RESPONSE = {
    "edges": [
        {"speed_limit": 88.5, "truck_speed": 88.5},
        {"speed_limit": 72.4, "truck_speed": 72.4},
        {"speed_limit": 104.6, "truck_speed": 88.5},
    ],
    "shape_attributes": {
        "length": [30.0, 40.0, 25.5],
    },
}


def test_class8_truck_options_defined():
    assert CLASS8_TRUCK_OPTIONS["height"] == 4.11
    assert CLASS8_TRUCK_OPTIONS["weight"] == 36287
    assert CLASS8_TRUCK_OPTIONS["axle_count"] == 5


def test_parse_trace_attributes_returns_edge_speeds():
    edges = parse_trace_attributes(MOCK_TRACE_RESPONSE, units="miles")
    assert len(edges) == 3
    assert edges[0].edge_length_m == pytest.approx(30.0 * 1609.344, rel=1e-3)
    assert edges[0].speed_limit_mph == pytest.approx(55.0, rel=0.05)
    assert edges[0].start_m == pytest.approx(0.0)
    assert edges[1].start_m == pytest.approx(edges[0].edge_length_m, rel=1e-3)
    assert all(e.speed_limit_mph > 0 for e in edges)


def test_parse_trace_attributes_empty_edges():
    assert parse_trace_attributes({"edges": []}, units="miles") == []


def test_parse_trace_attributes_malformed_raises():
    with pytest.raises(ValueError, match="Unexpected Valhalla trace_attributes"):
        parse_trace_attributes({"edges": [{}]}, units="miles")


@patch("app.simulation.route_provider.httpx.Client")
def test_get_route_returns_geometry(mock_client_cls: MagicMock):
    mock_client = MagicMock()
    mock_client_cls.return_value.__enter__.return_value = mock_client
    mock_client.get.return_value = MagicMock(
        status_code=200,
        json=lambda: {"available_actions": ["route"], "tileset_last_modified": 1},
    )
    mock_client.post.return_value = MagicMock(
        status_code=200,
        json=lambda: MOCK_ROUTE_RESPONSE,
        raise_for_status=MagicMock(),
    )

    provider = RouteProvider(base_url="http://valhalla:8002")
    result = provider.get_route(33.754, -118.216, 34.108, -117.290)

    assert isinstance(result, RouteGeometry)
    assert result.distance_m == pytest.approx(95500.0, rel=1e-3)
    assert result.duration_s == pytest.approx(4200.0)
    assert len(result.coordinates) == 3
    assert result.coordinates[0] == [-118.216, 33.754]
    mock_client.post.assert_called_once()
    call_json = mock_client.post.call_args.kwargs["json"]
    assert call_json["costing"] == "truck"
    assert call_json["costing_options"]["truck"] == CLASS8_TRUCK_OPTIONS


@patch("app.simulation.route_provider.httpx.Client")
def test_get_edge_speeds_calls_trace_attributes(mock_client_cls: MagicMock):
    mock_client = MagicMock()
    mock_client_cls.return_value.__enter__.return_value = mock_client
    mock_client.post.return_value = MagicMock(
        status_code=200,
        json=lambda: MOCK_TRACE_RESPONSE,
        raise_for_status=MagicMock(),
    )

    coordinates = [[-118.216, 33.754], [-117.290, 34.108]]
    provider = RouteProvider(base_url="http://valhalla:8002")
    edges = provider.get_edge_speeds(coordinates)

    assert len(edges) == 3
    assert all(isinstance(e, EdgeSpeed) for e in edges)
    call_json = mock_client.post.call_args.kwargs["json"]
    assert call_json["costing"] == "truck"
    filters = call_json["filters"]["attributes"]
    assert "edge.speed_limit" in filters
    assert "edge.truck_speed" in filters
    assert "shape_attributes.length" in filters


@patch("app.simulation.route_provider.httpx.Client")
def test_get_route_raises_when_valhalla_unavailable(mock_client_cls: MagicMock):
    mock_client = MagicMock()
    mock_client_cls.return_value.__enter__.return_value = mock_client
    mock_client.get.side_effect = httpx.ConnectError("connection refused")

    provider = RouteProvider(base_url="http://valhalla:8002")
    with pytest.raises(RuntimeError, match="Valhalla routing service unavailable"):
        provider.get_route(33.754, -118.216, 34.108, -117.290)


def _valhalla_ready() -> bool:
    try:
        response = httpx.get(f"{VALHALLA_URL}/status", timeout=5.0)
        if response.status_code != 200:
            return False
        payload = response.json()
        actions = payload.get("available_actions") or []
        return "route" in actions or payload.get("tileset_last_modified") is not None
    except httpx.HTTPError:
        return False


@pytest.mark.integration
def test_integration_polb_to_san_bernardino_route():
    if not _valhalla_ready():
        pytest.skip(f"Valhalla not ready at {VALHALLA_URL}")

    provider = RouteProvider(base_url=VALHALLA_URL)
    origin_lat, origin_lon = POLB_ORIGIN
    dest_lat, dest_lon = SAN_BERNARDINO_DEST
    geometry = provider.get_route(origin_lat, origin_lon, dest_lat, dest_lon)

    assert geometry.distance_m > 50_000
    assert len(geometry.coordinates) > 10
    edges = provider.get_edge_speeds(geometry.coordinates)
    assert len(edges) > 0
    assert all(e.speed_limit_mph > 0 for e in edges)
