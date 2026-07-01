"""Simulation KPI aggregation from segment arrays."""

from __future__ import annotations

import numpy as np

from app.simulation.constants import MPS_PER_MPH, US_MILE_M


def aggregate_kpis(
    energy_kwh: np.ndarray,
    regen_kwh: np.ndarray,
    dist_m: np.ndarray,
    speed_mph: np.ndarray,
) -> dict[str, float]:
    """Aggregate total energy, efficiency, regen, and travel time KPIs."""
    energy = np.asarray(energy_kwh, dtype=np.float64)
    regen = np.asarray(regen_kwh, dtype=np.float64)
    dist = np.asarray(dist_m, dtype=np.float64)
    speed = np.asarray(speed_mph, dtype=np.float64)

    total_kwh = float(np.sum(energy))
    total_regen_kwh = float(np.sum(regen))
    total_dist_m = float(np.sum(dist))
    total_miles = total_dist_m / US_MILE_M if total_dist_m > 0 else 0.0
    wh_per_mi = (total_kwh / total_miles * 1000.0) if total_miles > 0 else 0.0

    v_mps = speed * MPS_PER_MPH
    segment_times = np.where(v_mps > 0, dist / v_mps, 0.0)
    total_time_s = float(np.sum(segment_times))

    return {
        "total_kwh": total_kwh,
        "wh_per_mi": wh_per_mi,
        "regen_kwh": total_regen_kwh,
        "total_time_s": total_time_s,
    }
