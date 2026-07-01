"""Unit tests for greedy HD charging stop planner (CHRG-01, CHRG-02)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import numpy as np
import pytest

from app.simulation.charging_planner import plan_greedy_stops
from app.simulation.physics_engine import TruckParams

PROJECT_ROOT = Path(__file__).resolve().parents[3]
ECASCADIA_PATH = PROJECT_ROOT / "data" / "trucks" / "ecascadia_438.json"

SEARCH_RADIUS_M = 40_234.0
FALLBACK_RADIUS_M = 80_468.0


@dataclass
class ChargerCandidate:
    station_id: str
    name: str
    lat: float
    lon: float
    power_kw: float
    hd_capable: bool
    distance_m: float


@pytest.fixture
def ecascadia_truck() -> TruckParams:
    payload = json.loads(ECASCADIA_PATH.read_text())
    return TruckParams(
        usable_kwh=float(payload["usable_kwh"]),
        curb_weight_lbs=float(payload["curb_weight_lbs"]),
    )


@pytest.fixture
def charge_curve() -> list[dict]:
    payload = json.loads(ECASCADIA_PATH.read_text())
    return payload["charge_curve"]


@pytest.fixture
def charging_conditions() -> SimpleNamespace:
    return SimpleNamespace(
        soc_trigger_pct=18.0,
        soc_floor_pct=10.0,
        target_soc_pct=80.0,
        min_arrival_soc_pct=10.0,
    )


def _synthetic_segments(n: int = 8, dist_m: float = 16_093.0) -> list[dict]:
    return [{"dist_m": dist_m, "start_m": i * dist_m} for i in range(n)]


def _synthetic_coordinates(n: int = 8) -> list[list[float]]:
    return [[-118.0 + i * 0.05, 33.75 + i * 0.02] for i in range(n)]


def _soc_crossing_trigger(n: int = 8) -> np.ndarray:
    """SoC stays above trigger until index 3, then drops below 18%."""
    return np.array([25.0, 22.0, 19.0, 17.0, 14.0, 12.0, 11.0, 10.5], dtype=np.float64)


def _mock_route_provider(detour_map: dict[str, float]) -> MagicMock:
    provider = MagicMock()

    def _detour(origin: dict, charger: dict, rejoin: dict) -> float:
        key = charger.get("station_id", "")
        return detour_map.get(key, 9999.0)

    provider.get_route.side_effect = lambda o_lat, o_lon, d_lat, d_lon: MagicMock(
        duration_s=100.0,
        distance_m=1000.0,
    )
    return provider


@pytest.fixture
def mock_db() -> MagicMock:
    return MagicMock()


def test_triggers_at_soc_threshold(
    mock_db: MagicMock,
    ecascadia_truck: TruckParams,
    charge_curve: list[dict],
    charging_conditions: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Planner emits a stop when soc_pct crosses the 18% default trigger."""
    candidates = [
        ChargerCandidate("hd-1", "HD Station", 33.76, -117.9, 350.0, True, 5000.0),
    ]
    search_calls: list[float] = []

    def fake_search(db, lat, lon, radius_m):
        search_calls.append(radius_m)
        return candidates

    def fake_detour(provider, origin, charger, rejoin):
        return 120.0

    monkeypatch.setattr(
        "app.simulation.charging_planner.search_hd_chargers",
        fake_search,
    )
    monkeypatch.setattr(
        "app.simulation.charging_planner.detour_seconds",
        fake_detour,
    )

    stops = plan_greedy_stops(
        mock_db,
        _synthetic_segments(),
        _soc_crossing_trigger(),
        _synthetic_coordinates(),
        ecascadia_truck,
        charge_curve,
        charging_conditions,
        _mock_route_provider({"hd-1": 120.0}),
    )

    assert len(stops) >= 1
    assert stops[0]["station_id"] == "hd-1"
    assert stops[0]["arrival_soc_pct"] <= charging_conditions.soc_trigger_pct


