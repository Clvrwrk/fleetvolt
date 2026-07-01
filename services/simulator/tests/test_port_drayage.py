"""Port drayage geo-fence tests (PHYS-07, D-10)."""

from __future__ import annotations

import numpy as np
import pytest

from app.simulation.constants import US_MILE_M
from app.simulation.kpi_aggregator import aggregate_kpis
from app.simulation.physics_engine import TruckParams, segment_forces
from app.simulation.port_drayage import (
    PORT_SPEED_CAP_MPH,
    apply_port_drayage,
    segment_in_port,
)
from app.simulation.soc_integrator import integrate_soc


@pytest.fixture
def truck() -> TruckParams:
    return TruckParams(
        usable_kwh=394.0,
        curb_weight_lbs=26000,
        payload_lbs=34000,
        aux_kw_base=10.0,
    )


def test_segment_in_port_inside_terminal_point():
    # LBCT terminal coordinates — inside simplified harbor polygon
    assert segment_in_port(-118.2267, 33.7549) is True


def test_segment_in_port_outside_inland_point():
    # Inland San Bernardino — outside harbor polygon
    assert segment_in_port(-117.29, 34.108) is False


def test_port_drayage_only_affects_in_port_segments(truck: TruckParams):
    """Two-segment route: first midpoint in port, second outside."""
    segments = [
        {"mid_lon": -118.2267, "mid_lat": 33.7549},  # LBCT — in port
        {"mid_lon": -117.50, "mid_lat": 34.00},  # inland
    ]
    dist_m = np.array([US_MILE_M * 2, US_MILE_M * 8])
    speed_mph = np.array([55.0, 55.0])
    aux_kw = np.full(2, truck.aux_kw_base)

    speed_enabled, aux_enabled = apply_port_drayage(segments, speed_mph, aux_kw, enabled=True)
    speed_disabled, aux_disabled = apply_port_drayage(segments, speed_mph, aux_kw, enabled=False)

    assert speed_disabled[0] == pytest.approx(55.0)
    assert speed_disabled[1] == pytest.approx(55.0)
    assert aux_disabled[0] == pytest.approx(truck.aux_kw_base)
    assert aux_disabled[1] == pytest.approx(truck.aux_kw_base)

    assert speed_enabled[0] == pytest.approx(PORT_SPEED_CAP_MPH)
    assert speed_enabled[1] == pytest.approx(55.0)
    assert aux_enabled[0] > truck.aux_kw_base
    assert aux_enabled[1] == pytest.approx(truck.aux_kw_base)


def test_port_drayage_in_port_segment_higher_wh_per_mi(truck: TruckParams):
    """Single in-port segment with drayage enabled consumes more than baseline."""
    segments = [{"mid_lon": -118.2267, "mid_lat": 33.7549}]
    dist_m = np.array([US_MILE_M * 5])
    grade_pct = np.array([0.0])
    speed_base = np.array([55.0])
    aux_base = np.full(1, truck.aux_kw_base)

    def _wh_per_mi(speed: np.ndarray, aux: np.ndarray) -> float:
        p_traction, p_aux = segment_forces(dist_m, grade_pct, speed, truck, aux_kw=aux)
        soc = integrate_soc(p_traction, p_aux, dist_m, speed, truck)
        return aggregate_kpis(soc["energy_kwh"], soc["regen_kwh"], dist_m, speed)["wh_per_mi"]

    baseline = _wh_per_mi(speed_base, aux_base)
    speed_port, aux_port = apply_port_drayage(segments, speed_base, aux_base, enabled=True)
    port = _wh_per_mi(speed_port, aux_port)
    assert port > baseline
