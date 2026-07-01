"""Piecewise OEM charge-curve dwell integration (CHRG-03, D-14)."""

from __future__ import annotations

from typing import Any


def _sorted_curve(curve: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(curve, key=lambda bp: float(bp["soc_pct"]))


def _max_kw_at_soc(curve: list[dict[str, Any]], soc_pct: float) -> float:
    """Return max charge kW for the SOC band containing soc_pct (step-wise)."""
    sorted_curve = _sorted_curve(curve)
    max_kw = float(sorted_curve[0]["max_kw"])
    for bp in sorted_curve:
        if soc_pct >= float(bp["soc_pct"]):
            max_kw = float(bp["max_kw"])
        else:
            break
    return max_kw


def integrate_charge_curve(
    curve: list[dict[str, Any]],
    arrival_soc: float,
    target_soc: float,
    station_kw: float,
    usable_kwh: float,
) -> tuple[float, float, float]:
    """Integrate dwell seconds along SOC-dependent max_kw bands.

    Uses step-wise max_kw per OEM breakpoint band, capped by station_kw.
    Energy scaled on usable_kwh (not nameplate).

    Returns (dwell_s, energy_kwh, departure_soc_pct).
    """
    if target_soc <= arrival_soc:
        return 0.0, 0.0, arrival_soc

    sorted_curve = _sorted_curve(curve)
    soc_breaks = [float(bp["soc_pct"]) for bp in sorted_curve]
    soc_breaks.append(100.0)

    dwell_s = 0.0
    energy_kwh = 0.0
    current_soc = float(arrival_soc)

    for i, band_start in enumerate(sorted_curve):
        band_lo = float(band_start["soc_pct"])
        band_hi = soc_breaks[i + 1] if i + 1 < len(soc_breaks) else 100.0

        if current_soc >= target_soc:
            break
        if target_soc <= band_lo:
            continue
        if current_soc >= band_hi:
            continue

        seg_start = max(current_soc, band_lo)
        seg_end = min(target_soc, band_hi)
        if seg_end <= seg_start:
            continue

        seg_energy_kwh = (seg_end - seg_start) / 100.0 * usable_kwh
        band_max_kw = float(band_start["max_kw"])
        effective_kw = min(band_max_kw, station_kw)
        if effective_kw <= 0:
            raise ValueError(f"Non-positive charge power at SOC band {band_lo}%")

        dwell_s += (seg_energy_kwh / effective_kw) * 3600.0
        energy_kwh += seg_energy_kwh
        current_soc = seg_end

    departure_soc = arrival_soc + (energy_kwh / usable_kwh) * 100.0
    return dwell_s, energy_kwh, departure_soc
