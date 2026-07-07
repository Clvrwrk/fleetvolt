"""Class 8 truck routing proxy backed by the PTV Developer Routing API."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.simulation.route_provider import (
    CAJON_PASS_DEST,
    CLASS8_TRUCK_OPTIONS,
    POLB_ORIGIN,
    RouteProvider,
    SAN_BERNARDINO_DEST,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/routing", tags=["routing"])

# Re-export corridor constants for backward compatibility with Phase 1 tests
__all__ = [
    "CAJON_PASS_DEST",
    "CLASS8_TRUCK_OPTIONS",
    "POLB_ORIGIN",
    "SAN_BERNARDINO_DEST",
]


class RouteResponse(BaseModel):
    distance_m: float = Field(description="Route length in meters")
    duration_s: float = Field(description="Estimated travel time in seconds")
    encoded_polyline: str | None = Field(
        default=None,
        description="Encoded polyline when the provider returns a string polyline",
    )
    coordinates: list[list[float]] = Field(
        default_factory=list,
        description="GeoJSON [lon, lat] coordinate pairs along the route",
    )
    # Field name retained for wire-compat with shared-types (packages/shared-types/
    # src/schema.d.ts) + scripts/verify_valhalla_route.sh, which both read
    # `valhalla_status`; value now reflects PTV provider readiness. Rename deferred to a
    # coordinated cross-package change (post-Phase-11).
    valhalla_status: str = Field(description="Routing provider readiness marker")


@router.get("/route", response_model=RouteResponse)
def get_route(
    origin_lat: Annotated[float, Query(description="Origin latitude")],
    origin_lon: Annotated[float, Query(description="Origin longitude")],
    dest_lat: Annotated[float, Query(description="Destination latitude")],
    dest_lon: Annotated[float, Query(description="Destination longitude")],
) -> RouteResponse:
    """Return a Class 8 truck route via the PTV Developer Routing API."""
    try:
        geometry = RouteProvider().get_route(origin_lat, origin_lon, dest_lat, dest_lon)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unexpected PTV route response shape: {exc}",
        ) from exc

    return RouteResponse(
        distance_m=geometry.distance_m,
        duration_s=geometry.duration_s,
        encoded_polyline=geometry.encoded_polyline,
        coordinates=geometry.coordinates,
        valhalla_status="ptv-ready",
    )
