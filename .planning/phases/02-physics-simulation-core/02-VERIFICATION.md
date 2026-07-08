---
phase: 02-physics-simulation-core
verified: 2026-07-01T20:00:00Z
status: human_needed
score: 7/13 must-haves verified
behavior_unverified: 6
overrides_applied: 0
behavior_unverified_items:
  - truth: "POST /v1/simulate returns 200 with full segment arrays and KPIs for polb_cajon_pass corridor preset"
    test: "Start Postgres (fleetvolt_test), run pytest tests/test_simulate_api.py -v"
    expected: "All six simulate API tests pass; each segment has dist_m, grade, speed, energy_kwh, soc_pct; response has no charging_stops or job_id"
    why_human: "DB-dependent API tests skipped in verifier environment (DATABASE_URL unreachable); code and tests exist but E2E not exercised here"
  - truth: "GET /v1/physics/validation returns MAPE per case with overall_pass within ±8–12% band"
    test: "With Postgres running, run pytest tests/test_validation_gate.py tests/test_validation_api.py -v"
    expected: "Both flat_highway_oem and polb_cajon_grade pass with 8% ≤ MAPE ≤ 12%; overall_pass true"
    why_human: "MAPE integration tests skipped without Postgres; band logic unit tests pass"
  - truth: "Fixture-based simulate completes under 10s (ROUT-04)"
    test: "With Postgres, run pytest tests/test_simulate_perf.py::test_simulate_perf_fixture -v"
    expected: "Wall time < 10s for polb_cajon_pass corridor simulate"
    why_human: "Perf test skipped without Postgres in verifier run"
  - truth: "Inline truck overrides appear in assumptions[] with reset_to_oem semantics"
    test: "With Postgres, run pytest tests/test_simulate_api.py::test_overrides_audit tests/test_simulate_api.py::test_reset_to_oem -v"
    expected: "Override fields show user_override source; reset_to_oem restores oem_default values"
    why_human: "Override API tests skipped without Postgres"
  - truth: "Regen power is suppressed when SoC exceeds regen_soc_cutoff (90%)"
    test: "Run downhill segment with initial_soc_pct=95 and assert regen_kwh==0"
    expected: "Only aux draw applied when soc > regen_soc_cutoff per soc_integrator.py"
    why_human: "test_regen_capped_on_steep_downhill uses initial_soc=50%; no test exercises soc>90 cutoff branch"
  - truth: "Fastify :4000 proxies POST /v1/simulate and GET /v1/physics/validation to Python simulator"
    test: "Start full stack (api + simulator + postgres), POST /v1/simulate via :4000 and GET /v1/physics/validation"
    expected: "200 responses with same payload shape as direct FastAPI calls; simulate proxy respects 15s timeout"
    why_human: "Proxy wiring verified by code inspection only; no live stack in verifier environment"
human_verification:
  - test: "Confirm MAPE calibration approach is acceptable for Phase 2 exit"
    expected: "Team accepts that expected_total_kwh (570 flat, 222 Cajon) are model-calibrated targets documented in reference_cases.json source_notes and model_assumptions.md — not raw OEM marketing kWh — while preserving transparent OEM claims in source_notes for future physics retune"
    why_human: "Calibration is intentional (Plan 05) but changes PHYS-06 semantics from literal OEM comparison to self-consistent gate; requires stakeholder acknowledgment"
  - test: "Run full non-integration suite with Postgres available"
    expected: "pytest -m 'not integration' reports 78+ passed with zero failures on simulate, validation, and perf tests"
    why_human: "Verifier environment had no Postgres; 48 passed / 30 skipped in actual run"
  - test: "Fastify proxy E2E for simulate and validation endpoints"
    expected: "Requests through services/api :4000 return same results as direct simulator :8000"
    why_human: "Proxy code present; end-to-end timing and error forwarding need live stack"
---

# Phase 2: Physics Simulation Core Verification Report

**Phase Goal:** A planner can run physics-grounded POLB drayage + Cajon Pass simulation and receive credible energy/SoC results without charging recommendations

**Verified:** 2026-07-01T20:00:00Z  
**Status:** human_needed  
**Re-verification:** No — initial verification

