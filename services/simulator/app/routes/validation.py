"""GET /v1/physics/validation — OEM MAPE validation gate (D-12, PHYS-06)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.simulation.schemas import ValidationResponse
from app.simulation.validation_cases import run_all_validation

router = APIRouter(prefix="/v1/physics", tags=["validation"])


@router.get("/validation", response_model=ValidationResponse)
def physics_validation(
    db: Annotated[Session, Depends(get_db)],
) -> ValidationResponse:
    return run_all_validation(db)
