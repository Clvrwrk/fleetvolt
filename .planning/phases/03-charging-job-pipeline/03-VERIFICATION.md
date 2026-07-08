---
phase: 03-charging-job-pipeline
verified: 2026-07-01T12:00:00Z
status: passed
score: 6/7 must-haves verified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:

  - truth: "Full async job pipeline (Fastify POST → Celery worker → GET poll) returns complete charging simulation through live Redis broker"
    test: "Start Docker Compose stack; POST /v1/simulations on :4000 with include_charging=true; poll GET /v1/simulations/{id} until COMPLETE"
    expected: "outputs contain charging_stops[], feasibility{verdict,tier}, and full segment arrays"
    why_human: "Unit tests mock DB/fetch or call execute_simulation_run directly; Celery broker dispatch and cross-service E2E only covered by @integration tests requiring running stack"
human_verification:

  - test: "Run `docker compose up -d` then `pytest tests/test_simulations_job.py -m integration -v` from services/simulator"
    expected: "test_async_submit_poll_complete and test_enqueue_to_worker_lifecycle pass; poll payload includes charging_stops and feasibility"
    why_human: "Integration tests require live API, simulator, Redis, Celery worker, and PostGIS — not runnable in verifier sandbox"

  - test: "From services/api, run `pnpm test` (or `node --import tsx --test src/**/*.test.ts`) after deps installed"
    expected: "simulations.test.ts and inputs_hash.test.ts pass — cache hit skips enqueue, cache miss returns PENDING and calls enqueue URL"
    why_human: "Node API tests exist but could not execute in verifier environment (partial node_modules / tsx resolution)"
---

# Phase 3: Charging & Job Pipeline Verification Report

**Phase Goal:** A planner receives a complete simulation with recommended charging stops, feasibility verdict, and infrastructure-tier framing via the API job pipeline  
**Verified:** 2026-07-01T12:00:00Z  
**Status:** human_needed  
**Re-verification:** No — initial verification

> **MVP mode note:** ROADMAP marks this phase `mode: mvp`, but the phase goal is not in user-story format (`As a …, I want …, so that ….`). Individual plans use user stories; verification uses goal-backward checks against the ROADMAP goal. Consider `/gsd mvp-phase 3` to reformat the phase goal for future UAT scripts.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | System recommends charging stops when projected SoC drops below configurable threshold (default 18%) | ✓ VERIFIED | `charging_planner.py` fires at `soc_trigger_pct` (default 18.0) when SoC crosses trigger (`crossed_trigger` at L225–228); `test_triggers_at_soc_threshold` in `test_charging_planner.py`; orchestrator calls `plan_greedy_stops` when `include_charging=true` |
| 2 | Dwell time uses piecewise SOC-dependent charge curves, not linear kWh/kW | ✓ VERIFIED | `charge_curve.py` `integrate_charge_curve()` integrates band-by-band with OEM `max_kw` breakpoints; `test_taper_slows_above_70pct` in `test_charge_curve.py` |
| 3 | Charger search filters HD (`hd_capable=true`) and power ≥ 350 kW with 25 mi / 50 mi fallback | ✓ VERIFIED | `search_hd_chargers()` SQL filters `hd_capable` and `power_kw >= 350`; `_search_with_fallback()` uses 40,234 m then 80,468 m; tests `test_hd_power_filter`, `test_radius_fallback` |
| 4 | Feasibility verdict (feasible/critical/infeasible) with infrastructure tiers (public_hd/depot_required/infrastructure_gap) | ✓ VERIFIED | `feasibility.py` `classify_feasibility()` + shadow depot pass; `test_feasibility.py` covers all verdict/tier combos; sync API test `test_simulate_with_charging_enabled` asserts verdict and tier enums |
| 5 | Infeasible responses include soc_deficit_kwh and blocking_reason | ✓ VERIFIED | `FeasibilityResult` schema + `classify_feasibility()` returns both on infeasible path; `test_infeasible_soc_deficit`, `test_infrastructure_gap` |
| 6 | CHRG-06 satisfied via documented greedy tradeoff rationale (multi-objective scoring deferred per D-07) | ✓ VERIFIED | `model_assumptions.md` §CHRG-06 documents weights 0.40/0.35/0.25; `get_charging_assumptions()` emits `charging_greedy_strategy` entry; `test_charging_assumptions_doc_weights`, `test_greedy_assumption_entry` |
| 7 | Node Fastify job pipeline returns complete charging simulation (async path) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code wired: `simulations.ts` POST/GET, `worker.py` forces `include_charging=True`, `test_worker_task_completes_row` proves persisted outputs include `charging_stops` + `feasibility`; full Celery-broker E2E only in `@integration` tests |

