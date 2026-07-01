"""FleetVolt simulator FastAPI application."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, FastAPI
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.routes.chargers import router as chargers_router
from app.routes.routing import router as routing_router
from app.routes.spatial import router as spatial_router
from app.routes.trucks import router as trucks_router

app = FastAPI(title="FleetVolt Simulator", version="0.1.0")
app.include_router(chargers_router)
app.include_router(routing_router)
app.include_router(spatial_router)
app.include_router(trucks_router)

SPATIAL_TABLES = (
    "nhfn_network",
    "chargers",
    "elevation_profiles",
    "truck_configs",
    "data_freshness",
)


class StackMetaResponse(BaseModel):
    postgres_version: str
    table_counts: dict[str, int] = Field(
        description="Row counts for core spatial tables",
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/meta/stack", response_model=StackMetaResponse)
def stack_meta(db: Annotated[Session, Depends(get_db)]) -> StackMetaResponse:
    version_row = db.execute(text("SELECT version()")).scalar_one()
    counts: dict[str, int] = {}
    for table in SPATIAL_TABLES:
        count = db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one()
        counts[table] = int(count)
    return StackMetaResponse(postgres_version=version_row, table_counts=counts)