## User Flow Coverage (MVP Mode)

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Planner selects POLB/Cajon corridor preset | `GET /v1/corridors` lists `polb_cajon_pass` and terminal presets | `corridors.py` loads `data/corridors/*.json` + `polb_terminals.json`; `test_corridors_api.py` **PASSED** | ✓ VERIFIED |
| Planner configures truck, payload, weather, port drayage | Nested `SimulateRequest` with `route{}`, `truck{}`, `conditions{}`, `overrides{}` | `schemas.py` Pydantic models; weather/port modules wired in `orchestrator.py` | ✓ VERIFIED |
| Planner submits simulation | `POST /v1/simulate` sync response | `simulate.py` → `run_simulation()`; Fastify proxy at `index.ts:194` | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED |
| Planner receives segment energy + SoC + KPIs | Full `segments[]` with `dist_m`, `grade`, `speed`, `energy_kwh`, `soc_pct`; KPIs include total kWh, Wh/mi, regen, time | `orchestrator.py` builds `SegmentResult`/`KpiResult`; unit tests pass | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (API E2E skipped) |
| Cajon grade impact visible | Steeper grades on grade-heavy corridor vs flat | `segment_builder.py` D-07 splits; `test_cajon_synthetic_has_steep_segment` **PASSED**; cached elevation fixtures in `data/corridors/polb_cajon_pass.json` | ✓ VERIFIED |
| No charging recommendations | Response excludes charging stops / job queue | `SimulateResponse` has no charging fields; `test_simulate_api._assert_simulate_response` asserts absence | ✓ VERIFIED |
| OEM validation gate available | `GET /v1/physics/validation` MAPE pass/fail | `validation.py` + `validation_cases.py`; DB tests **SKIPPED** without Postgres | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Physics engine computes rolling + aero + grade + aux − regen per segment (PHYS-02) | ✓ VERIFIED | `physics_engine.py` vectorized `segment_forces`; `test_flat_segment_rolling_resistance_dominates` **PASSED** |
| 2 | Forward SoC decreases on uphill routes; regen power capped on downhill (PHYS-05) | ✓ VERIFIED | `soc_integrator.py`; `test_soc_decreases_monotonically_uphill`, `test_regen_capped_on_steep_downhill` **PASSED** |
| 3 | Regen suppressed when SoC > regen_soc_cutoff (90%) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Branch at `soc_integrator.py:46-51`; no test at initial_soc > 90% |
| 4 | 10-mile segmentation with 6% grade subdivision shows Cajon impact (PHYS-03, D-05/D-07) | ✓ VERIFIED | `segment_builder.py`; `test_steep_profile_subdivides_more_than_flat`, `test_cajon_synthetic_has_steep_segment` **PASSED** |
| 5 | Weather presets measurably affect Wh/mi (PHYS-04, ROADMAP SC3) | ✓ VERIFIED | `weather.py` D-09 table; `test_cold_wh_per_mi_at_least_5pct_higher_than_ideal` **PASSED** |
| 6 | Port drayage applies only inside POLB/LB polygon (PHYS-07) | ✓ VERIFIED | `port_drayage.py` + `data/geo/port_polb_lb.geojson`; `test_port_drayage_only_affects_in_port_segments` **PASSED** |
| 7 | POST /v1/simulate returns full segment arrays + KPIs (PHYS-01, D-03/D-04) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Route + orchestrator wired; `test_simulate_api.py` **SKIPPED** (Postgres unreachable) |
| 8 | Inline overrides with assumptions[] audit trail (PHYS-08) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `overrides.py` wired; override API tests **SKIPPED** without Postgres |
| 9 | GET /v1/physics/validation MAPE ±8–12% pass/fail (PHYS-06) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `validation_cases.py` + endpoint exist; MAPE integration tests **SKIPPED** without Postgres |
| 10 | POLB corridor/terminal presets selectable (ROUT-02) | ✓ VERIFIED | `corridors.py`; `test_corridors_lists_corridor_and_terminal_presets` **PASSED** |
| 11 | Class 8 Valhalla truck routing with height/weight/axle (ROUT-01) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `route_provider.py` CLASS8_TRUCK_OPTIONS; integration tests deselected/skipped — code present, live Valhalla not exercised |
| 12 | Single scenario <10s (ROUT-04) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `test_simulate_perf_fixture` **SKIPPED** without Postgres |
| 13 | No charging recommendations in simulate response | ✓ VERIFIED | `SimulateResponse` schema; grep confirms no charging fields in simulate modules |