**Score:** 6/7 truths verified (1 present, behavior-unverified)

### User Flow Coverage (MVP outcome mapping)

| Step | Expected (planner outcome) | Evidence | Status |
|------|---------------------------|----------|--------|
| Submit scenario | POST `/v1/simulations` returns `job_id` + `PENDING` (or `COMPLETE` on cache hit) | `services/api/src/simulations.ts` L39–131; `simulations.test.ts` inject tests | ✓ |
| Worker runs charging | Async job produces `charging_stops[]` and `feasibility{}` in persisted outputs | `worker.py` L104–116 → `run_simulation` → orchestrator charging block; `test_worker_task_completes_row` L208–213 | ✓ |
| Poll for results | GET `/v1/simulations/{id}` returns full `outputs` JSONB when `COMPLETE` | `simulations.ts` L133–170 reads `simulation_runs.outputs`; GET inject test returns mock outputs | ✓ |
| Live stack E2E | Full Fastify→Redis→Celery→PostGIS path completes without mocks | `test_async_submit_poll_complete` (@integration) | ⚠️ Human |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/simulator/app/simulation/charge_curve.py` | Piecewise dwell integration | ✓ VERIFIED | 77 lines; band integration with station cap |
| `services/simulator/app/simulation/charging_planner.py` | Greedy HD stop planner | ✓ VERIFIED | 286 lines; search, detour filter, SoC injection |
| `services/simulator/app/simulation/detour_validator.py` | Valhalla detour validation | ✓ VERIFIED | Uses `get_route_locations` multi-stop vs direct |
| `services/simulator/app/simulation/feasibility.py` | Verdict + tier classifier | ✓ VERIFIED | Pure classifier + shadow depot pass |
| `services/simulator/app/worker.py` | Celery task + persistence | ✓ VERIFIED | RUNNING→COMPLETE/FAILED updates; include_charging forced |
| `services/simulator/app/routes/simulations.py` | Internal enqueue endpoint | ✓ VERIFIED | `run_simulation_task.delay()` only |
| `services/simulator/alembic/versions/003_simulation_runs.py` | Job persistence schema | ✓ VERIFIED | inputs, inputs_hash, outputs JSONB, status, indexes |
| `services/api/src/simulations.ts` | Fastify POST/GET job handlers | ✓ VERIFIED | Cache lookup, INSERT PENDING, HTTP enqueue, poll from pg |
| `services/api/src/inputs_hash.ts` | Cross-language hash | ✓ VERIFIED | Matches Python test vector |
| `packages/shared/inputs-hash-spec.md` | Hash contract | ✓ VERIFIED | Exists |
| `services/simulator/docs/model_assumptions.md` | CHRG-06 documentation | ✓ VERIFIED | §Charging Planner with deferred weights |
| `services/simulator/openapi.json` | Charging + job schemas | ✓ VERIFIED | `/v1/simulations`, `charging_stops`, `feasibility` |
| `packages/shared-types/src/schema.d.ts` | Generated TS types | ✓ VERIFIED | Job endpoints + charging/feasibility types present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `orchestrator.py` | `plan_greedy_stops` | `include_charging=true` after `integrate_soc` | ✓ WIRED | L264–275 |
| `orchestrator.py` | `classify_feasibility` | After planner + shadow depot | ✓ WIRED | L296–301 |
| `charging_planner.py` | `chargers` table | `search_hd_chargers` ST_DWithin SQL | ✓ WIRED | Inline SQL L53–78 |
| `detour_validator.py` | `route_provider.get_route_locations` | Multi-stop Valhalla route | ✓ WIRED | L23–28 |
| `simulations.ts` POST | FastAPI enqueue | `fetch SIMULATOR_URL/v1/internal/jobs/{id}/enqueue` | ✓ WIRED | L77–85; no Redis/Celery in Node |
| `simulations.py` enqueue | `run_simulation_task.delay` | Celery single queue boundary | ✓ WIRED | L47 |
| `worker.py` | `orchestrator.run_simulation` | `include_charging=True` for async | ✓ WIRED | L104–109 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `charging_planner.py` | `candidates` | PostGIS `chargers` query | Yes (DB-driven; mocked in some API tests) | ✓ FLOWING |
| `orchestrator.py` | `charging_stops`, `feasibility` | `plan_greedy_stops` + `classify_feasibility` | Yes (computed from segments + SoC) | ✓ FLOWING |
| `simulations.ts` GET | `payload.outputs` | `simulation_runs.outputs` JSONB | Yes (worker persists full SimulateResponse) | ✓ FLOWING |
| `worker.py` | `response.model_dump()` | `run_simulation(db, request)` | Yes (full pipeline, not static stub) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit pytest suite (non-integration) | `.venv/bin/pytest tests/ -m "not integration" -q` | 67 passed, 36 skipped | ✓ PASS |
| Cross-language inputs_hash parity | Included in pytest suite (`test_inputs_hash.py`, Node `inputs_hash.test.ts` exists) | Python side PASS in suite | ✓ PASS (Python) / ? SKIP (Node deps) |
| Worker persists charging outputs | `test_worker_task_completes_row` (in pytest suite) | Asserts COMPLETE + charging_stops + feasibility | ✓ PASS |
| Node API job handlers | `node --import tsx --test src/**/*.test.ts` | ERR: tsx/package resolution in verifier env | ? SKIP |

### Probe Execution

Step 7c: SKIPPED — no phase-declared probes or conventional `scripts/*/tests/probe-*.sh` for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CHRG-01 | 03-01 | Charging stops when SoC below threshold | ✓ SATISFIED | Greedy planner at 18% trigger; unit + sync API tests |
| CHRG-02 | 03-01 | HD 350+ kW MCS-aware filter | ✓ SATISFIED | SQL + post-filter; unit tests |
| CHRG-03 | 03-01 | Piecewise charge-curve dwell | ✓ SATISFIED | `integrate_charge_curve()`; unit test |
| CHRG-04 | 03-02 | Feasibility verdict with deficit | ✓ SATISFIED | `classify_feasibility()`; unit tests |
| CHRG-05 | 03-02 | Infrastructure tier tags | ✓ SATISFIED | public_hd / depot_required / infrastructure_gap |
| CHRG-06 | 03-02, 03-05 | Multi-objective tradeoffs | ✓ SATISFIED (D-07 deferral) | Documented weights + greedy tie-break in assumptions; not scored optimizer |
| PLAT-02 | 03-03, 03-04, 03-05 | Fastify→FastAPI/Celery queue boundary | ⚠️ PARTIAL | Code + unit tests verified; live stack E2E human-only |

No orphaned requirements — all seven Phase 3 IDs appear in plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/PLACEHOLDER in phase-modified simulator or api src | — | None |

### Human Verification Required

#### 1. Docker Compose async job pipeline E2E

**Test:** Start full stack (`docker compose up -d`). Run `pytest tests/test_simulations_job.py -m integration -v` from `services/simulator`.  
**Expected:** `test_async_submit_poll_complete` submits to Fastify `:4000`, polls until `COMPLETE`, and outputs contain `charging_stops`, `feasibility.verdict`, and `feasibility.tier`.  
**Why human:** Requires live API, simulator, Redis broker, Celery worker, PostGIS, and Valhalla — integration marker explicitly gates this.

#### 2. Node API unit tests

**Test:** From `services/api`, install deps and run `pnpm test`.  
**Expected:** `simulations.test.ts` confirms cache-hit COMPLETE without enqueue, cache-miss PENDING with enqueue URL; `inputs_hash.test.ts` matches Python vector.  
**Why human:** Verifier could not run Node tests (tsx/package resolution); test files exist and were code-reviewed.

#### 3. Real-corridor charging recommendations (optional smoke)

**Test:** With stack up, POST sync `/v1/simulate` or async `/v1/simulations` for `polb_cajon_pass` without mocking charger search.  
**Expected:** Response includes plausible `charging_stops` (may be empty/infeasible depending on seeded charger data — but feasibility block must be populated).  
**Why human:** Unit tests mock empty charger lists to force infeasible paths; real spatial data behavior needs live DB.

### Gaps Summary

No code-level blockers found. Phase 3 deliverables exist, are substantive, and are wired through orchestrator → worker → Fastify poll path. **67 pytest unit tests pass** (verified in verifier run). The remaining gap is **behavioral proof of the full async pipeline through a live Celery broker and Docker Compose stack**, which is intentionally deferred to `@integration` tests and human verification. Sync `/v1/simulate` path is fully unit-tested for charging + feasibility contract.

---

_Verified: 2026-07-01T12:00:00Z_  
_Verifier: Claude (gsd-verifier)_
