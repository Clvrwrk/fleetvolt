"""Cache-first elevation profiles with Open-Elevation fallback (D-06, PHYS-03)."""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.simulation.route_provider import RouteProvider

# Import shared elevation sampling utilities from ingest module
_REPO_ROOT = Path(__file__).resolve().parents[4]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from data.ingest.elevation import (  # noqa: E402
    compute_max_grade_pct,
    fetch_elevations_batch,
    filter_bridge_spikes,
    sample_polyline,
)

CORRIDOR_KEY_PATTERN = re.compile(r"^[a-z0-9_]+$")


@dataclass(frozen=True)
class ElevationProfileResult:
    """Elevation profile along route distance."""

    profile: list[dict[str, float]]
    max_grade_pct: float
    source: str
    corridor_key: str | None = None


class ElevationServiceError(Exception):
    """Elevation lookup or live fetch failure."""


class ElevationService:
    """Load elevation profiles from PostGIS cache or Open-Elevation fallback."""

    def __init__(
        self,
        route_provider: RouteProvider | None = None,
    ) -> None:
        self.route_provider = route_provider or RouteProvider()

    def _validate_corridor_key(self, corridor_key: str) -> None:
        if not CORRIDOR_KEY_PATTERN.match(corridor_key):
            raise ElevationServiceError(
                f"Invalid corridor_key '{corridor_key}' — use alphanumeric and underscore only"
            )

    def _load_cached_profile(
        self,
        db: Session,
        corridor_key: str,
    ) -> ElevationProfileResult:
        self._validate_corridor_key(corridor_key)
        row = (
            db.execute(
                text(
                    """
                    SELECT corridor_key, profile, source
                    FROM elevation_profiles
                    WHERE corridor_key = :corridor_key
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                ),
                {"corridor_key": corridor_key},
            )
            .mappings()
            .first()
        )

        if row is None:
            raise ElevationServiceError(
                f"No elevation profile cached for corridor '{corridor_key}' — "
                "use a corridor preset or custom origin/destination"
            )

        profile = row["profile"]
        if not isinstance(profile, list) or len(profile) == 0:
            raise ElevationServiceError("Cached elevation profile is empty or invalid")

        normalized = [
            {"dist_m": float(p["dist_m"]), "elev_m": float(p["elev_m"])} for p in profile
        ]
        return ElevationProfileResult(
            profile=normalized,
            max_grade_pct=round(compute_max_grade_pct(normalized), 3),
            source="cache",
            corridor_key=row["corridor_key"],
        )

    def _fetch_live_profile(
        self,
        coordinates: list[list[float]],
    ) -> ElevationProfileResult:
        samples = sample_polyline(coordinates)
        if not samples:
            raise ElevationServiceError("Route geometry has no sample points for elevation")

        try:
            elevations = fetch_elevations_batch(samples)
        except Exception as exc:
            raise ElevationServiceError(
                "Open-Elevation batch fetch failed — try a corridor preset "
                f"(polb_cajon_pass, polb_san_bernardino): {exc}"
            ) from exc

        raw_profile: list[dict[str, Any]] = [
            {"dist_m": round(dist_m, 2), "elev_m": round(elev, 2)}
            for (_, _, dist_m), elev in zip(samples, elevations, strict=True)
        ]
        filtered = filter_bridge_spikes(raw_profile)
        normalized = [
            {"dist_m": float(p["dist_m"]), "elev_m": float(p["elev_m"])} for p in filtered
        ]
        return ElevationProfileResult(
            profile=normalized,
            max_grade_pct=round(compute_max_grade_pct(normalized), 3),
            source="Open-Elevation",
            corridor_key=None,
        )

    def get_profile(
        self,
        db: Session,
        *,
        corridor_key: str | None = None,
        coordinates: list[list[float]] | None = None,
        origin_lat: float | None = None,
        origin_lon: float | None = None,
        dest_lat: float | None = None,
        dest_lon: float | None = None,
    ) -> ElevationProfileResult:
        """Return elevation profile — cache-first by corridor_key, live fallback otherwise."""
        if corridor_key:
            return self._load_cached_profile(db, corridor_key)

        if coordinates is None:
            if None in (origin_lat, origin_lon, dest_lat, dest_lon):
                raise ElevationServiceError(
                    "Custom route requires coordinates or origin/dest lat/lon pair"
                )
            geometry = self.route_provider.get_route(
                origin_lat, origin_lon, dest_lat, dest_lon  # type: ignore[arg-type]
            )
            coordinates = geometry.coordinates

        if not coordinates:
            raise ElevationServiceError(
                "Custom route requires coordinates or origin/dest lat/lon pair"
            )

        return self._fetch_live_profile(coordinates)
