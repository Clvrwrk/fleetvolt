"""Unit tests for RouteProvider against the PTV Developer Routing API (P11-04/P11-08)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.routes.routing import POLB_ORIGIN, SAN_BERNARDINO_DEST
from app.simulation.route_provider import (
    CLASS8_TRUCK_OPTIONS,
    CLASS8_VEHICLE,
    PTV_TRUCK_PROFILE,
    EdgeSpeed,
    RouteGeometry,
    RouteProvider,
    parse_ptv_route_response,
)

# A realistic POLB -> San Bernardino PTV /routes payload (~95 mi ≈ 153 km).
MOCK_PTV_RESPONSE = {
    "distance": 153200,  # meters (PTV returns meters — no *1000)
    "travelTime": 6300,  # seconds
    "polyline": {
        "type": "LineString",
        "coordinates": [
            [-118.216, 33.754],  # POLB origin ([lon, lat])
            [-117.9, 33.9],
            [-117.5, 34.0],
            [-117.290, 34.108],  # San Bernardino dest
        ],
    },
}


def test_class8_truck_options_defined():
    assert CLASS8_TRUCK_OPTIONS["height"] == 4.11
    assert CLASS8_TRUCK_OPTIONS["weight"] == 36287
    assert CLASS8_TRUCK_OPTIONS["axle_count"] == 5


def test_class8_vehicle_derived_from_truck_options():
    # PTV units derived from CLASS8_TRUCK_OPTIONS (P11-05).
    assert CLASS8_VEHICLE["height"] == 411  # 4.11 m -> cm
    assert CLASS8_VEHICLE["totalPermittedWeight"] == 36287
    assert CLASS8_VEHICLE["numberOfAxles"] == 5


def test_parse_ptv_route_response_geojson():
    geo = parse_ptv_route_response(MOCK_PTV_RESPONSE)
    assert isinstance(geo, RouteGeometry)
    # distance is meters, NOT *1000
    assert geo.distance_m == pytest.approx(153200.0)
    assert geo.duration_s == pytest.approx(6300.0)
    assert len(geo.coordinates) == 4
    # coordinates parsed as [lon, lat] pairs
    assert geo.coordinates[0] == [-118.216, 33.754]
    assert geo.coordinates[-1] == [-117.290, 34.108]


def test_parse_ptv_route_response_json_string_polyline():
    import json

    payload = {
        "distance": 153200,
        "travelTime": 6300,
        "polyline": json.dumps(
            {"type": "LineString", "coordinates": [[-118.216, 33.754], [-117.290, 34.108]]}
        ),
    }
    geo = parse_ptv_route_response(payload)
    assert geo.coordinates[-1] == [-117.290, 34.108]
    assert geo.encoded_polyline is not None  # raw string retained


def test_parse_ptv_route_response_malformed_raises():
    with pytest.raises(ValueError, match="Unexpected PTV route response shape"):
        parse_ptv_route_response({"travelTime": 100, "polyline": {}})


@patch("app.simulation.route_provider.httpx.Client")
def test_get_route_calls_ptv_with_class8_profile(mock_client_cls: MagicMock):
    mock_client = MagicMock()
    mock_client_cls.return_value.__enter__.return_value = mock_client
    mock_client.get.return_value = MagicMock(
        status_code=200,
        json=lambda: MOCK_PTV_RESPONSE,
        raise_for_status=MagicMock(),
    )

    provider = RouteProvider(api_key="TEST_KEY")
    origin_lat, origin_lon = POLB_ORIGIN
    dest_lat, dest_lon = SAN_BERNARDINO_DEST
    result = provider.get_route(origin_lat, origin_lon, dest_lat, dest_lon)

    assert isinstance(result, RouteGeometry)
    assert result.distance_m == pytest.approx(153200.0)
    assert result.coordinates[0] == [-118.216, 33.754]

    mock_client.get.assert_called_once()
    call = mock_client.get.call_args
    # endpoint hit /routes
    assert call.args[0].endswith("/routes")
    # apiKey header
    assert call.kwargs["headers"] == {"apiKey": "TEST_KEY"}
    params = call.kwargs["params"]
    assert params["profile"] == PTV_TRUCK_PROFILE == "USA_8_SEMITRAILER_5AXLE"
    assert params["options[polylineFormat]"] == "GEO_JSON"
    # Class-8 vehicle overrides passed through
    assert params["vehicle[totalPermittedWeight]"] == 36287
    assert params["vehicle[numberOfAxles]"] == 5
    # waypoints formatted "lat,lon" (inverse of the [lon,lat] output)
    assert params["waypoints"] == [
        f"{origin_lat},{origin_lon}",
        f"{dest_lat},{dest_lon}",
    ]


def test_get_edge_speeds_returns_empty_under_ptv():
    provider = RouteProvider(api_key="TEST_KEY")
    coordinates = [[-118.216, 33.754], [-117.290, 34.108]]
    assert provider.get_edge_speeds(coordinates) == []


def test_get_route_raises_without_api_key():
    provider = RouteProvider(api_key="")
    with pytest.raises(RuntimeError, match="PTV_DEVELOPER_API_KEY is not configured"):
        provider.get_route(33.754, -118.216, 34.108, -117.290)


@patch("app.simulation.route_provider.httpx.Client")
def test_get_route_http_error_raises_runtimeerror(mock_client_cls: MagicMock):
    mock_client = MagicMock()
    mock_client_cls.return_value.__enter__.return_value = mock_client
    mock_client.get.side_effect = httpx.ConnectError("connection refused")

    provider = RouteProvider(api_key="TEST_KEY")
    with pytest.raises(RuntimeError, match="PTV route request failed"):
        provider.get_route(33.754, -118.216, 34.108, -117.290)


@patch("app.simulation.route_provider.httpx.Client")
def test_polb_to_san_bernardino_parity(mock_client_cls: MagicMock):
    """P11-08 geometry-parity spot check against a realistic PTV payload."""
    mock_client = MagicMock()
    mock_client_cls.return_value.__enter__.return_value = mock_client
    mock_client.get.return_value = MagicMock(
        status_code=200,
        json=lambda: MOCK_PTV_RESPONSE,
        raise_for_status=MagicMock(),
    )

    provider = RouteProvider(api_key="TEST_KEY")
    origin_lat, origin_lon = POLB_ORIGIN
    dest_lat, dest_lon = SAN_BERNARDINO_DEST
    geometry = provider.get_route(origin_lat, origin_lon, dest_lat, dest_lon)

    # Plausible Class-8 distance band for the POLB -> San Bernardino corridor.
    assert 120_000 <= geometry.distance_m <= 200_000
    assert len(geometry.coordinates) >= 2
    # First/last coordinates near the corridor endpoints (within ~0.2°).
    first_lon, first_lat = geometry.coordinates[0]
    last_lon, last_lat = geometry.coordinates[-1]
    assert abs(first_lat - origin_lat) <= 0.2 and abs(first_lon - origin_lon) <= 0.2
    assert abs(last_lat - dest_lat) <= 0.2 and abs(last_lon - dest_lon) <= 0.2
    # Edge speeds empty under PTV (55 mph physics fallback documented).
    assert provider.get_edge_speeds(geometry.coordinates) == []


@pytest.mark.integration
def test_integration_polb_to_san_bernardino_route():
    """Live PTV route (requires PTV_DEVELOPER_API_KEY)."""
    import os

    if not os.environ.get("PTV_DEVELOPER_API_KEY"):
        pytest.skip("PTV_DEVELOPER_API_KEY not configured")

    provider = RouteProvider()
    origin_lat, origin_lon = POLB_ORIGIN
    dest_lat, dest_lon = SAN_BERNARDINO_DEST
    geometry = provider.get_route(origin_lat, origin_lon, dest_lat, dest_lon)

    assert geometry.distance_m > 50_000
    assert len(geometry.coordinates) > 10
    assert isinstance(provider.get_edge_speeds(geometry.coordinates), list)
