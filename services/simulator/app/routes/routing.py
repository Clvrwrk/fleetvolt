"""Valhalla truck routing proxy for Class 8 corridor routes."""

from __future__ import annotations

import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.simulation.route_provider import (
    CAJON_PASS_DEST,
    CLASS8_TRUCK_OPTIONS,
    POLB_ORIGIN,
    RouteProvider,
    SAN_BERNARDINO_DEST,
    VALHALLA_BASE_URL,
    _valhalla_ready,
    _valhalla_status,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/routing", tags=["routing"])

# Re-export corridor constants for backward compatibility with Phase 1 tests
__all__ = [
    "CAJON_PASS_DEST",
    "CLASS8_TRUCK_OPTIONS",
    "POLB_ORIGIN",
    "SAN_BERNARDINO_DEST",
    "VALHALLA_BASE_URL",
]


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


@router.get("/route", response_model=RouteResponse)
def get_route(
    origin_lat: Annotated[float, Query(description="Origin latitude")],
    origin_lon: Annotated[float, Query(description="Origin longitude")],
    dest_lat: Annotated[float, Query(description="Destination latitude")],
    dest_lon: Annotated[float, Query(description="Destination longitude")],
) -> RouteResponse:
    """Return a Class 8 truck route via Valhalla truck costing."""
    with httpx.Client() as client:
        status_payload = _valhalla_status(client, VALHALLA_BASE_URL)
        if not _valhalla_ready(status_payload):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Valhalla routing service unavailable — tiles may still be building "
                    "(first build can take 30–90 minutes). Check /status on Valhalla."
                ),
            )

    try:
        geometry = RouteProvider().get_route(origin_lat, origin_lon, dest_lat, dest_lon)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unexpected Valhalla route response shape: {exc}",
        ) from exc

    return RouteResponse(
        distance_m=geometry.distance_m,
        duration_s=geometry.duration_s,
        encoded_polyline=geometry.encoded_polyline,
        coordinates=geometry.coordinates,
        valhalla_status="ready",
    )
