"""Unit tests for piecewise charge-curve dwell integration (CHRG-03, D-14)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.simulation.charge_curve import integrate_charge_curve

PROJECT_ROOT = Path(__file__).resolve().parents[3]
ECASCADIA_PATH = PROJECT_ROOT / "data" / "trucks" / "ecascadia_438.json"


@pytest.fixture
def ecascadia_charge_curve() -> list[dict]:
    payload = json.loads(ECASCADIA_PATH.read_text())
    return payload["charge_curve"]


@pytest.fixture
def usable_kwh() -> float:
    payload = json.loads(ECASCADIA_PATH.read_text())
    return float(payload["usable_kwh"])


def test_taper_slows_above_70pct(
    ecascadia_charge_curve: list[dict],
    usable_kwh: float,
) -> None:
    """Taper above 70% SOC increases dwell vs naive constant-station-kW estimate."""
    arrival_soc = 10.0
    target_soc = 80.0
    station_kw = 350.0

    dwell_s, energy_kwh, departure_soc = integrate_charge_curve(
        ecascadia_charge_curve,
        arrival_soc,
        target_soc,
        station_kw,
        usable_kwh,
    )

    energy_needed_kwh = (target_soc - arrival_soc) / 100.0 * usable_kwh
    naive_dwell_s = (energy_needed_kwh / station_kw) * 3600.0

    assert energy_kwh == pytest.approx(energy_needed_kwh, rel=0.01)
    assert departure_soc == pytest.approx(target_soc, abs=0.1)
    assert dwell_s > naive_dwell_s
