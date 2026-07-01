"""Greedy HD charging stop planner (CHRG-01, CHRG-02, D-06)."""

from __future__ import annotations

from typing import Any

import numpy as np
from sqlalchemy.orm import Session

from app.simulation.physics_engine import TruckParams
from app.simulation.route_provider import RouteProvider


def plan_greedy_stops(
    db: Session,
    segments: list[dict[str, Any]],
    soc_pct: np.ndarray,
    coordinates: list[list[float]],
    truck: TruckParams,
    charge_curve: list[dict[str, Any]],
    conditions: Any,
    route_provider: RouteProvider,
    *,
    station_kw: float = 350.0,
) -> list[dict[str, Any]]:
    """Greedy first-feasible charging stop selection. Stub for TDD RED."""
    raise NotImplementedError("plan_greedy_stops not implemented")