def test_hd_power_filter(
    mock_db: MagicMock,
    ecascadia_truck: TruckParams,
    charge_curve: list[dict],
    charging_conditions: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Candidates below 350 kW or hd_capable=false are excluded."""
    all_candidates = [
        ChargerCandidate("low-power", "Low", 33.76, -117.9, 150.0, True, 1000.0),
        ChargerCandidate("not-hd", "Not HD", 33.76, -117.89, 400.0, False, 2000.0),
        ChargerCandidate("valid", "Valid HD", 33.76, -117.88, 350.0, True, 3000.0),
    ]

    def fake_search(db, lat, lon, radius_m):
        return [c for c in all_candidates if c.power_kw >= 350 and c.hd_capable]

    monkeypatch.setattr(
        "app.simulation.charging_planner.search_hd_chargers",
        fake_search,
    )
    monkeypatch.setattr(
        "app.simulation.charging_planner.detour_seconds",
        lambda *a, **k: 100.0,
    )

    stops = plan_greedy_stops(
        mock_db,
        _synthetic_segments(),
        _soc_crossing_trigger(),
        _synthetic_coordinates(),
        ecascadia_truck,
        charge_curve,
        charging_conditions,
        _mock_route_provider({"valid": 100.0}),
    )

    assert len(stops) == 1
    assert stops[0]["station_id"] == "valid"
    assert stops[0]["power_kw"] >= 350.0


def test_radius_fallback(
    mock_db: MagicMock,
    ecascadia_truck: TruckParams,
    charge_curve: list[dict],
    charging_conditions: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Zero candidates at 25 mi triggers 50 mi fallback search."""
    search_radii: list[float] = []

    def fake_search(db, lat, lon, radius_m):
        search_radii.append(radius_m)
        if radius_m <= SEARCH_RADIUS_M:
            return []
        return [
            ChargerCandidate("far-hd", "Far HD", 33.76, -117.5, 350.0, True, 60000.0),
        ]

    monkeypatch.setattr(
        "app.simulation.charging_planner.search_hd_chargers",
        fake_search,
    )
    monkeypatch.setattr(
        "app.simulation.charging_planner.detour_seconds",
        lambda *a, **k: 200.0,
    )

    stops = plan_greedy_stops(
        mock_db,
        _synthetic_segments(),
        _soc_crossing_trigger(),
        _synthetic_coordinates(),
        ecascadia_truck,
        charge_curve,
        charging_conditions,
        _mock_route_provider({"far-hd": 200.0}),
    )

    assert SEARCH_RADIUS_M in search_radii
    assert FALLBACK_RADIUS_M in search_radii
    assert len(stops) == 1
    assert stops[0]["station_id"] == "far-hd"


def test_greedy_prefers_shorter_detour(
    mock_db: MagicMock,
    ecascadia_truck: TruckParams,
    charge_curve: list[dict],
    charging_conditions: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Among feasible chargers, shorter detour wins; tie-break higher power_kw."""
    candidates = [
        ChargerCandidate("slow-near", "Near Slow", 33.76, -117.9, 350.0, True, 1000.0),
        ChargerCandidate("fast-far", "Far Fast", 33.76, -117.89, 500.0, True, 2000.0),
    ]
    detour_map = {"slow-near": 90.0, "fast-far": 300.0}

    monkeypatch.setattr(
        "app.simulation.charging_planner.search_hd_chargers",
        lambda db, lat, lon, radius_m: candidates,
    )
    monkeypatch.setattr(
        "app.simulation.charging_planner.detour_seconds",
        lambda provider, origin, charger, rejoin: detour_map[charger["station_id"]],
    )

    stops = plan_greedy_stops(
        mock_db,
        _synthetic_segments(),
        _soc_crossing_trigger(),
        _synthetic_coordinates(),
        ecascadia_truck,
        charge_curve,
        charging_conditions,
        _mock_route_provider(detour_map),
    )

    assert len(stops) == 1
    assert stops[0]["station_id"] == "slow-near"
    assert stops[0]["detour_s"] == pytest.approx(90.0)


def test_greedy_tiebreak_higher_power(
    mock_db: MagicMock,
    ecascadia_truck: TruckParams,
    charge_curve: list[dict],
    charging_conditions: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Equal detour time — prefer higher power_kw."""
    candidates = [
        ChargerCandidate("a-350", "A", 33.76, -117.9, 350.0, True, 1000.0),
        ChargerCandidate("b-500", "B", 33.76, -117.89, 500.0, True, 1500.0),
    ]
    detour_map = {"a-350": 100.0, "b-500": 100.0}

    monkeypatch.setattr(
        "app.simulation.charging_planner.search_hd_chargers",
        lambda db, lat, lon, radius_m: candidates,
    )
    monkeypatch.setattr(
        "app.simulation.charging_planner.detour_seconds",
        lambda provider, origin, charger, rejoin: detour_map[charger["station_id"]],
    )

    stops = plan_greedy_stops(
        mock_db,
        _synthetic_segments(),
        _soc_crossing_trigger(),
        _synthetic_coordinates(),
        ecascadia_truck,
        charge_curve,
        charging_conditions,
        _mock_route_provider(detour_map),
    )

    assert len(stops) == 1
    assert stops[0]["station_id"] == "b-500"
    assert stops[0]["power_kw"] == pytest.approx(500.0)


def test_detour_cap_rejects(
    mock_db: MagicMock,
    ecascadia_truck: TruckParams,
    charge_curve: list[dict],
    charging_conditions: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Candidates with detour_s > 600 are rejected."""
    candidates = [
        ChargerCandidate("too-far", "Too Far", 33.76, -117.9, 350.0, True, 5000.0),
    ]

    monkeypatch.setattr(
        "app.simulation.charging_planner.search_hd_chargers",
        lambda db, lat, lon, radius_m: candidates,
    )
    monkeypatch.setattr(
        "app.simulation.charging_planner.detour_seconds",
        lambda *a, **k: 650.0,
    )

    stops = plan_greedy_stops(
        mock_db,
        _synthetic_segments(),
        _soc_crossing_trigger(),
        _synthetic_coordinates(),
        ecascadia_truck,
        charge_curve,
        charging_conditions,
        _mock_route_provider({"too-far": 650.0}),
    )

    assert stops == []
