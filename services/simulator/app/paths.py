"""Resolve data directory for local monorepo vs Docker (/data volume)."""

from __future__ import annotations

import os
from pathlib import Path


def data_root() -> Path:
    """Root of mounted data files (corridors, trucks, geo, validation)."""
    if env := os.environ.get("FLEETVOLT_DATA_ROOT"):
        return Path(env)
    here = Path(__file__).resolve()
    # services/simulator/app/paths.py -> repo root at parents[3]
    local = here.parents[3] / "data"
    if local.is_dir():
        return local
    raise FileNotFoundError(
        "FLEETVOLT_DATA_ROOT not set and local data/ not found; "
        "set FLEETVOLT_DATA_ROOT=/data in Docker"
    )
