"""Spatial query routes for freight network and charger coverage."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter(prefix="/v1/spatial", tags=["spatial"])


class NhfnStatsResponse(BaseModel):
    segment_count: int = Field(description="Number of NHFN linework segments loaded")
    bbox_west: float | None = Field(default=None, description="Western extent (degrees)")
    bbox_south: float | None = Field(default=None, description="Southern extent (degrees)")
    bbox_east: float | None = Field(default=None, description="Eastern extent (degrees)")
    bbox_north: float | None = Field(default=None, description="Northern extent (degrees)")
    source_sample: str | None = Field(default=None, description="Example provenance source label")
    ingested_at_max: datetime | None = Field(
        default=None,
        description="Most recent ingest timestamp across NHFN rows",
    )


@router.get("/nhfn/stats", response_model=NhfnStatsResponse)
def nhfn_stats(db: Annotated[Session, Depends(get_db)]) -> NhfnStatsResponse:
    row = db.execute(
        text(
            """
            SELECT
                COUNT(*) AS segment_count,
                ST_XMin(ST_Extent(geom::geometry)) AS bbox_west,
                ST_YMin(ST_Extent(geom::geometry)) AS bbox_south,
                ST_XMax(ST_Extent(geom::geometry)) AS bbox_east,
                ST_YMax(ST_Extent(geom::geometry)) AS bbox_north,
                (
                    SELECT DISTINCT source
                    FROM nhfn_network
                    WHERE source IS NOT NULL
                    LIMIT 1
                ) AS source_sample,
                MAX(ingested_at) AS ingested_at_max
            FROM nhfn_network
            """
        ),
    ).one()

    return NhfnStatsResponse(
        segment_count=int(row.segment_count),
        bbox_west=float(row.bbox_west) if row.bbox_west is not None else None,
        bbox_south=float(row.bbox_south) if row.bbox_south is not None else None,
        bbox_east=float(row.bbox_east) if row.bbox_east is not None else None,
        bbox_north=float(row.bbox_north) if row.bbox_north is not None else None,
        source_sample=row.source_sample,
        ingested_at_max=row.ingested_at_max,
    )
