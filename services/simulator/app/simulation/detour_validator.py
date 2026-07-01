"""Valhalla truck detour time validation (D-18)."""

from __future__ import annotations

from typing import Any

from app.simulation.route_provider import RouteProvider


def detour_seconds(
    provider: RouteProvider,
    origin: dict[str, float],
    charger: dict[str, float],
    rejoin: dict[str, float],
) -> float:
    """Return extra travel seconds for corridor→charger→rejoin vs direct continuation."""
    direct = provider.get_route(
        origin["lat"],
        origin["lon"],
        rejoin["lat"],
        rejoin["lon"],
    )
    via = provider.get_route_locations(
        [
            {"lat": origin["lat"], "lon": origin["lon"]},
            {"lat": charger["lat"], "lon": charger["lon"]},
            {"lat": rejoin["lat"], "lon": rejoin["lon"]},
        ]
    )
    return max(0.0, via.duration_s - direct.duration_s)
