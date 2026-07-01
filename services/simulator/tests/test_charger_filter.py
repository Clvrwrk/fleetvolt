"""Unit and integration tests for NREL charger ingest filters."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import text

from pathlib import Path

from data.ingest.chargers import (
    POWER_FLOOR_KW,
    filter_unit_rows,
    hd_capable,
    ingest_from_rows,
    parse_nrel_csv,
    within_socal_radius,
)

FIXTURE_PATH = Path(__file__).resolve().parents[3] / "data" / "raw" / "nrel" / "chargers_sample.csv"


class TestHdHeuristic:
    def test_hd_heuristic_ccs_350(self):
        assert hd_capable(power=350, connectors={"CCS"}) is True

    def test_hd_heuristic_low_power(self):
        assert hd_capable(power=150, connectors={"CCS"}) is False

    def test_hd_heuristic_j1772_only(self):
        assert hd_capable(power=400, connectors={"J1772"}) is False

    def test_hd_heuristic_mcs(self):
        assert hd_capable(power=400, connectors={"J3271", "MCS"}) is True


class TestPowerFloor:
    def test_power_floor_excludes_below_350(self):
        rows = [
            {"ev_ccs_power_kw": 349, "latitude": 33.75, "longitude": -118.21, "connector_types": {"CCS"}},
            {"ev_ccs_power_kw": 350, "latitude": 33.75, "longitude": -118.21, "connector_types": {"CCS"}},
            {"ev_ccs_power_kw": 400, "latitude": 33.75, "longitude": -118.21, "connector_types": {"CCS"}},
        ]
        filtered = filter_unit_rows(rows)
        assert len(filtered) == 2
        assert all(r["ev_ccs_power_kw"] >= POWER_FLOOR_KW for r in filtered)


class TestSocalRadius:
    def test_socal_radius_excludes_far_stations(self):
        # Portland, OR — well beyond 200 mi from POLB
        assert within_socal_radius(45.5152, -122.6784) is False

    def test_socal_radius_includes_polb(self):
        assert within_socal_radius(33.754, -118.216) is True

    def test_socal_radius_filters_rows(self):
        rows = [
            {
                "ev_ccs_power_kw": 400,
                "latitude": 33.754,
                "longitude": -118.216,
                "connector_types": {"CCS"},
                "station_id": "near",
            },
            {
                "ev_ccs_power_kw": 400,
                "latitude": 45.5152,
                "longitude": -122.6784,
                "connector_types": {"CCS"},
                "station_id": "far",
            },
        ]
        filtered = filter_unit_rows(rows)
        assert len(filtered) == 1
        assert filtered[0]["station_id"] == "near"


class TestProvenance:
    def test_provenance_fields_on_fixture_ingest(self, db_session):
        csv_text = open(FIXTURE_PATH, encoding="utf-8").read()
        rows = parse_nrel_csv(csv_text)
        unit_rows = filter_unit_rows(rows)
        assert len(unit_rows) >= 1

        count = ingest_from_rows(db_session, unit_rows)
        db_session.flush()
        assert count >= 1

        result = db_session.execute(
            text(
                "SELECT source, ingested_at FROM chargers "
                "WHERE power_kw >= :floor ORDER BY id DESC LIMIT 1"
            ),
            {"floor": POWER_FLOOR_KW},
        ).one()
        assert result.source == "NREL AFDC"
        assert result.ingested_at is not None
        assert result.ingested_at <= datetime.now(tz=UTC)
