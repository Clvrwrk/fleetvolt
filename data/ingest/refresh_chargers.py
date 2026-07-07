"""Weekly idempotent AFDC charger refresh with freshness metadata."""

from __future__ import annotations

import os
from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from data.ingest.chargers import ingest

FRESHNESS_DATASET = "afdc_chargers"
FRESHNESS_SOURCE = "AFDC weekly upsert"

# VPS cron example (weekly Monday 03:00 UTC):
# 0 3 * * 1 cd /opt/fleetvolt && docker compose exec -T simulator python -m data.ingest.refresh_chargers


def update_freshness(session: Session, row_count: int) -> None:
    """Upsert data_freshness row for afdc_chargers per D-17."""
    now = datetime.now(tz=UTC)
    session.execute(
        text(
            """
            INSERT INTO data_freshness (dataset_name, last_ingested_at, row_count, source)
            VALUES (:dataset_name, :last_ingested_at, :row_count, :source)
            ON CONFLICT (dataset_name) DO UPDATE SET
                last_ingested_at = EXCLUDED.last_ingested_at,
                row_count = EXCLUDED.row_count,
                source = EXCLUDED.source
            """
        ),
        {
            "dataset_name": FRESHNESS_DATASET,
            "last_ingested_at": now,
            "row_count": row_count,
            "source": FRESHNESS_SOURCE,
        },
    )
    session.commit()


def refresh_chargers(
    session: Session,
    *,
    use_fixture: bool | None = None,
) -> int:
    """Run charger ingest and update freshness metadata."""
    if use_fixture is None:
        use_fixture = not bool(
            os.environ.get("NLR_API_KEY") or os.environ.get("NREL_API_KEY")
        )

    ingested = ingest(session, use_fixture=use_fixture)
    total = session.execute(text("SELECT COUNT(*) FROM chargers")).scalar_one()
    update_freshness(session, int(total))
    return ingested


def main() -> None:
    """CLI entry: python -m data.ingest.refresh_chargers [--fixture]."""
    import argparse

    from app.db import SessionLocal

    parser = argparse.ArgumentParser(description="Refresh AFDC charger dataset")
    parser.add_argument(
        "--fixture",
        action="store_true",
        help="Use offline fixture CSV instead of live AFDC (NLR) API",
    )
    args = parser.parse_args()

    session = SessionLocal()
    try:
        count = refresh_chargers(session, use_fixture=args.fixture or not (os.environ.get("NLR_API_KEY") or os.environ.get("NREL_API_KEY")))
        total = session.execute(text("SELECT COUNT(*) FROM chargers")).scalar_one()
        print(f"Refresh complete: {count} station(s) upserted, {total} total row(s)")
    finally:
        session.close()


if __name__ == "__main__":
    main()
