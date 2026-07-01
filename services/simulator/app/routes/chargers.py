"""Charger spatial query and data freshness API routes."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter(prefix="/v1", tags=["chargers"])


class ChargerNearResponse(BaseModel):
    station_id: str
    name: str | None = None
    power_kw: float
    hd_capable: bool
    operator: str | None = None
    distance_m: float = Field(description="Distance from query point in meters")


class DataFreshnessResponse(BaseModel):
    dataset_name: str
    last_ingested_at: datetime | None = None
    row_count: int | None = None
    source: str | None = None


@router.get("/chargers/near", response_model=list[ChargerNearResponse])
def chargers_near(
    db: Annotated[Session, Depends(get_db)],
    lat: float = Query(..., description="Query latitude (WGS84)"),
    lon: float = Query(..., description="Query longitude (WGS84)"),
    radius_m: float = Query(50_000, gt=0, description="Search radius in meters"),
    hd_only: bool = Query(False, description="Return only hd_capable chargers"),
) -> list[ChargerNearResponse]:
    """Return chargers within radius of a point, sorted by distance."""
    hd_clause = "AND hd_capable = true" if hd_only else ""
    rows = db.execute(
        text(
            f"""
            SELECT
                station_id,
                name,
                power_kw,
                hd_capable,
                operator,
                ST_Distance(
                    geom,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                ) AS distance_m
            FROM chargers
            WHERE ST_DWithin(
                geom,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radius_m
            )
            {hd_clause}
            ORDER BY distance_m
            """
        ),
        {"lat": lat, "lon": lon, "radius_m": radius_m},
    ).mappings().all()

    return [
        ChargerNearResponse(
            station_id=row["station_id"],
            name=row["name"],
            power_kw=float(row["power_kw"]),
            hd_capable=bool(row["hd_capable"]),
            operator=row["operator"],
            distance_m=float(row["distance_m"]),
        )
        for row in rows
    ]


@router.get("/data/freshness", response_model=list[DataFreshnessResponse])
def data_freshness(db: Annotated[Session, Depends(get_db)]) -> list[DataFreshnessResponse]:
    """Return freshness metadata for all ingested datasets."""
    rows = db.execute(
        text(
            """
            SELECT dataset_name, last_ingested_at, row_count, source
            FROM data_freshness
            ORDER BY dataset_name
            """
        )
    ).mappings().all()

    return [
        DataFreshnessResponse(
            dataset_name=row["dataset_name"],
            last_ingested_at=row["last_ingested_at"],
            row_count=row["row_count"],
            source=row["source"],
        )
        for row in rows
    ]
