"""Piecewise OEM charge-curve dwell integration (CHRG-03, D-14)."""

from __future__ import annotations

from typing import Any


def integrate_charge_curve(
    curve: list[dict[str, Any]],
    arrival_soc: float,
    target_soc: float,
    station_kw: float,
    usable_kwh: float,
) -> tuple[float, float, float]:
    """Integrate dwell seconds along SOC-dependent max_kw bands. Stub for TDD RED."""
    raise NotImplementedError("integrate_charge_curve not implemented")
