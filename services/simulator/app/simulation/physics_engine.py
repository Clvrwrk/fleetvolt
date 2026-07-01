"""Vectorized segment force and power calculations (PHYS-02)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.simulation.constants import G, LBS_TO_KG, MPS_PER_MPH, RHO_SEA_LEVEL


def air_density(temp_c: float = 20.0) -> float:
    """ISA-style air density (kg/m³) for weather preset hooks."""
    return RHO_SEA_LEVEL * (288.15 / (temp_c + 273.15))


@dataclass(frozen=True)
class TruckParams:
    """Truck physics parameters — always use usable_kwh for SoC (not nameplate)."""

    usable_kwh: float
    curb_weight_lbs: float
    payload_lbs: float = 0.0
    C_rr: float = 0.0065
    drag_coefficient: float = 0.65
    frontal_area_m2: float = 9.8
    regen_efficiency: float = 0.70
    regen_power_cap_kw: float = 350.0
    regen_soc_cutoff: float = 90.0
    aux_kw_base: float = 10.0
    drivetrain_efficiency: float = 0.92

    @property
    def mass_kg(self) -> float:
        return (self.curb_weight_lbs + self.payload_lbs) * LBS_TO_KG


def force_components(
    grade_pct: np.ndarray,
    speed_mph: np.ndarray,
    mass_kg: float,
    c_rr: float,
    cd: float,
    frontal_area_m2: float,
    rho: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return rolling, aero, and grade force components (N) per segment."""
    grade = np.asarray(grade_pct, dtype=np.float64)
    speed = np.asarray(speed_mph, dtype=np.float64)
    theta = np.arctan(grade / 100.0)
    v = speed * MPS_PER_MPH
    cos_t = np.cos(theta)
    sin_t = np.sin(theta)
    f_roll = c_rr * mass_kg * G * cos_t
    f_aero = 0.5 * rho * cd * frontal_area_m2 * v**2
    f_grade = mass_kg * G * sin_t
    return f_roll, f_aero, f_grade


def segment_forces(
    dist_m: np.ndarray,
    grade_pct: np.ndarray,
    speed_mph: np.ndarray,
    truck: TruckParams,
    *,
    temp_c: float = 20.0,
    aux_kw: float | np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Compute traction and auxiliary power (W) for batch segments."""
    _ = np.asarray(dist_m, dtype=np.float64)  # reserved for future distance-weighted aux
    grade = np.asarray(grade_pct, dtype=np.float64)
    speed = np.asarray(speed_mph, dtype=np.float64)
    rho = air_density(temp_c)

    f_roll, f_aero, f_grade = force_components(
        grade,
        speed,
        truck.mass_kg,
        truck.C_rr,
        truck.drag_coefficient,
        truck.frontal_area_m2,
        rho,
    )
    f_traction = f_roll + f_aero + f_grade
    v = speed * MPS_PER_MPH
    p_traction = f_traction * v

    if aux_kw is None:
        aux_w = np.full_like(p_traction, truck.aux_kw_base * 1000.0)
    else:
        aux_arr = np.asarray(aux_kw, dtype=np.float64)
        aux_w = aux_arr * 1000.0 if aux_arr.ndim else np.full_like(p_traction, float(aux_arr) * 1000.0)

    return p_traction, aux_w
