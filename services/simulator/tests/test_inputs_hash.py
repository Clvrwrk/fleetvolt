"""Canonical inputs_hash unit tests (D-04, cross-language contract)."""

from __future__ import annotations

from app.simulation.inputs_hash import (
    CHARGER_VERSION,
    PHYSICS_VERSION,
    TEST_VECTOR_EXPECTED_HASH,
    TEST_VECTOR_SCENARIO,
    compute_inputs_hash,
)


def test_committed_test_vector_matches_expected_hash():
    digest = compute_inputs_hash(
        TEST_VECTOR_SCENARIO,
        PHYSICS_VERSION,
        CHARGER_VERSION,
    )
    assert digest == TEST_VECTOR_EXPECTED_HASH
    assert len(digest) == 64
    assert digest == digest.lower()


def test_key_order_independence():
    reordered = {
        "options": {"include_charging": True},
        "overrides": {},
        "conditions": {
            "port_drayage_enabled": False,
            "payload_lbs": 34000,
            "weather_preset": "ideal",
        },
        "truck": {"slug": "ecascadia_438"},
        "route": {"corridor_key": "polb_cajon_pass"},
    }
    baseline = compute_inputs_hash(TEST_VECTOR_SCENARIO, PHYSICS_VERSION, CHARGER_VERSION)
    shuffled = compute_inputs_hash(reordered, PHYSICS_VERSION, CHARGER_VERSION)
    assert baseline == shuffled


def test_float_rounding_six_decimals():
    scenario_a = {
        "route": {
            "origin": {"lat": 33.7540000001, "lon": -118.216},
            "dest": {"lat": 34.108, "lon": -117.29},
        },
        "truck": {"slug": "ecascadia_438"},
        "conditions": {
            "weather_preset": "ideal",
            "payload_lbs": 34000,
            "port_drayage_enabled": False,
        },
        "overrides": {},
        "options": {"include_charging": True},
    }
    scenario_b = {
        **scenario_a,
        "route": {
            "origin": {"lat": 33.754, "lon": -118.216},
            "dest": {"lat": 34.108, "lon": -117.29},
        },
    }
    hash_a = compute_inputs_hash(scenario_a, PHYSICS_VERSION, CHARGER_VERSION)
    hash_b = compute_inputs_hash(scenario_b, PHYSICS_VERSION, CHARGER_VERSION)
    assert hash_a == hash_b
