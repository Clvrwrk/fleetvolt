"""Pytest fixtures for FleetVolt simulator tests."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

DEFAULT_DATABASE_URL = (
    "postgresql+psycopg://fleetvolt:fleetvolt@localhost:5432/fleetvolt_test"
)


def _database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)


def pytest_collection_modifyitems(config, items) -> None:
    """Skip integration tests in CI unless explicitly opted in."""
    if not os.environ.get("CI"):
        return
    skip_integration = pytest.mark.skip(reason="integration test skipped in CI")
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip_integration)


@pytest.fixture(scope="session")
def db_engine():
    """Session-scoped SQLAlchemy engine; skips if database is unreachable."""
    url = _database_url()
    engine = create_engine(url, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 — pytest skip gate
        engine.dispose()
        pytest.skip(f"DATABASE_URL unreachable ({url}): {exc}")
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine) -> Session:
    """Transactional session rolled back after each test."""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection, expire_on_commit=False)()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()
