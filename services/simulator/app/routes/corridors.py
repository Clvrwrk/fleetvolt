"""GET /v1/corridors — corridor and terminal preset catalog (ROUT-02, D-13)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/v1", tags=["corridors"])

REPO_ROOT = Path(__file__).resolve().parents[4]
CORRIDORS_DIR = REPO_ROOT / "data" / "corridors"
TERMINALS_PATH = REPO_ROOT / "data" / "terminals" / "polb_terminals.json"
EXCLUDED_CORRIDORS = frozenset({"socal_bbox"})


class CorridorCatalogEntry(BaseModel):
    type: Literal["corridor", "terminal"]
    corridor_key: str | None = None
    terminal_key: str | None = None
    name: str
    description: str | None = None
    origin: list[float] | None = Field(
        default=None,
        description="[lat, lon] for corridor presets",
    )
    dest: list[float] | None = Field(
        default=None,
        description="[lat, lon] for corridor presets",
    )
    lat: float | None = None
    lon: float | None = None


class CorridorsResponse(BaseModel):
    presets: list[CorridorCatalogEntry]


def _load_corridor_presets() -> list[CorridorCatalogEntry]:
    entries: list[CorridorCatalogEntry] = []
    if not CORRIDORS_DIR.is_dir():
        return entries

    for path in sorted(CORRIDORS_DIR.glob("*.json")):
        if path.stem in EXCLUDED_CORRIDORS:
            continue
        with path.open(encoding="utf-8") as handle:
            data: dict[str, Any] = json.load(handle)
        corridor_key = data.get("corridor_key", path.stem)
        entries.append(
            CorridorCatalogEntry(
                type="corridor",
                corridor_key=corridor_key,
                name=corridor_key.replace("_", " ").title(),
                description=data.get("description"),
                origin=data.get("origin"),
                dest=data.get("dest"),
            )
        )
    return entries


def _load_terminal_presets() -> list[CorridorCatalogEntry]:
    if not TERMINALS_PATH.is_file():
        return []
    with TERMINALS_PATH.open(encoding="utf-8") as handle:
        terminals = json.load(handle)
    if not isinstance(terminals, list):
        return []

    return [
        CorridorCatalogEntry(
            type="terminal",
            terminal_key=t["terminal_key"],
            name=t["name"],
            description=t.get("description"),
            lat=float(t["lat"]),
            lon=float(t["lon"]),
        )
        for t in terminals
    ]


@router.get("/corridors", response_model=CorridorsResponse)
def list_corridors() -> CorridorsResponse:
    presets = _load_corridor_presets() + _load_terminal_presets()
    return CorridorsResponse(presets=presets)
