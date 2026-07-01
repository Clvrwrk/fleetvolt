"""POST /v1/simulate — synchronous physics simulation (D-01, D-03)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.simulation.orchestrator import run_simulation
from app.simulation.schemas import SimulateRequest, SimulateResponse

router = APIRouter(prefix="/v1", tags=["simulate"])


@router.post("/simulate", response_model=SimulateResponse, response_model_exclude_none=True)
def simulate(
    body: SimulateRequest,
    db: Annotated[Session, Depends(get_db)],
) -> SimulateResponse:
    return run_simulation(db, body)
