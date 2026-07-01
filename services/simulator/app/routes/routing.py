"""Valhalla truck routing proxy for Class 8 corridor routes."""

from __future__ import annotations

import logging
import os
from typing import Annotated

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/routing", tags=["routing"])

VALHALLA_BASE_URL = os.environ.get("VALHALLA_URL", "http://valhalla:8002").rstrip("/")

# Corridor endpoint constants (reuse in Plan 06 elevation pre-cache)
POLB_ORIGIN = (33.754, -118.216)
SAN_BERNARDINO_DEST = (34.108, -117.290)
CAJON_PASS_DEST = (34.280, -117.470)

CLASS8_TRUCK_OPTIONS = {
    "height": 4.11,
    "weight": 36287,
    "axle_count": 5,
    "hazmat": False,
}


class RouteResponse(BaseModel):
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
    valhalla_status: str = Field(description="Valhalla service status at request time")


def _valhalla_status(client: httpx.Client) -> dict | None:
    try:
        response = client.get(f"{VALHALLA_BASE_URL}/status", timeout=5.0)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError:
        return None


def _valhalla_ready(status: dict | None) -> bool:
    if status is None:
        return False
    actions = status.get("available_actions") or []
    return "route" in actions or status.get("tileset_last_modified") is not None


def _geojson_to_lon_lat_pairs(shape: object) -> list[list[float]]:
    if not isinstance(shape, list):
        return []
    coordinates: list[list[float]] = []
    for point in shape:
        if isinstance(point, (list, tuple)) and len(point) >= 2:
            coordinates.append([float(point[0]), float(point[1])])
    return coordinates


@router.get("/route", response_model=RouteResponse)
def get_route(
    origin_lat: Annotated[float, Query(description="Origin latitude")],
    origin_lon: Annotated[float, Query(description="Origin longitude")],
    dest_lat: Annotated[float, Query(description="Destination latitude")],
    dest_lon: Annotated[float, Query(description="Destination longitude")],
) -> RouteResponse:
    """Return a Class 8 truck route via Valhalla truck costing."""
    route_body = {
        "locations": [
            {"lat": origin_lat, "lon": origin_lon},
            {"lat": dest_lat, "lon": dest_lon},
        ],
        "costing": "truck",
        "costing_options": {"truck": CLASS8_TRUCK_OPTIONS},
        "shape_format": "geojson",
    }
    logger.debug("Valhalla route request costing=truck options=%s", CLASS8_TRUCK_OPTIONS)

    with httpx.Client() as client:
        status_payload = _valhalla_status(client)
        if not _valhalla_ready(status_payload):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Valhalla routing service unavailable — tiles may still be building "
                    "(first build can take 30–90 minutes). Check /status on Valhalla."
                ),
            )

        try:
            response = client.post(
                f"{VALHALLA_BASE_URL}/route",
                json=route_body,
                timeout=30.0,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Valhalla route request failed: {exc}",
            ) from exc

        payload = response.json()

    try:
        trip = payload["trip"]
        summary = trip["summary"]
        distance_m = float(summary["length"]) * 1000.0
        duration_s = float(summary["time"])
        leg = trip["legs"][0]
        shape = leg.get("shape")
        encoded_polyline = leg.get("encoded_polyline")
        coordinates = _geojson_to_lon_lat_pairs(shape)
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unexpected Valhalla route response shape: {exc}",
        ) from exc

    return RouteResponse(
        distance_m=distance_m,
        duration_s=duration_s,
        encoded_polyline=encoded_polyline,
        coordinates=coordinates,
        valhalla_status="ready",
    )
