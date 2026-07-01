"""Canonical SHA-256 inputs hash for simulation_runs cache (D-04)."""

from __future__ import annotations

import hashlib
import json
from typing import Any

PHYSICS_VERSION = "phase3-v1"
CHARGER_VERSION = "afdc-static-v1"

TEST_VECTOR_SCENARIO: dict[str, Any] = {
    "route": {"corridor_key": "polb_cajon_pass"},
    "truck": {"slug": "ecascadia_438"},
    "conditions": {
        "weather_preset": "ideal",
        "payload_lbs": 34000,
        "port_drayage_enabled": False,
    },
    "overrides": {},
    "options": {"include_charging": True},
}

def _canonicalize(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, dict):
        return {key: _canonicalize(item) for key, item in sorted(value.items())}
    if isinstance(value, list):
        return [_canonicalize(item) for item in value]
    return value


def compute_inputs_hash(
    scenario_dict: dict[str, Any],
    physics_version: str,
    charger_version: str,
) -> str:
    payload = {
        "charger_version": charger_version,
        "physics_version": physics_version,
        "scenario": scenario_dict,
    }
    canonical = _canonicalize(payload)
    serialized = json.dumps(
        canonical,
        separators=(",", ":"),
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


# Compute committed test vector at import time so spec and tests stay aligned.
TEST_VECTOR_EXPECTED_HASH = compute_inputs_hash(
    TEST_VECTOR_SCENARIO,
    PHYSICS_VERSION,
    CHARGER_VERSION,
)
