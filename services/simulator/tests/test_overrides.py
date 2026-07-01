"""Unit tests for physics override merge and bounds validation (D-14)."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.simulation.overrides import apply_truck_overrides, validate_override_bounds
from app.simulation.physics_engine import TruckParams
from app.simulation.schemas import OverridesSpec


@pytest.fixture
def truck_and_oem() -> tuple[TruckParams, dict, dict]:
    oem = {
        "usable_kwh": 394.0,
        "C_rr": 0.0065,
        "drag_coefficient": 0.65,
        "aux_kw_base": 10.0,
        "regen_efficiency": 0.70,
    }
    file_payload = dict(oem)
    truck = TruckParams(
        usable_kwh=394.0,
        curb_weight_lbs=26000,
        C_rr=0.0065,
        drag_coefficient=0.65,
        aux_kw_base=10.0,
        regen_efficiency=0.70,
    )
    return truck, oem, file_payload


def test_validate_override_bounds_accepts_in_band():
    validate_override_bounds("C_rr", 0.0070, 0.0065)


def test_validate_override_bounds_rejects_out_of_band():
    with pytest.raises(HTTPException) as exc:
        validate_override_bounds("C_rr", 0.02, 0.0065)
    assert exc.value.status_code == 422


def test_apply_overrides_user_override_audit(truck_and_oem):
    truck, oem, file_payload = truck_and_oem
    overrides = OverridesSpec(C_rr=0.0070)
    updated, assumptions = apply_truck_overrides(
        truck, overrides, oem=oem, file_payload=file_payload,
    )
    assert updated.C_rr == pytest.approx(0.0070)
    c_rr = next(a for a in assumptions if a.field == "C_rr")
    assert c_rr.source == "user_override"
    assert c_rr.oem_default == pytest.approx(0.0065)


def test_apply_overrides_reset_to_oem(truck_and_oem):
    truck, oem, file_payload = truck_and_oem
    overrides = OverridesSpec(reset_to_oem=True, C_rr=0.0070, usable_kwh=450.0)
    updated, assumptions = apply_truck_overrides(
        truck, overrides, oem=oem, file_payload=file_payload,
    )
    assert updated.C_rr == pytest.approx(0.0065)
    assert updated.usable_kwh == pytest.approx(394.0)
    assert all(a.source == "oem_default" for a in assumptions)
