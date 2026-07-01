"""Greedy HD charging stop planner (CHRG-01, CHRG-02, D-06)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.simulation.charge_curve import integrate_charge_curve
from app.simulation.detour_validator import detour_seconds
from app.simulation.physics_engine import TruckParams
from app.simulation.route_provider import RouteProvider
from app.simulation.segment_builder import interpolate_point_at_dist

SEARCH_RADIUS_M = 40_234.0
FALLBACK_RADIUS_M = 80_468.0
MAX_DETOUR_S = 600.0
MIN_HD_POWER_KW = 350.0


@dataclass(frozen=True)
class HdChargerCandidate:
    station_id: str
    name: str | None
    lat: float
    lon: float
    power_kw: float
    hd_capable: bool
    distance_m: float


@dataclass(frozen=True)
class PlannerStatus:
    """Greedy planner completion signal for feasibility classifier."""

    complete: bool
    blocking_reason: Literal[
        "no_charger_in_radius", "detour_exceeded", "cannot_reach_destination"
    ] | None = None
    soc_deficit_kwh: float | None = None


def search_hd_chargers(
    db: Session,
    lat: float,
    lon: float,
    radius_m: float,
) -> list[HdChargerCandidate]:
    """Return HD-capable chargers with power_kw >= 350 within radius."""
    rows = db.execute(
        text(
            """
            SELECT
                station_id,
                name,
                power_kw,
                hd_capable,
                ST_Y(geom::geometry) AS lat,
                ST_X(geom::geometry) AS lon,
                ST_Distance(
                    geom,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                ) AS distance_m
            FROM chargers
            WHERE ST_DWithin(
                geom,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radius_m
            )
            AND hd_capable = true
            AND power_kw >= :min_power_kw
            ORDER BY distance_m
            """
        ),
        {"lat": lat, "lon": lon, "radius_m": radius_m, "min_power_kw": MIN_HD_POWER_KW},
    ).mappings().all()

    return [
        HdChargerCandidate(
            station_id=str(row["station_id"]),
            name=row["name"],
            lat=float(row["lat"]),
            lon=float(row["lon"]),
            power_kw=float(row["power_kw"]),
            hd_capable=bool(row["hd_capable"]),
            distance_m=float(row["distance_m"]),
        )
        for row in rows
    ]


def _candidate_field(candidate: Any, field: str) -> Any:
    if isinstance(candidate, dict):
        return candidate[field]
    return getattr(candidate, field)


def _normalize_candidates(candidates: list[Any]) -> list[HdChargerCandidate]:
    result: list[HdChargerCandidate] = []
    for candidate in candidates:
        power_kw = float(_candidate_field(candidate, "power_kw"))
        hd_capable = bool(_candidate_field(candidate, "hd_capable"))
        if power_kw < MIN_HD_POWER_KW or not hd_capable:
            continue
        result.append(
            HdChargerCandidate(
                station_id=str(_candidate_field(candidate, "station_id")),
                name=_candidate_field(candidate, "name"),
                lat=float(_candidate_field(candidate, "lat")),
                lon=float(_candidate_field(candidate, "lon")),
                power_kw=power_kw,
                hd_capable=hd_capable,
                distance_m=float(_candidate_field(candidate, "distance_m")),
            )
        )
    return result


def _search_with_fallback(
    db: Session,
    lat: float,
    lon: float,
) -> tuple[list[HdChargerCandidate], list[float]]:
    """Search 25 mi then 50 mi fallback per D-17."""
    radii_used: list[float] = []
    candidates = _normalize_candidates(search_hd_chargers(db, lat, lon, SEARCH_RADIUS_M))
    radii_used.append(SEARCH_RADIUS_M)
    if not candidates:
        candidates = _normalize_candidates(search_hd_chargers(db, lat, lon, FALLBACK_RADIUS_M))
        radii_used.append(FALLBACK_RADIUS_M)
    return candidates, radii_used


def _segment_dist_m(segments: list[dict[str, Any]], index: int) -> float:
    return float(segments[index].get("start_m", 0.0))


def _rejoin_point(
    segments: list[dict[str, Any]],
    coordinates: list[list[float]],
    trigger_index: int,
) -> dict[str, float]:
    rejoin_index = min(trigger_index + 1, len(segments) - 1)
    dist_m = _segment_dist_m(segments, rejoin_index)
    lon, lat = interpolate_point_at_dist(coordinates, dist_m)
    return {"lat": lat, "lon": lon}


def inject_soc_from_index(
    soc_pct: np.ndarray,
    start_index: int,
    energy_kwh: float,
    usable_kwh: float,
) -> None:
    """Add charged energy to forward SoC on same segment geometry (D-16)."""
    boost_pct = (energy_kwh / usable_kwh) * 100.0
    soc_pct[start_index:] = soc_pct[start_index:] + boost_pct
    np.clip(soc_pct, 0.0, 100.0, out=soc_pct)


def _compute_charge_target(
    soc_pct: np.ndarray,
    stop_index: int,
    arrival_soc: float,
    conditions: Any,
) -> float:
    """Target SoC at stop — default 80%, raised for destination min arrival (D-09)."""
    default_target = float(getattr(conditions, "target_soc_pct", 80.0))
    min_arrival = float(getattr(conditions, "min_arrival_soc_pct", 10.0))

    if float(soc_pct[-1]) >= min_arrival:
        return default_target

    boost_needed_pct = max(0.0, min_arrival - float(soc_pct[-1]))
    charge_to_soc_needed = arrival_soc + boost_needed_pct
    return min(100.0, max(default_target, charge_to_soc_needed))


def _soc_deficit_kwh(
    soc: np.ndarray,
    truck: TruckParams,
    min_arrival_pct: float,
) -> float:
    final = float(soc[-1])
    if final >= min_arrival_pct:
        return 0.0
    return (min_arrival_pct - final) / 100.0 * truck.usable_kwh


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
) -> tuple[list[dict[str, Any]], PlannerStatus]:
    """Greedy first-feasible HD charging stop selection per D-06."""
    trigger_pct = float(getattr(conditions, "soc_trigger_pct", 18.0))
    floor_pct = float(getattr(conditions, "soc_floor_pct", 10.0))
    min_arrival_pct = float(getattr(conditions, "min_arrival_soc_pct", 10.0))

    soc = np.asarray(soc_pct, dtype=np.float64)
    if not soc.flags.writeable:
        soc = soc.copy()
    stops: list[dict[str, Any]] = []
    n = len(soc)

    i = 1
    while i < n:
        if float(soc[i]) < floor_pct:
            return [], PlannerStatus(
                complete=False,
                blocking_reason="cannot_reach_destination",
                soc_deficit_kwh=_soc_deficit_kwh(soc, truck, min_arrival_pct),
            )

        crossed_trigger = float(soc[i - 1]) > trigger_pct and float(soc[i]) <= trigger_pct
        if not crossed_trigger:
            i += 1
            continue

        dist_m = _segment_dist_m(segments, i)
        lon, lat = interpolate_point_at_dist(coordinates, dist_m)
        origin = {"lat": lat, "lon": lon}
        rejoin = _rejoin_point(segments, coordinates, i)

        candidates, _radii = _search_with_fallback(db, lat, lon)
        feasible: list[tuple[HdChargerCandidate, float]] = []
        for candidate in candidates:
            charger_point = {
                "station_id": candidate.station_id,
                "lat": candidate.lat,
                "lon": candidate.lon,
            }
            detour_s = detour_seconds(route_provider, origin, charger_point, rejoin)
            if detour_s <= MAX_DETOUR_S:
                feasible.append((candidate, detour_s))

        if not feasible:
            return [], PlannerStatus(
                complete=False,
                blocking_reason="no_charger_in_radius",
                soc_deficit_kwh=_soc_deficit_kwh(soc, truck, min_arrival_pct),
            )

        best_candidate, best_detour = min(feasible, key=lambda item: (item[1], -item[0].power_kw))
        arrival_soc = float(soc[i])
        charge_target = _compute_charge_target(soc, i, arrival_soc, conditions)
        effective_station_kw = min(station_kw, best_candidate.power_kw)

        dwell_s, energy_kwh, departure_soc = integrate_charge_curve(
            charge_curve,
            arrival_soc,
            charge_target,
            effective_station_kw,
            truck.usable_kwh,
        )
        inject_soc_from_index(soc, i, energy_kwh, truck.usable_kwh)

        stops.append(
            {
                "station_id": best_candidate.station_id,
                "name": best_candidate.name,
                "lat": best_candidate.lat,
                "lon": best_candidate.lon,
                "power_kw": best_candidate.power_kw,
                "arrival_soc_pct": round(arrival_soc, 2),
                "departure_soc_pct": round(departure_soc, 2),
                "dwell_s": round(dwell_s, 1),
                "energy_added_kwh": round(energy_kwh, 4),
                "detour_s": round(best_detour, 1),
                "segment_index": i,
            }
        )
        i += 1

    return stops, PlannerStatus(complete=True)
