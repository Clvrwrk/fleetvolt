---
phase: 2
slug: physics-simulation-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (Python simulator); `tsc --noEmit` (Node API, Wave 0) |
| **Config file** | `services/simulator/pyproject.toml` `[tool.pytest.ini_options]` |
| **Quick run command** | `cd services/simulator && pytest -q -m "not integration" -x` |
| **Full suite command** | `cd services/simulator && pytest -q` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** `cd services/simulator && pytest -q -m "not integration" -x`
- **After every plan wave:** `cd services/simulator && pytest -q -m "not integration"`
- **Before `/gsd-verify-work`:** Full unit suite green; optional `@integration` locally with Valhalla
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PHYS-02 | T-02-SC | N/A | unit | `cd services/simulator && pytest tests/test_physics_engine.py -x` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | PHYS-02, PHYS-05 | T-02-01 | N/A | unit | `cd services/simulator && pytest tests/test_physics_engine.py -q -x` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | PHYS-03 | T-02-02 | Segment cap 200 | unit | `cd services/simulator && pytest tests/test_segment_builder.py -q -x` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | ROUT-01 | T-02-05 | Validate Valhalla payload shape | unit | `cd services/simulator && pytest tests/test_route_provider.py -q -m "not integration" -x` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | PHYS-03 | T-02-04 | Parameterized SQL only | unit | `cd services/simulator && pytest tests/test_elevation_service.py -q -x` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | ROUT-01 | — | N/A | unit | `cd services/simulator && pytest tests/test_speed_resolver.py -q -x` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | PHYS-01 | — | N/A | unit | `cd services/simulator && pytest tests/test_simulate_api.py::test_simulate_corridor_preset_happy_path tests/test_simulate_api.py::test_simulate_custom_od_happy_path -x` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 3 | PHYS-01, PHYS-05, ROUT-02 | T-02-06 | Segment cap 200 | unit | `cd services/simulator && pytest tests/test_simulate_api.py tests/test_corridors_api.py -q -m "not integration" -x` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 3 | PHYS-01 | T-02-SC | N/A | typecheck | `cd services/api && pnpm exec tsc --noEmit` | ✅ | ⬜ pending |
| 02-04-01 | 04 | 4 | PHYS-04, PHYS-07 | — | N/A | unit | `cd services/simulator && pytest tests/test_weather_presets.py tests/test_port_drayage.py -q -x` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 4 | PHYS-08 | T-02-09 | Pydantic ±20% OEM bounds | unit | `cd services/simulator && pytest tests/test_simulate_api.py -q -k "override or oem" -x` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 5 | PHYS-06 | T-02-10 | Deterministic reference cases | unit | `cd services/simulator && pytest tests/test_validation_gate.py tests/test_validation_api.py -q -m "not integration" -x` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 5 | ROUT-04 | T-02-SC | N/A | perf | `cd services/simulator && pytest tests/test_simulate_perf.py::test_simulate_perf_fixture -q -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/simulator/requirements.txt` — add `numpy==2.5.0`, `scipy==1.18.0`
- [ ] `services/simulator/app/simulation/` — physics module package
- [ ] `services/simulator/tests/test_physics_engine.py` — force balance, regen cap, usable kWh
- [ ] `services/simulator/tests/test_segment_builder.py` — 10 mi + 6% split
- [ ] `services/simulator/tests/test_route_provider.py` — httpx mock Valhalla fixtures
- [ ] `services/simulator/tests/test_elevation_service.py` — cache-first + mocked Open-Elevation
- [ ] `services/simulator/tests/test_speed_resolver.py` — overlay formula
- [ ] `services/simulator/tests/test_simulate_api.py` — corridor + custom O/D happy paths
- [ ] `services/simulator/tests/test_corridors_api.py` — corridor + terminal catalog
- [ ] `services/simulator/tests/test_weather_presets.py` — Ideal vs Cold sensitivity
- [ ] `services/simulator/tests/test_port_drayage.py` — polygon geo-fence
- [ ] `services/simulator/tests/test_validation_gate.py` — MAPE ±8–12% fixture elevation
- [ ] `services/simulator/tests/test_validation_api.py` — GET /v1/physics/validation
- [ ] `services/simulator/tests/test_simulate_perf.py` — fixture perf under 10s (no Valhalla)
- [ ] `data/validation/reference_cases.json` — OEM expected energy constants
- [ ] `data/geo/port_polb_lb.geojson` — port boundary polygon
- [ ] `data/terminals/polb_terminals.json` — POLB terminal-only presets
- [ ] `services/api/src/index.ts` — `proxySimulatorPost` with 15s timeout
- [ ] `services/simulator/docs/model_assumptions.md` — physics parameter documentation deliverable

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Valhalla Class 8 route for live O/D | ROUT-01 | Valhalla container not in default CI unit path | `docker compose up valhalla`; run `pytest tests/test_route_provider.py -m integration` |
| Live simulate p95 under 10s with Valhalla | ROUT-04 | Optional integration supplement | `pytest tests/test_simulate_perf.py -m integration` with full stack |
| Open-Elevation live fallback on custom O/D | PHYS-03 | External API rate limits | POST /v1/simulate with custom lat/lon; confirm elevation fetched or 503 with preset suggestion |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
