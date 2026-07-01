"""Idempotent truck config seed loader from OEM JSON files."""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

TRUCK_FILES = (
    "ecascadia_438.json",
    "t680e_375.json",
)

DEFAULT_SOURCE = "OEM public specs"
DEFAULT_VERSION = "1.0.0"


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _trucks_dir() -> Path:
    return _project_root() / "data" / "trucks"


def load_truck_json(filename: str) -> dict:
    path = _trucks_dir() / filename
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def seed_trucks(session: Session) -> None:
    """Upsert truck configs by model_name; idempotent on re-run."""
    ingested_at = datetime.now(UTC)
    for filename in TRUCK_FILES:
        payload = load_truck_json(filename)
        model_name = payload["name"]
        source_notes = payload.pop("source_notes", None)
        params = payload

        session.execute(
            text(
                """
                INSERT INTO truck_configs (
                    model_name, params, source, source_notes,
                    version, is_active, ingested_at
                )
                VALUES (
                    :model_name, CAST(:params AS jsonb), :source, :source_notes,
                    :version, true, :ingested_at
                )
                ON CONFLICT (model_name) DO UPDATE SET
                    params = EXCLUDED.params,
                    source = EXCLUDED.source,
                    source_notes = EXCLUDED.source_notes,
                    version = EXCLUDED.version,
                    is_active = true,
                    ingested_at = EXCLUDED.ingested_at
                """
            ),
            {
                "model_name": model_name,
                "params": json.dumps(params),
                "source": DEFAULT_SOURCE,
                "source_notes": source_notes,
                "version": DEFAULT_VERSION,
                "ingested_at": ingested_at,
            },
        )


def main() -> None:
    import sys

    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://fleetvolt:fleetvolt@localhost:5432/fleetvolt",
    )

    root = _project_root()
    simulator_path = str(root / "services" / "simulator")
    if simulator_path not in sys.path:
        sys.path.insert(0, simulator_path)

    from alembic import command
    from alembic.config import Config
    from app.db import SessionLocal
    from sqlalchemy import create_engine

    alembic_cfg = Config(str(root / "services" / "simulator" / "alembic.ini"))
    alembic_cfg.set_main_option(
        "script_location",
        str(root / "services" / "simulator" / "alembic"),
    )
    os.environ["DATABASE_URL"] = database_url
    command.upgrade(alembic_cfg, "head")

    engine = create_engine(database_url, pool_pre_ping=True)
    session = SessionLocal(bind=engine)
    try:
        seed_trucks(session)
        session.commit()
        count = session.execute(
            text("SELECT COUNT(*) FROM truck_configs WHERE is_active = true")
        ).scalar_one()
        print(f"Seeded {count} active truck configs")
    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    main()
