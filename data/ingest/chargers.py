"""AFDC high-power charger ingest for SoCal corridor coverage."""

from __future__ import annotations

import csv
import io
import math
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

AFDC_API_URL = "https://developer.nlr.gov/api/alt-fuel-stations/v1.json"
DEFAULT_FIXTURE = Path(__file__).resolve().parents[1] / "raw" / "nrel" / "chargers_sample.csv"

POLB_LAT = 33.754
POLB_LON = -118.216
SOCAL_RADIUS_MI = 200
POWER_FLOOR_KW = 350
SOURCE_LABEL = "AFDC"

HD_CONNECTORS = frozenset({"J1772COMBO", "J3271", "CCS", "MCS"})

CONNECTOR_ALIASES = {
    "J1772COMBO": "J1772COMBO",
    "CCS": "CCS",
    "CCS1": "CCS",
    "CCS2": "CCS",
    "J3271": "J3271",
    "MCS": "MCS",
}


def hd_capable(power: float, connectors: set[str]) -> bool:
    """Return True when power meets HD floor and connector supports Class 8 CCS/MCS."""
    normalized = {_normalize_connector(c) for c in connectors}
    normalized.discard(None)  # type: ignore[arg-type]
    return power >= POWER_FLOOR_KW and bool(normalized & HD_CONNECTORS)


def _normalize_connector(value: str | None) -> str | None:
    if not value:
        return None
    token = value.strip().upper()
    return CONNECTOR_ALIASES.get(token, token if token in HD_CONNECTORS else token)


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in miles between two WGS84 points."""
    radius_mi = 3958.8
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius_mi * math.asin(math.sqrt(a))


def within_socal_radius(lat: float, lon: float) -> bool:
    """True when point is within D-04 SoCal extract radius from POLB."""
    return haversine_miles(POLB_LAT, POLB_LON, lat, lon) <= SOCAL_RADIUS_MI


def _parse_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_connectors(raw: str | None) -> set[str]:
    if not raw:
        return set()
    tokens = {t.strip() for t in raw.replace("|", ",").split(",") if t.strip()}
    normalized = {_normalize_connector(t) for t in tokens}
    return {c for c in normalized if c}


def _row_get(row: dict[str, str], *keys: str) -> str | None:
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return row[key]
    return None


def parse_afdc_csv(csv_text: str) -> list[dict[str, Any]]:
    """Parse AFDC ev-charging-units CSV into normalized unit dicts."""
    reader = csv.DictReader(io.StringIO(csv_text))
    units: list[dict[str, Any]] = []
    for row in reader:
        power = _parse_float(
            _row_get(row, "EV CCS Power Output (kW)", "ev_ccs_power_kw", "EV Power Output (kW)")
        )
        lat = _parse_float(_row_get(row, "Latitude", "latitude"))
        lon = _parse_float(_row_get(row, "Longitude", "longitude"))
        if lat is None or lon is None:
            continue
        connector_raw = _row_get(row, "EV Connector Types", "connector_types") or ""
        connectors = _parse_connectors(connector_raw)
        units.append(
            {
                "station_id": _row_get(row, "Station ID", "station_id") or "",
                "name": _row_get(row, "Station Name", "name"),
                "latitude": lat,
                "longitude": lon,
                "address": _row_get(row, "Street Address", "address"),
                "city": _row_get(row, "City", "city"),
                "state": _row_get(row, "State", "state"),
                "zip": _row_get(row, "ZIP", "zip"),
                "status": _row_get(row, "Status Code", "status"),
                "operator": _row_get(row, "EV Network", "operator"),
                "ev_ccs_power_kw": power or 0.0,
                "connector_types": connectors,
            }
        )
    return units


def filter_unit_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Apply D-05 power floor and D-04 geographic filter to parsed unit rows."""
    filtered: list[dict[str, Any]] = []
    for row in rows:
        power = float(row.get("ev_ccs_power_kw") or 0)
        if power < POWER_FLOOR_KW:
            continue
        lat = float(row["latitude"])
        lon = float(row["longitude"])
        if not within_socal_radius(lat, lon):
            continue
        filtered.append(row)
    return filtered


