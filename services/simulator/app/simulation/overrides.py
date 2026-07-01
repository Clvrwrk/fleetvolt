"""Override merge and assumptions audit trail (D-14)."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.simulation.physics_engine import TruckParams
from app.simulation.schemas import AssumptionEntry, OverridesSpec

OVERRIDE_FIELDS: tuple[str, ...] = (
    "C_rr",
    "drag_coefficient",
    "usable_kwh",
    "aux_kw_base",
    "regen_efficiency",
)

BOUNDS_TOLERANCE = 0.20


def _oem_value(oem: dict[str, Any], field: str, file_payload: dict[str, Any]) -> float:
    return float(oem.get(field, file_payload.get(field, 0)))


def validate_override_bounds(field: str, value: float, oem_default: float) -> None:
    """Reject override values outside ±20% of OEM default."""
    low = oem_default * (1.0 - BOUNDS_TOLERANCE)
    high = oem_default * (1.0 + BOUNDS_TOLERANCE)
    if value < low or value > high:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Override {field}={value} outside ±20% OEM bounds "
                f"[{low:.6g}, {high:.6g}] (oem_default={oem_default})"
            ),
        )


def apply_truck_overrides(
    truck: TruckParams,
    overrides: OverridesSpec,
    *,
    oem: dict[str, Any],
    file_payload: dict[str, Any],
) -> tuple[TruckParams, list[AssumptionEntry]]:
    """Merge inline overrides onto truck params and build assumptions audit trail."""
    assumptions: list[AssumptionEntry] = []
    merged = {
        "usable_kwh": truck.usable_kwh,
        "curb_weight_lbs": truck.curb_weight_lbs,
        "payload_lbs": truck.payload_lbs,
        "C_rr": truck.C_rr,
        "drag_coefficient": truck.drag_coefficient,
        "frontal_area_m2": truck.frontal_area_m2,
        "regen_efficiency": truck.regen_efficiency,
        "regen_power_cap_kw": truck.regen_power_cap_kw,
        "regen_soc_cutoff": truck.regen_soc_cutoff,
        "aux_kw_base": truck.aux_kw_base,
        "drivetrain_efficiency": truck.drivetrain_efficiency,
    }

    for field in OVERRIDE_FIELDS:
        oem_default = _oem_value(oem, field, file_payload)
        override_value = getattr(overrides, field, None)

        if overrides.reset_to_oem:
            applied = oem_default
            source = "oem_default"
        elif override_value is not None:
            validate_override_bounds(field, float(override_value), oem_default)
            applied = float(override_value)
            source = "user_override"
        else:
            applied = float(merged[field])
            source = "oem_default"

        merged[field] = applied
        assumptions.append(
            AssumptionEntry(
                field=field,
                value=applied,
                source=source,
                oem_default=oem_default,
            )
        )

    updated_truck = TruckParams(
        usable_kwh=merged["usable_kwh"],
        curb_weight_lbs=merged["curb_weight_lbs"],
        payload_lbs=merged["payload_lbs"],
        C_rr=merged["C_rr"],
        drag_coefficient=merged["drag_coefficient"],
        frontal_area_m2=merged["frontal_area_m2"],
        regen_efficiency=merged["regen_efficiency"],
        regen_power_cap_kw=merged["regen_power_cap_kw"],
        regen_soc_cutoff=merged["regen_soc_cutoff"],
        aux_kw_base=merged["aux_kw_base"],
        drivetrain_efficiency=merged["drivetrain_efficiency"],
    )
    return updated_truck, assumptions
