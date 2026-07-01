"""Tests for weekly charger refresh idempotency."""

from __future__ import annotations

from sqlalchemy import text

from data.ingest.refresh_chargers import FRESHNESS_DATASET, refresh_chargers


def test_upsert_idempotent(db_engine):
    """Running refresh twice yields same row count with updated freshness."""
    with db_engine.begin() as conn:
        conn.execute(text("TRUNCATE chargers RESTART IDENTITY CASCADE"))
        conn.execute(text("TRUNCATE data_freshness RESTART IDENTITY CASCADE"))

    from sqlalchemy.orm import sessionmaker

    Session = sessionmaker(bind=db_engine)

    session = Session()
    try:
        refresh_chargers(session, use_fixture=True)
    finally:
        session.close()

    session = Session()
    try:
        count_after_first = session.execute(text("SELECT COUNT(*) FROM chargers")).scalar_one()
        freshness_first = session.execute(
            text(
                "SELECT last_ingested_at, row_count FROM data_freshness "
                "WHERE dataset_name = :name"
            ),
            {"name": FRESHNESS_DATASET},
        ).one()
    finally:
        session.close()

    assert count_after_first > 0
    assert freshness_first.row_count == count_after_first

    session = Session()
    try:
        refresh_chargers(session, use_fixture=True)
        count_after_second = session.execute(text("SELECT COUNT(*) FROM chargers")).scalar_one()
        freshness_second = session.execute(
            text(
                "SELECT last_ingested_at, row_count FROM data_freshness "
                "WHERE dataset_name = :name"
            ),
            {"name": FRESHNESS_DATASET},
        ).one()
    finally:
        session.close()

    assert count_after_second == count_after_first
    assert freshness_second.row_count == count_after_first
    assert freshness_second.last_ingested_at >= freshness_first.last_ingested_at