**Score:** 7/13 truths verified (6 present, behavior-unverified)

### MAPE Calibration (Plan 05 — User Requested Review)

| Aspect | Finding | Status |
|--------|---------|--------|
| Documentation | `expected_total_kwh` calibration explained in `data/validation/reference_cases.json` `source_notes`, `services/simulator/docs/model_assumptions.md` §OEM Validation, and `02-05-SUMMARY.md` deviations section | ✓ Documented |
| Values | Flat highway: 570 kWh (OEM marketing ~394 kWh usable baseline noted in source_notes); Cajon: 222 kWh (tuned to cached fixture profile) | Transparent |
| Acceptability | Acceptable as **interim Phase 2 gate** — validates model consistency against calibrated references, not literal OEM marketing claims. Future physics retune to reduce offset is noted in Plan 05. Requires human acknowledgment before treating PHYS-06 as OEM-credible for client deliverables. | ⚠️ Human decision |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/simulator/app/simulation/physics_engine.py` | NumPy force balance | ✓ VERIFIED | 104 lines; vectorized batch |
| `services/simulator/app/simulation/soc_integrator.py` | Forward SoC integration | ✓ VERIFIED | Sequential loop with regen caps |
| `services/simulator/app/simulation/segment_builder.py` | 10-mile + grade splits | ✓ VERIFIED | D-05/D-07 implemented |
| `services/simulator/app/simulation/orchestrator.py` | End-to-end pipeline | ✓ VERIFIED | 276 lines; wired to all modules |
| `services/simulator/app/simulation/route_provider.py` | Valhalla Class 8 | ✓ VERIFIED | CLASS8_TRUCK_OPTIONS; /route + trace_attributes |
| `services/simulator/app/simulation/elevation_service.py` | Cache-first elevation | ✓ VERIFIED | PostGIS SELECT + live fallback |
| `services/simulator/app/simulation/weather.py` | D-09 presets | ✓ VERIFIED | 4 presets with thermal/aux/headwind |
| `services/simulator/app/simulation/port_drayage.py` | Geo-fenced drayage | ✓ VERIFIED | Shapely polygon check |
| `services/simulator/app/routes/simulate.py` | POST /v1/simulate | ✓ VERIFIED | Registered in main.py |
| `services/simulator/app/routes/corridors.py` | GET /v1/corridors | ✓ VERIFIED | Corridor + terminal catalog |
| `services/simulator/app/routes/validation.py` | GET /v1/physics/validation | ✓ VERIFIED | MAPE gate endpoint |
| `data/validation/reference_cases.json` | D-11 reference cases | ✓ VERIFIED | 2 cases with calibrated expected kWh |
| `services/simulator/docs/model_assumptions.md` | Audit trail docs | ✓ VERIFIED | Speed overlay, weather, port, OEM validation |
| `packages/shared-types/src/schema.d.ts` | OpenAPI codegen | ✓ VERIFIED | `/v1/simulate`, `/v1/physics/validation` paths; `git diff --exit-code` clean |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `simulate.py` | `orchestrator.run_simulation` | POST handler | ✓ WIRED | Direct call |
| `orchestrator.py` | route/elevation/physics/soc modules | `run_simulation` pipeline | ✓ WIRED | Full import chain |
| `validation.py` | `validation_cases.run_all_validation` | GET handler | ✓ WIRED | Runs both reference cases |
| `validation_cases.py` | `orchestrator.run_simulation` | Per-case execution | ✓ WIRED | Flat case uses mocks |
| `corridors.py` | `data/corridors/*.json` | File load | ✓ WIRED | Excludes socal_bbox |
| `services/api/src/index.ts` | simulator `/v1/simulate` | `proxySimulatorPost` 15s | ✓ WIRED | Code present; E2E not run |
| `services/api/src/index.ts` | simulator `/v1/physics/validation` | `proxySimulatorGet` 15s | ✓ WIRED | Code present; E2E not run |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `orchestrator.py` | `segments[]`, `kpis` | Truck DB seed + elevation cache + physics arrays | Yes (when DB available) | ✓ FLOWING |
| `corridors.py` | `presets[]` | JSON fixtures on disk | Yes | ✓ FLOWING |
| `validation_cases.py` | `cases[]` MAPE | `run_simulation` output vs reference_cases.json | Yes (when DB available) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Non-integration unit suite | `uv run pytest -m "not integration" -q` | 48 passed, 30 skipped, 12 deselected in 15.5s | ✓ PASS (partial — DB tests skipped) |
| Corridors API | `test_corridors_api.py` | PASSED | ✓ PASS |
| Weather sensitivity | `test_cold_wh_per_mi_at_least_5pct_higher_than_ideal` | PASSED | ✓ PASS |
| MAPE in-band (DB) | `test_flat_highway_oem_mape_in_band` | SKIPPED — Postgres unreachable | ? SKIP |
| Simulate API (DB) | `test_simulate_corridor_preset_happy_path` | SKIPPED — Postgres unreachable | ? SKIP |
| ROUT-04 perf (DB) | `test_simulate_perf_fixture` | SKIPPED — Postgres unreachable | ? SKIP |
| OpenAPI drift | `git diff --exit-code packages/shared-types/src/schema.d.ts` | exit 0 | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no phase-declared probes or `scripts/*/tests/probe-*.sh` for Phase 2.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PHYS-01 | 02-03 | Input O/D, truck, payload, conditions to run simulation | ⚠️ NEEDS HUMAN | API wired; DB E2E tests skipped |
| PHYS-02 | 02-01 | Segment-based NumPy physics | ✓ SATISFIED | physics_engine + unit tests |
| PHYS-03 | 02-01/02-02 | Elevation + Cajon grade impact | ✓ SATISFIED | segment_builder + elevation fixtures |
| PHYS-04 | 02-04 | Weather presets | ✓ SATISFIED | weather.py + tests |
| PHYS-05 | 02-01/02-03 | SoC profile + KPIs | ✓ SATISFIED | soc_integrator + kpi_aggregator + unit tests |
| PHYS-06 | 02-05 | ±8–12% MAPE validation | ⚠️ NEEDS HUMAN | Endpoint + tests exist; DB tests skipped; calibration documented |
| PHYS-07 | 02-04 | Port drayage profile | ✓ SATISFIED | port_drayage.py + tests |
| PHYS-08 | 02-04 | Physics overrides + audit | ⚠️ NEEDS HUMAN | overrides.py wired; API tests skipped |
| ROUT-01 | 02-02 | Class 8 Valhalla routing | ⚠️ NEEDS HUMAN | route_provider.py; integration not run |
| ROUT-02 | 02-03 | Corridor/terminal presets | ✓ SATISFIED | corridors API test passed |
| ROUT-04 | 02-05 | <10s simulate | ⚠️ NEEDS HUMAN | perf test skipped without Postgres |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/placeholder stubs in phase artifacts | — | Clean |

### Human Verification Required

### 1. Postgres-backed test suite

**Test:** Start Postgres (`fleetvolt_test`), run `cd services/simulator && uv run pytest -m "not integration" -v`  
**Expected:** All simulate, validation, and perf tests pass (SUMMARY claims 78 passed)  
**Why human:** Verifier run: 48 passed / 30 skipped due to DATABASE_URL unreachable

### 2. MAPE calibration acceptance

**Test:** Review `data/validation/reference_cases.json` source_notes and `model_assumptions.md` §OEM Validation  
**Expected:** Team accepts calibrated expected kWh (570/222) as interim Phase 2 gate, with OEM marketing values preserved in source_notes for future retune  
**Why human:** Calibration changes PHYS-06 from literal OEM comparison to model-tuned band — documented and intentional but needs stakeholder sign-off

### 3. Fastify proxy E2E

**Test:** With full stack running, POST `/v1/simulate` and GET `/v1/physics/validation` via Fastify :4000  
**Expected:** Same 200 responses and payload shapes as direct simulator :8000  
**Why human:** Proxy wiring verified in code only

### 4. Regen SOC cutoff at 90%

**Test:** Add/run test with initial_soc=95 on downhill segment  
**Expected:** `regen_kwh == 0`, only aux energy drawn  
**Why human:** Cutoff branch present in code but not exercised by existing tests

---

_Verified: 2026-07-01T20:00:00Z_  
_Verifier: Claude (gsd-verifier)_
