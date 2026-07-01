"""Elevation profile API routes."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter(prefix="/v1/elevation", tags=["elevation"])


class ProfilePoint(BaseModel):
    dist_m: float
    elev_m: float


class ElevationProfileResponse(BaseModel):
    corridor_key: str
    point_count: int
    max_grade_pct: float
    source: str | None = None
    created_at: datetime | None = None
    profile_preview: dict[str, list[ProfilePoint]] = Field(
        description="First and last three profile points",
    )


def _compute_max_grade_pct(profile: list[dict[str, Any]]) -> float:
    max_grade = 0.0
    for i in range(1, len(profile)):
        dist = float(profile[i]["dist_m"]) - float(profile[i - 1]["dist_m"])
        if dist <= 0:
            continue
        elev_delta = float(profile[i]["elev_m"]) - float(profile[i - 1]["elev_m"])
        max_grade = max(max_grade, abs(elev_delta / dist) * 100.0)
    return round(max_grade, 3)


@router.get("/{corridor_key}", response_model=ElevationProfileResponse)
def get_elevation_profile(
    corridor_key: str,
    db: Annotated[Session, Depends(get_db)],
) -> ElevationProfileResponse:
    """Return cached elevation profile metadata and preview for a corridor."""
    row = (
        db.execute(
            text(
                """
            SELECT corridor_key, profile, source, created_at
            FROM elevation_profiles
            WHERE corridor_key = :corridor_key
            ORDER BY created_at DESC
            LIMIT 1
            """
            ),
            {"corridor_key": corridor_key},
        )
        .mappings()
        .first()
    )

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"No elevation profile cached for corridor '{corridor_key}'",
        )

    profile = row["profile"]
    if not isinstance(profile, list) or len(profile) == 0:
        raise HTTPException(status_code=500, detail="Cached profile is empty or invalid")

    preview_len = min(3, len(profile))
    first = [ProfilePoint(**p) for p in profile[:preview_len]]
    last = [ProfilePoint(**p) for p in profile[-preview_len:]]

    return ElevationProfileResponse(
        corridor_key=row["corridor_key"],
        point_count=len(profile),
        max_grade_pct=_compute_max_grade_pct(profile),
        source=row["source"],
        created_at=row["created_at"],
        profile_preview={"first": first, "last": last},
    )
