"""Idempotent DB bootstrap for Docker startup (truck seeds + elevation fixtures)."""

from __future__ import annotations

import os
import sys

from sqlalchemy import create_engine, text

from app.db import SessionLocal
from app.paths import data_root


def _import_ingest():
    root = data_root()
    if (root / "ingest").is_dir():
        if str(root) not in sys.path:
            sys.path.insert(0, str(root))
        from ingest.elevation import precompute_all
        from ingest.seed_trucks import seed_trucks
    else:
        repo_root = root.parent
        if str(repo_root) not in sys.path:
            sys.path.insert(0, str(repo_root))
        from data.ingest.elevation import precompute_all
        from data.ingest.seed_trucks import seed_trucks
    return precompute_all, seed_trucks


def bootstrap() -> None:
    precompute_all, seed_trucks = _import_ingest()

    engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
    session = SessionLocal(bind=engine)
    try:
        seed_trucks(session)
        session.commit()
        counts = precompute_all(session, use_fixture=True)
        truck_count = session.execute(
            text("SELECT COUNT(*) FROM truck_configs WHERE is_active = true")
        ).scalar_one()
        print(f"Bootstrap: {truck_count} truck configs, elevation {counts}")
    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    bootstrap()