def _aggregate_by_station(unit_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge per-connector units into one station record (schema station_id is unique)."""
    by_station: dict[str, dict[str, Any]] = {}
    for row in unit_rows:
        station_id = str(row.get("station_id") or "").strip()
        if not station_id:
            continue
        power = float(row.get("ev_ccs_power_kw") or 0)
        connectors: set[str] = set(row.get("connector_types") or set())
        existing = by_station.get(station_id)
        if existing is None:
            by_station[station_id] = {
                **row,
                "ev_ccs_power_kw": power,
                "connector_types": set(connectors),
            }
            continue
        existing["ev_ccs_power_kw"] = max(float(existing["ev_ccs_power_kw"]), power)
        existing["connector_types"] = set(existing["connector_types"]) | connectors
    stations: list[dict[str, Any]] = []
    for station in by_station.values():
        connectors = set(station["connector_types"])
        power = float(station["ev_ccs_power_kw"])
        station["connector_types"] = sorted(connectors)
        station["hd_capable"] = hd_capable(power, connectors)
        station["is_mcs_capable"] = bool(connectors & {"J3271", "MCS"})
        stations.append(station)
    return stations


def fetch_afdc_stations(api_key: str | None = None) -> str:
    """Fetch live AFDC ev stations (via developer.nlr.gov v1.json)."""
    key = api_key or os.environ.get("NLR_API_KEY") or os.environ.get("NREL_API_KEY")
    if not key:
        raise RuntimeError("NLR_API_KEY is required for live AFDC ingest")
    params = {
        "api_key": key,
        "fuel_type": "ELEC",
        "state": "CA",
        "ev_charging_level": "dc_fast",
    }
    response = httpx.get(AFDC_API_URL, params=params, timeout=120.0)
    response.raise_for_status()
    return response.text


def load_fixture(path: Path | str | None = None) -> str:
    """Load offline fixture CSV for CI when NLR_API_KEY is absent."""
    fixture = Path(path) if path else DEFAULT_FIXTURE
    return fixture.read_text(encoding="utf-8")


def ingest_from_rows(session: Session, unit_rows: list[dict[str, Any]]) -> int:
    """Upsert aggregated station rows into chargers table."""
    stations = _aggregate_by_station(unit_rows)
    if not stations:
        return 0

    ingested_at = datetime.now(tz=UTC)
    upsert_sql = text(
        """
        INSERT INTO chargers (
            station_id, name, geom, power_kw, connector_types, operator,
            address, city, state, zip, status, is_mcs_capable, hd_capable,
            source, ingested_at
        ) VALUES (
            :station_id, :name,
            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
            :power_kw, :connector_types, :operator,
            :address, :city, :state, :zip, :status, :is_mcs_capable, :hd_capable,
            :source, :ingested_at
        )
        ON CONFLICT (station_id) DO UPDATE SET
            name = EXCLUDED.name,
            geom = EXCLUDED.geom,
            power_kw = EXCLUDED.power_kw,
            connector_types = EXCLUDED.connector_types,
            operator = EXCLUDED.operator,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            zip = EXCLUDED.zip,
            status = EXCLUDED.status,
            is_mcs_capable = EXCLUDED.is_mcs_capable,
            hd_capable = EXCLUDED.hd_capable,
            source = EXCLUDED.source,
            ingested_at = EXCLUDED.ingested_at
        """
    )

    for station in stations:
        session.execute(
            upsert_sql,
            {
                "station_id": station["station_id"],
                "name": station.get("name"),
                "lat": float(station["latitude"]),
                "lon": float(station["longitude"]),
                "power_kw": float(station["ev_ccs_power_kw"]),
                "connector_types": station["connector_types"],
                "operator": station.get("operator"),
                "address": station.get("address"),
                "city": station.get("city"),
                "state": station.get("state"),
                "zip": station.get("zip"),
                "status": station.get("status"),
                "is_mcs_capable": bool(station.get("is_mcs_capable")),
                "hd_capable": bool(station.get("hd_capable")),
                "source": SOURCE_LABEL,
                "ingested_at": ingested_at,
            },
        )
    session.commit()
    return len(stations)


def ingest(
    session: Session,
    *,
    fixture_path: Path | str | None = None,
    api_key: str | None = None,
    use_fixture: bool = False,
) -> int:
    """Run full ingest pipeline from live API or fixture CSV."""
    if use_fixture or not (
        api_key or os.environ.get("NLR_API_KEY") or os.environ.get("NREL_API_KEY")
    ):
        csv_text = load_fixture(fixture_path)
    else:
        csv_text = fetch_afdc_stations(api_key)
    rows = parse_afdc_csv(csv_text)
    unit_rows = filter_unit_rows(rows)
    return ingest_from_rows(session, unit_rows)


def main() -> None:
    """CLI entry: python -m data.ingest.chargers [--fixture]."""
    import argparse

    from app.db import SessionLocal

    parser = argparse.ArgumentParser(description="Ingest AFDC HD chargers")
    parser.add_argument(
        "--fixture",
        action="store_true",
        help="Use offline fixture CSV instead of live AFDC (NLR) API",
    )
    parser.add_argument(
        "--fixture-path",
        type=Path,
        default=None,
        help="Override fixture CSV path",
    )
    args = parser.parse_args()

    session = SessionLocal()
    try:
        count = ingest(
            session,
            fixture_path=args.fixture_path,
            use_fixture=args.fixture,
        )
        print(f"Ingested {count} charger station(s)")
    finally:
        session.close()


if __name__ == "__main__":
    main()
