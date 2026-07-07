"""Class 8 truck route geometry adapter — PTV Developer Routing API (ROUT-01, P11-04).

This adapter now targets the PTV Developer Routing API for truck route geometry
(base ``https://api.myptv.com/routing/v1``, GET ``/routes``, auth via the ``apiKey``
HTTP header). It replaces the prior self-hosted Valhalla client (P11-04/P11-05/P11-08).

Scope note (P11-NOTE, Phase-13 decision): this adapter uses PTV for **routing geometry
only**. PTV's EV energy-consumption and emissions APIs deliberately overlap FleetVolt's
own physics engine and are NOT used here — whether to lean on them is a Phase-13 strategic
decision, out of Phase-11 scope.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass

import httpx
from pydantic import BaseModel, Field

from app.simulation.constants import US_MILE_M

logger = logging.getLogger(__name__)

# --- PTV Developer Routing API configuration (P11-04/P11-05) ---
# Base URL + endpoint GET /routes; auth via the `apiKey` HTTP header (confirmed from the
# PTV OpenAPI spec at api.myptv.com/meta/services/routing/v1/openapi.json, 2026-07-07).
PTV_BASE_URL = os.environ.get(
    "PTV_ROUTING_URL", "https://api.myptv.com/routing/v1"
).rstrip("/")
PTV_API_KEY = os.environ.get("PTV_DEVELOPER_API_KEY")
# PTV's predefined Americas Class-8 semitrailer profile (OpenAPI `profile` query param);
# also PTV's default when the first waypoint is in the Americas.
PTV_TRUCK_PROFILE = "USA_8_SEMITRAILER_5AXLE"

VALHALLA_BASE_URL = os.environ.get("VALHALLA_URL", "http://valhalla:8002").rstrip("/")

# Corridor endpoint constants (reuse in elevation pre-cache and orchestrator)
POLB_ORIGIN = (33.754, -118.216)
SAN_BERNARDINO_DEST = (34.108, -117.290)
CAJON_PASS_DEST = (34.280, -117.470)

CLASS8_TRUCK_OPTIONS = {
    "height": 4.11,
    "weight": 36287,
    "axle_count": 5,
    "hazmat": False,
}

# eCascadia/T680E Class-8 config expressed in PTV `vehicle` units (P11-05).
# Mapping from CLASS8_TRUCK_OPTIONS (Valhalla units) -> PTV vehicle[...] params:
#   Valhalla height[m]   4.11   -> PTV height[cm]              = round(4.11 * 100) = 411
#   Valhalla weight[kg]  36287  -> PTV totalPermittedWeight[kg] = 36287 (same unit)
#   Valhalla axle_count  5      -> PTV numberOfAxles            = 5
# length/width have no Valhalla equivalent — set to reasonable Class-8 semitrailer values.
CLASS8_VEHICLE = {
    "height": round(CLASS8_TRUCK_OPTIONS["height"] * 100),  # cm  (4.11 m -> 411 cm)
    "totalPermittedWeight": CLASS8_TRUCK_OPTIONS["weight"],  # kg  (36287)
    "numberOfAxles": CLASS8_TRUCK_OPTIONS["axle_count"],     # 5
    "length": 2200,  # cm — typical Class-8 tractor + 53 ft trailer (~22 m)
    "width": 259,    # cm — max legal US trailer width (102 in)
}

KPH_TO_MPH = 1.0 / 1.609344
DEFAULT_TRUCK_TOP_SPEED_MPH = 120.0 * KPH_TO_MPH  # Valhalla truck costing default


class RouteGeometry(BaseModel):
    """Truck route geometry from Valhalla /route."""

    distance_m: float = Field(description="Route length in meters")
    duration_s: float = Field(description="Estimated travel time in seconds")
    encoded_polyline: str | None = Field(
        default=None,
        description="Valhalla encoded polyline when shape_format is not geojson",
    )
    coordinates: list[list[float]] = Field(
        default_factory=list,
        description="GeoJSON [lon, lat] coordinate pairs along the route",
    )


@dataclass(frozen=True)
class EdgeSpeed:
    """Posted speed limit for one Valhalla edge mapped to cumulative route distance."""

    start_m: float
    edge_length_m: float
    speed_limit_mph: float

    @property
    def end_m(self) -> float:
        return self.start_m + self.edge_length_m


def _geojson_to_lon_lat_pairs(shape: object) -> list[list[float]]:
    if not isinstance(shape, list):
        return []
    coordinates: list[list[float]] = []
    for point in shape:
        if isinstance(point, (list, tuple)) and len(point) >= 2:
            coordinates.append([float(point[0]), float(point[1])])
    return coordinates


def decode_polyline(encoded: str, precision: int = 6) -> list[list[float]]:
    """Decode Valhalla/Google encoded polyline to GeoJSON [lon, lat] pairs."""
    factor = 10**precision
    coordinates: list[list[float]] = []
    index = 0
    lat = 0
    lon = 0
    length = len(encoded)

    while index < length:
        shift = 0
        result = 0
        while True:
            if index >= length:
                break
            byte = ord(encoded[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        delta_lat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += delta_lat

        shift = 0
        result = 0
        while True:
            if index >= length:
                break
            byte = ord(encoded[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        delta_lon = ~(result >> 1) if (result & 1) else (result >> 1)
        lon += delta_lon

        coordinates.append([lon / factor, lat / factor])

    return coordinates


def leg_coordinates(leg: dict) -> tuple[list[list[float]], str | None]:
    """Extract [lon, lat] pairs and optional encoded polyline from a Valhalla leg."""
    shape = leg.get("shape")
    encoded_polyline = leg.get("encoded_polyline")

    if isinstance(shape, str):
        return decode_polyline(shape), shape
    if isinstance(shape, dict):
        coords = shape.get("coordinates")
        if isinstance(coords, list):
            return _geojson_to_lon_lat_pairs(coords), encoded_polyline
    coordinates = _geojson_to_lon_lat_pairs(shape)
    return coordinates, encoded_polyline


def parse_route_response(payload: dict) -> RouteGeometry:
    """Parse Valhalla /route JSON into RouteGeometry."""
    try:
        trip = payload["trip"]
        summary = trip["summary"]
        distance_m = float(summary["length"]) * 1000.0
        duration_s = float(summary["time"])
        leg = trip["legs"][0]
        coordinates, encoded_polyline = leg_coordinates(leg)
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ValueError(f"Unexpected Valhalla route response shape: {exc}") from exc

    return RouteGeometry(
        distance_m=distance_m,
        duration_s=duration_s,
        encoded_polyline=encoded_polyline,
        coordinates=coordinates,
    )


def parse_ptv_route_response(payload: dict) -> RouteGeometry:
    """Parse a PTV Developer Routing API /routes RouteResponse into RouteGeometry.

    Maps PTV -> RouteGeometry contract (P11-04, preserved byte-for-byte):
      distance_m  = payload["distance"]    # PTV returns METERS already (no *1000)
      duration_s  = payload["travelTime"]  # seconds
      coordinates = [lon, lat] pairs from payload["polyline"]

    Robustness (plan-checker #3): PTV types ``polyline`` as ``string``, so with
    options[polylineFormat]=GEO_JSON it may arrive either as a parsed dict OR as a raw
    JSON string. Handle both. A GOOGLE_ENCODED_POLYLINE fallback string (non-JSON) is
    decoded with the existing precision-6 decode_polyline.
    """
    try:
        distance_m = float(payload["distance"])  # PTV distance is meters — do NOT *1000
        duration_s = float(payload["travelTime"])
        pl = payload["polyline"]
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Unexpected PTV route response shape: {exc}") from exc

    encoded_polyline: str | None = None
    if isinstance(pl, str):
        encoded_polyline = pl
        try:
            pl = json.loads(pl)
        except json.JSONDecodeError:
            # GOOGLE_ENCODED_POLYLINE fallback path (a non-JSON string).
            coordinates = decode_polyline(pl, precision=6)
            return RouteGeometry(
                distance_m=distance_m,
                duration_s=duration_s,
                encoded_polyline=encoded_polyline,
                coordinates=coordinates,
            )

    if isinstance(pl, dict) and isinstance(pl.get("coordinates"), list):
        coordinates = _geojson_to_lon_lat_pairs(pl["coordinates"])
    else:
        raise ValueError(
            f"Unexpected PTV route response shape: unrecognized polyline {type(pl)!r}"
        )

    return RouteGeometry(
        distance_m=distance_m,
        duration_s=duration_s,
        encoded_polyline=encoded_polyline,
        coordinates=coordinates,
    )


def _speed_kph_to_mph(value: float) -> float:
    return value * KPH_TO_MPH


def parse_trace_attributes(payload: dict, *, units: str = "miles") -> list[EdgeSpeed]:
    """Parse Valhalla /trace_attributes into cumulative edge speed bins."""
    try:
        edges = payload["edges"]
    except (KeyError, TypeError) as exc:
        raise ValueError(f"Unexpected Valhalla trace_attributes response shape: {exc}") from exc

    if not edges:
        return []

    try:
        lengths = payload["shape_attributes"]["length"]
    except (KeyError, TypeError) as exc:
        raise ValueError(f"Unexpected Valhalla trace_attributes response shape: {exc}") from exc

    length_scale = US_MILE_M if units == "miles" else 1000.0
    result: list[EdgeSpeed] = []
    cumulative_m = 0.0

    for i, edge in enumerate(edges):
        if i >= len(lengths):
            break
        edge_len_m = float(lengths[i]) * length_scale
        truck_speed = edge.get("truck_speed")
        speed_limit = edge.get("speed_limit")
        raw_kph = truck_speed if truck_speed is not None else speed_limit
        if raw_kph is None or float(raw_kph) <= 0:
            raise ValueError("Unexpected Valhalla trace_attributes response shape: missing speed")
        speed_mph = _speed_kph_to_mph(float(raw_kph))
        result.append(
            EdgeSpeed(
                start_m=cumulative_m,
                edge_length_m=edge_len_m,
                speed_limit_mph=speed_mph,
            )
        )
        cumulative_m += edge_len_m

    return result


def _valhalla_status(client: httpx.Client, base_url: str) -> dict | None:
    try:
        response = client.get(f"{base_url}/status", timeout=5.0)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError:
        return None


def _valhalla_ready(status: dict | None) -> bool:
    if status is None:
        return False
    actions = status.get("available_actions") or []
    return "route" in actions or status.get("tileset_last_modified") is not None


class RouteProvider:
    """Valhalla truck routing client for simulation orchestrator."""

    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or VALHALLA_BASE_URL).rstrip("/")

    def _route_body(
        self,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
    ) -> dict:
        return self._locations_route_body(
            [
                {"lat": origin_lat, "lon": origin_lon},
                {"lat": dest_lat, "lon": dest_lon},
            ]
        )

    def _locations_route_body(self, locations: list[dict[str, float]]) -> dict:
        return {
            "locations": locations,
            "costing": "truck",
            "costing_options": {"truck": CLASS8_TRUCK_OPTIONS},
            "shape_format": "geojson",
        }

    def _post_route(self, route_body: dict) -> RouteGeometry:
        logger.debug("Valhalla route request costing=truck options=%s", CLASS8_TRUCK_OPTIONS)

        with httpx.Client() as client:
            status_payload = _valhalla_status(client, self.base_url)
            if not _valhalla_ready(status_payload):
                raise RuntimeError(
                    "Valhalla routing service unavailable — tiles may still be building "
                    "(first build can take 30–90 minutes). Check /status on Valhalla."
                )

            try:
                response = client.post(
                    f"{self.base_url}/route",
                    json=route_body,
                    timeout=30.0,
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise RuntimeError(f"Valhalla route request failed: {exc}") from exc

            return parse_route_response(response.json())

    def get_route_locations(self, locations: list[dict[str, float]]) -> RouteGeometry:
        """Return Class 8 truck route geometry for multi-stop locations."""
        if len(locations) < 2:
            raise ValueError("At least two locations required for routing")
        route_body = self._locations_route_body(locations)
        return self._post_route(route_body)

    def get_route(
        self,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
    ) -> RouteGeometry:
        """Return Class 8 truck route geometry via Valhalla /route."""
        route_body = self._route_body(origin_lat, origin_lon, dest_lat, dest_lon)
        return self._post_route(route_body)

    def get_trace_attributes(self, coordinates: list[list[float]]) -> dict:
        """POST /trace_attributes for per-edge posted speeds."""
        if len(coordinates) < 2:
            raise ValueError("At least two coordinates required for trace_attributes")

        trace_body = {
            "shape": [{"lat": lat, "lon": lon} for lon, lat in coordinates],
            "costing": "truck",
            "costing_options": {"truck": CLASS8_TRUCK_OPTIONS},
            "directions_options": {"units": "miles"},
            "filters": {
                "attributes": [
                    "edge.speed_limit",
                    "edge.truck_speed",
                    "shape_attributes.length",
                ],
                "action": "include",
            },
        }

        with httpx.Client() as client:
            try:
                response = client.post(
                    f"{self.base_url}/trace_attributes",
                    json=trace_body,
                    timeout=30.0,
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise RuntimeError(f"Valhalla trace_attributes request failed: {exc}") from exc
            return response.json()

    def get_edge_speeds(self, coordinates: list[list[float]]) -> list[EdgeSpeed]:
        """Return per-edge posted speed limits aligned to cumulative route distance."""
        payload = self.get_trace_attributes(coordinates)
        return parse_trace_attributes(payload, units="miles")
