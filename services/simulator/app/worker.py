"""Celery worker for async simulation jobs (D-05, PLAT-02)."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from celery import Celery
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.simulation.orchestrator import run_simulation
from app.simulation.schemas import SimulateRequest

logger = logging.getLogger(__name__)

DEFAULT_BROKER_URL = "redis://redis:6379/0"
BROKER_URL = os.environ.get("CELERY_BROKER_URL", DEFAULT_BROKER_URL)

celery_app = Celery("fleetvolt")
celery_app.conf.broker_url = BROKER_URL
celery_app.conf.result_backend = os.environ.get("CELERY_RESULT_BACKEND", BROKER_URL)
celery_app.conf.task_acks_late = True
celery_app.conf.task_reject_on_worker_lost = True
celery_app.conf.broker_transport_options = {"visibility_timeout": 600}
celery_app.conf.result_backend_transport_options = {"visibility_timeout": 600}
celery_app.conf.visibility_timeout = 600


def _update_run(
    db: Session,
    run_id: str,
    *,
    status: str,
    outputs: dict[str, Any] | None = None,
    error: dict[str, Any] | None = None,
    duration_ms: int | None = None,
) -> None:
    db.execute(
        text(
            """
            UPDATE simulation_runs
            SET status = :status,
                outputs = CAST(:outputs AS jsonb),
                error = CAST(:error AS jsonb),
                duration_ms = :duration_ms
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "id": run_id,
            "status": status,
            "outputs": json.dumps(outputs) if outputs is not None else None,
            "error": json.dumps(error) if error is not None else None,
            "duration_ms": duration_ms,
        },
    )
    db.commit()


def _load_run(db: Session, run_id: str) -> dict[str, Any] | None:
    row = (
        db.execute(
            text(
                """
                SELECT id, inputs, status, physics_version, charger_version
                FROM simulation_runs
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"id": run_id},
        )
        .mappings()
        .first()
    )
    return dict(row) if row else None


def execute_simulation_run(run_id: str) -> None:
    """Run full simulation pipeline and persist results to simulation_runs."""
    db = SessionLocal()
    started = time.perf_counter()
    try:
        row = _load_run(db, run_id)
        if row is None:
            logger.error("simulation run not found: %s", run_id)
            return

        db.execute(
            text("UPDATE simulation_runs SET status = 'RUNNING' WHERE id = CAST(:id AS uuid)"),
            {"id": run_id},
        )
        db.commit()

        inputs = row["inputs"]
        if isinstance(inputs, str):
            inputs = json.loads(inputs)

        request = SimulateRequest.model_validate(inputs)
        request = request.model_copy(
            update={"options": request.options.model_copy(update={"include_charging": True})}
        )

        response = run_simulation(db, request)
        duration_ms = int((time.perf_counter() - started) * 1000)
        _update_run(
            db,
            run_id,
            status="COMPLETE",
            outputs=response.model_dump(mode="json"),
            duration_ms=duration_ms,
        )
    except HTTPException as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        _update_run(
            db,
            run_id,
            status="FAILED",
            error={
                "code": str(exc.status_code),
                "message": str(exc.detail),
                "stage": "simulation",
            },
            duration_ms=duration_ms,
        )
    except Exception as exc:
        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.exception("simulation task failed for run_id=%s", run_id)
        _update_run(
            db,
            run_id,
            status="FAILED",
            error={
                "code": "internal_error",
                "message": str(exc),
                "stage": "simulation",
            },
            duration_ms=duration_ms,
        )
        raise
    finally:
        db.close()


@celery_app.task(
    name="simulation.run",
    bind=True,
    max_retries=2,
    autoretry_for=(RuntimeError,),
)
def run_simulation_task(self, run_id: str) -> None:
    execute_simulation_run(run_id)
