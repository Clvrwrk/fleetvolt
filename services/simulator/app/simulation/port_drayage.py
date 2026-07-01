"""Geo-fenced port drayage penalties for POLB/Long Beach harbor (D-10)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from shapely.geometry import Point, shape

REPO_ROOT = Path(__file__).resolve().parents[4]
PORT_GEOJSON_PATH = REPO_ROOT / "data" / "geo" / "port_polb_lb.geojson"

PORT_SPEED_CAP_MPH = 25.0
PORT_AUX_KW = 18.0


@lru_cache(maxsize=1)
def _load_port_polygon() -> Any:
    with PORT_GEOJSON_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    geometry = payload["features"][0]["geometry"]
    return shape(geometry)


def segment_in_port(lon: float, lat: float) -> bool:
    """True when segment midpoint falls inside the POLB/LB harbor polygon."""
    return Point(lon, lat).within(_load_port_polygon())


def apply_port_drayage(
    segments: list[dict[str, Any]],
    speed_mph: np.ndarray,
    aux_kw: np.ndarray,
    *,
    enabled: bool,
) -> tuple[np.ndarray, np.ndarray]:
    """Apply stop-go aux bump and speed cap only to in-port segment midpoints."""
    speed_out = np.array(speed_mph, dtype=np.float64, copy=True)
    aux_out = np.array(aux_kw, dtype=np.float64, copy=True)

    if not enabled:
        return speed_out, aux_out

    for i, segment in enumerate(segments):
        if segment_in_port(float(segment["mid_lon"]), float(segment["mid_lat"])):
            speed_out[i] = min(speed_out[i], PORT_SPEED_CAP_MPH)
            aux_out[i] = max(aux_out[i], PORT_AUX_KW)

    return speed_out, aux_out
