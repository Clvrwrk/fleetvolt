"""Corridors catalog API tests (ROUT-02, D-13)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_corridors_lists_corridor_and_terminal_presets():
    client = TestClient(app)
    response = client.get("/v1/corridors")
    assert response.status_code == 200
    presets = response.json()["presets"]

    corridors = [p for p in presets if p["type"] == "corridor"]
    terminals = [p for p in presets if p["type"] == "terminal"]

    assert len(corridors) >= 2
    assert len(terminals) >= 2

    corridor_keys = {p["corridor_key"] for p in corridors}
    assert "polb_cajon_pass" in corridor_keys
    assert "socal_bbox" not in corridor_keys

    terminal_keys = {p["terminal_key"] for p in terminals}
    assert "pct" in terminal_keys
    assert "tti" in terminal_keys

    for entry in presets:
        assert entry["type"] in ("corridor", "terminal")
        if entry["type"] == "corridor":
            assert entry["corridor_key"] is not None
            assert entry["origin"] is not None
            assert entry["dest"] is not None
        else:
            assert entry["terminal_key"] is not None
            assert entry["lat"] is not None
            assert entry["lon"] is not None
