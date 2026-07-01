"""Internal job enqueue routes (PLAT-02, D-05)."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.worker import run_simulation_task

router = APIRouter(prefix="/v1", tags=["internal"])


class EnqueueRequest(BaseModel):
    inputs: dict[str, Any] = Field(description="Scenario inputs matching SimulateRequest shape")


class EnqueueResponse(BaseModel):
    enqueued: bool
    run_id: str


@router.post("/internal/jobs/{run_id}/enqueue", response_model=EnqueueResponse)
def enqueue_simulation_job(
    run_id: uuid.UUID,
    body: EnqueueRequest,
    db: Annotated[Session, Depends(get_db)],
) -> EnqueueResponse:
    run_id_str = str(run_id)
    row = db.execute(
        text("SELECT status FROM simulation_runs WHERE id = CAST(:id AS uuid)"),
        {"id": run_id_str},
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    if row[0] != "PENDING":
        raise HTTPException(
            status_code=409,
            detail=f"Run status is {row[0]}, expected PENDING",
        )

    run_simulation_task.delay(run_id_str)
    return EnqueueResponse(enqueued=True, run_id=run_id_str)
