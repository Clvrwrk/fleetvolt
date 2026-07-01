"""Truck config list and detail endpoints."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter(prefix="/v1/trucks", tags=["trucks"])


class TruckConfigSummary(BaseModel):
    id: int
    name: str
    nameplate_kwh: float
    usable_kwh: float
    version: str | None = None
    source_notes: str | None = Field(
        default=None,
        description="Truncated OEM source notes (max 200 chars)",
    )


class TruckConfigDetail(BaseModel):
    id: int
    name: str
    version: str | None = None
    source: str | None = None
    source_notes: str | None = None
    params: dict[str, Any]


def _truncate_notes(notes: str | None, limit: int = 200) -> str | None:
    if notes is None:
        return None
    if len(notes) <= limit:
        return notes
    return notes[: limit - 3] + "..."


def _row_to_summary(row) -> TruckConfigSummary:
    params = row.params
    return TruckConfigSummary(
        id=row.id,
        name=row.model_name,
        nameplate_kwh=params["nameplate_kwh"],
        usable_kwh=params["usable_kwh"],
        version=row.version,
        source_notes=_truncate_notes(row.source_notes),
    )


@router.get("", response_model=list[TruckConfigSummary])
def list_trucks(db: Annotated[Session, Depends(get_db)]) -> list[TruckConfigSummary]:
    rows = db.execute(
        text(
            """
            SELECT id, model_name, params, version, source_notes
            FROM truck_configs
            WHERE is_active = true
            ORDER BY model_name
            """
        )
    ).fetchall()
    return [_row_to_summary(row) for row in rows]


@router.get("/{truck_id}", response_model=TruckConfigDetail)
def get_truck(
    truck_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> TruckConfigDetail:
    row = db.execute(
        text(
            """
            SELECT id, model_name, params, version, source, source_notes
            FROM truck_configs
            WHERE id = :truck_id AND is_active = true
            """
        ),
        {"truck_id": truck_id},
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Truck config not found")
    return TruckConfigDetail(
        id=row.id,
        name=row.model_name,
        version=row.version,
        source=row.source,
        source_notes=row.source_notes,
        params=row.params,
    )
