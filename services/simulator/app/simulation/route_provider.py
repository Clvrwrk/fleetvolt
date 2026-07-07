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


_EDGE_SPEED_FALLBACK_LOGGED = False


class RouteProvider:
    """Class 8 truck routing client backed by the PTV Developer Routing API.

    Public method surface is unchanged from the prior Valhalla client so
    orchestrator.py and routes/routing.py need no changes: get_route,
    get_route_locations, get_edge_speeds.
    """

    def __init__(self, base_url: str | None = None, api_key: str | None = None) -> None:
        self.base_url = (base_url or PTV_BASE_URL).rstrip("/")
        self.api_key = api_key if api_key is not None else PTV_API_KEY

    def _vehicle_params(self) -> dict[str, object]:
        """PTV vehicle[...] bracket params from the Class-8 config."""
        return {
            "vehicle[height]": CLASS8_VEHICLE["height"],
            "vehicle[totalPermittedWeight]": CLASS8_VEHICLE["totalPermittedWeight"],
            "vehicle[numberOfAxles]": CLASS8_VEHICLE["numberOfAxles"],
            "vehicle[length]": CLASS8_VEHICLE["length"],
            "vehicle[width]": CLASS8_VEHICLE["width"],
        }

    def _get_ptv_route(self, waypoints: list[str]) -> RouteGeometry:
        """GET {base_url}/routes for the given "lat,lon" waypoints (Class 8 truck)."""
        if not self.api_key:
            raise RuntimeError("PTV_DEVELOPER_API_KEY is not configured")

        params: dict[str, object] = {
            "waypoints": waypoints,
            "profile": PTV_TRUCK_PROFILE,
            "results": "POLYLINE",
            "options[polylineFormat]": "GEO_JSON",
        }
        params.update(self._vehicle_params())

        logger.debug(
            "PTV route request profile=%s vehicle=%s waypoints=%d",
            PTV_TRUCK_PROFILE,
            CLASS8_VEHICLE,
            len(waypoints),
        )

        with httpx.Client() as client:
            try:
                response = client.get(
                    f"{self.base_url}/routes",
                    params=params,
                    headers={"apiKey": self.api_key},
                    timeout=30.0,
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise RuntimeError(f"PTV route request failed: {exc}") from exc

            return parse_ptv_route_response(response.json())

    def get_route_locations(self, locations: list[dict[str, float]]) -> RouteGeometry:
        """Return Class 8 truck route geometry for multi-stop locations."""
        if len(locations) < 2:
            raise ValueError("At least two locations required for routing")
        # PTV waypoint format is "lat,lon" (the INVERSE of the [lon,lat] output contract).
        waypoints = [f"{loc['lat']},{loc['lon']}" for loc in locations]
        return self._get_ptv_route(waypoints)

    def get_route(
        self,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
    ) -> RouteGeometry:
        """Return Class 8 truck route geometry via the PTV Developer Routing API."""
        # PTV waypoint format is "lat,lon" (inverse of [lon,lat] output).
        waypoints = [f"{origin_lat},{origin_lon}", f"{dest_lat},{dest_lon}"]
        return self._get_ptv_route(waypoints)

    def get_edge_speeds(self, coordinates: list[list[float]]) -> list[EdgeSpeed]:
        """Return per-edge posted speed limits — empty under PTV.

        PTV /routes returns polyline + distance + travelTime but NO per-edge posted
        speed (verified in the OpenAPI RouteResponse/Leg schema). This adapter therefore
        returns [] and resolve_speeds falls back to DEFAULT_POSTED_MPH=55, preserving the
        physics contract (documented fidelity change, P11-04 / 11-RESEARCH §2).
        """
        global _EDGE_SPEED_FALLBACK_LOGGED
        if not _EDGE_SPEED_FALLBACK_LOGGED:
            logger.info(
                "PTV routing does not expose per-edge posted speed; physics uses default "
                "posted-speed fallback (DEFAULT_POSTED_MPH)"
            )
            _EDGE_SPEED_FALLBACK_LOGGED = True
        return []
