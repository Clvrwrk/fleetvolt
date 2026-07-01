"""Sequential SoC forward integration with regen caps (PHYS-05)."""

from __future__ import annotations

import numpy as np

from app.simulation.constants import MPS_PER_MPH
from app.simulation.physics_engine import TruckParams


def integrate_soc(
    p_traction_w: np.ndarray,
    p_aux_w: np.ndarray,
    dist_m: np.ndarray,
    speed_mph: np.ndarray,
    truck: TruckParams,
    *,
    initial_soc_pct: float = 100.0,
) -> dict[str, np.ndarray]:
    """Integrate SoC segment-by-segment with SOC-dependent regen limits."""
    n = len(dist_m)
    p_traction = np.asarray(p_traction_w, dtype=np.float64)
    p_aux = np.asarray(p_aux_w, dtype=np.float64)
    dist = np.asarray(dist_m, dtype=np.float64)
    speed = np.asarray(speed_mph, dtype=np.float64)

    soc_pct = np.zeros(n, dtype=np.float64)
    energy_kwh = np.zeros(n, dtype=np.float64)
    regen_kwh = np.zeros(n, dtype=np.float64)

    soc = float(initial_soc_pct)
    regen_cap_w = truck.regen_power_cap_kw * 1000.0

    for i in range(n):
        v = speed[i] * MPS_PER_MPH
        dt_s = dist[i] / v if v > 0 else 0.0

        net_kwh = 0.0
        regen_segment = 0.0

        if p_traction[i] >= 0:
            motor_w = p_traction[i] / truck.drivetrain_efficiency
            net_kwh = (motor_w + p_aux[i]) * dt_s / 3_600_000
        else:
            aux_kwh = p_aux[i] * dt_s / 3_600_000
            if soc <= truck.regen_soc_cutoff:
                regen_w = min(abs(p_traction[i]), regen_cap_w) * truck.regen_efficiency
                regen_segment = regen_w * dt_s / 3_600_000
                net_kwh = aux_kwh - regen_segment
            else:
                net_kwh = aux_kwh

        soc -= (net_kwh / truck.usable_kwh) * 100.0
        soc_pct[i] = soc
        energy_kwh[i] = net_kwh
        regen_kwh[i] = regen_segment

    return {
        "soc_pct": soc_pct,
        "energy_kwh": energy_kwh,
        "regen_kwh": regen_kwh,
    }
