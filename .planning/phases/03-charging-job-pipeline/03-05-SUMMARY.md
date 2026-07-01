---
phase: 03-charging-job-pipeline
plan: 05
subsystem: api
tags: [openapi, codegen, chrg-06, pytest, model-assumptions, integration-gate]

requires:
  - phase: 03-charging-job-pipeline
    plan: 04
    provides: Fastify job API, async integration test scaffold
provides:
  - CHRG-06 charging planner assumptions in model_assumptions.md
  - OpenAPI/shared-types codegen for charging and job endpoints
  - Phase 3 unit suite green excluding integration
  - Integration test gate documented for stack verification
affects:
  - phase-04-analyst-ui

tech-stack:
  added: []
  patterns:
    - "Gateway job API contract merged into simulator OpenAPI export"
    - "Doc-weight grep test locks CHRG-06 assumptions to response entries"

key-files:
  created: []
  modified:
    - services/simulator/docs/model_assumptions.md
    - services/simulator/app/simulation/schemas.py
    - services/simulator/scripts/export_openapi.py
    - services/simulator/openapi.json
    - packages/shared-types/src/schema.d.ts
    - services/simulator/tests/test_feasibility.py
    - services/simulator/tests/test_simulate_api.py

key-decisions:
  - "Job API OpenAPI paths injected via contract FastAPI app in export_openapi.py (implemented on :4000 gateway)"
  - "Deferred CHRG-06 weights documented as 0.40/0.35/0.25 without naming OR-Tools in public assumptions doc"

patterns-established:
  - "export_openapi merges gateway contract paths without mounting 501 routes on simulator runtime"

requirements-completed: [CHRG-06, PLAT-02]

coverage:
  - id: D1
    description: "CHRG-06 charging planner assumptions documented with deferred weights and greedy rationale"
    requirement: CHRG-06
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_feasibility.py#test_charging_assumptions_doc_weights"
        status: pass
    human_judgment: false
  - id: D2
    description: "OpenAPI codegen includes charging fields and job endpoints with zero drift"
    requirement: PLAT-02
    verification:
      - kind: unit
        ref: "git diff --exit-code packages/shared-types/src/schema.d.ts after codegen"
        status: pass
      - kind: unit
        ref: "services/api tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phase 3 unit suite green excluding integration"
    requirement: PLAT-02
    verification:
      - kind: unit
        ref: "pytest tests/test_charge_curve.py tests/test_charging_planner.py tests/test_feasibility.py tests/test_inputs_hash.py tests/test_simulate_api.py tests/test_simulations_job.py -m not integration"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full async submit→poll→COMPLETE lifecycle with charging outputs"
    requirement: PLAT-02
    verification:
      - kind: integration
        ref: "services/simulator/tests/test_simulations_job.py#test_async_submit_poll_complete"
        status: unknown
    human_judgment: true
    rationale: "Requires docker compose stack (API, Postgres, sim-worker, Redis). Run: docker compose up -d && pytest tests/test_simulations_job.py -m integration"

duration: 25min
completed: 2026-07-01
status: complete
---

# Phase 3 Plan 05: Phase Exit Summary

**CHRG-06 assumptions documented, OpenAPI/shared-types synced for charging and async job schemas, Phase 3 unit suite green**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `## Charging Planner` section to `model_assumptions.md` covering greedy algorithm, deferred weights (0.40/0.35/0.25), SoC thresholds, charger search, dwell integration, and feasibility tiers
- Regenerated `openapi.json` and `schema.d.ts` with `ChargingStopResult`, `FeasibilityResult`, `/v1/simulations`, and `/v1/internal/jobs/{run_id}/enqueue`
- Phase 3 unit suite: 19 passed, 12 skipped (integration), 0 failures with `-m "not integration"`

## Task Commits

1. **Task 1: Complete model_assumptions.md charging section** - `abb1443` (docs)
2. **Task 2: OpenAPI export and shared-types codegen** - `73bfda1` (feat)
3. **Task 3: Phase 3 integration gate and full unit suite** - `ef9d1be` (test)

## Files Created/Modified

- `services/simulator/docs/model_assumptions.md` - CHRG-06 charging planner assumptions per D-07
- `services/simulator/app/simulation/schemas.py` - SimulationJobSubmit/PollResponse models
- `services/simulator/scripts/export_openapi.py` - Gateway job contract merge for codegen
- `services/simulator/openapi.json` - Regenerated with charging and job paths
- `packages/shared-types/src/schema.d.ts` - TypeScript types for charging stops and job API
- `services/simulator/tests/test_feasibility.py` - Doc-weight grep test (T-03-12)
- `services/simulator/tests/test_simulate_api.py` - Explicit feasibility.tier assertion

## Decisions Made

- Gateway job API documented via contract FastAPI app merged at export time — routes implemented on Fastify :4000, not simulator :8000
- Avoided OR-Tools mention in public assumptions doc while still stating v1 is not solver-based

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pnpm turbo codegen blocked by TTY module purge**
- **Found during:** Task 2 verification
- **Issue:** `pnpm turbo run codegen` attempted full node_modules recreation without TTY
- **Fix:** Ran `openapi-typescript` directly from `packages/shared-types/node_modules/.bin`
- **Files modified:** packages/shared-types/src/schema.d.ts (via codegen)
- **Committed in:** 73bfda1

**2. [Rule 1 - Bug] Doc test failed on OR-Tools string in assumptions**
- **Found during:** Task 1 verification
- **Issue:** `test_charging_assumptions_doc_weights` rejects "or-tools" in doc text
- **Fix:** Rephrased deferred scoring note to "external solver-based optimization"
- **Files modified:** services/simulator/docs/model_assumptions.md
- **Committed in:** abb1443

## Known Stubs

None — documentation and types reflect implemented charging planner and job pipeline.

## Integration Verification

Local stack verification (optional, human):

```bash
docker compose up -d
cd services/simulator && uv run pytest tests/test_simulations_job.py -m integration
```

Or: `scripts/verify_async_job.sh`

## Phase 3 Requirement Mapping

| Criterion | Requirement | Evidence |
|-----------|-------------|----------|
| Stops at SoC threshold | CHRG-01 | test_charging_planner.py |
| HD filter power≥350 | CHRG-02 | test_charging_planner.py |
| Feasibility + tier | CHRG-04/05 | test_feasibility.py |
| Documented tradeoffs | CHRG-06 | model_assumptions.md + grep test |
| Async job path | PLAT-02 | test_simulations_job.py (unit + @integration) |

## Next Phase Readiness

- Phase 4 UI can consume `ChargingStopResult`, `FeasibilityResult`, and job poll types from `@fleetvolt/shared-types`
- Run integration suite with stack up before production deploy

## Self-Check: PASSED

- FOUND: services/simulator/docs/model_assumptions.md
- FOUND: services/simulator/openapi.json
- FOUND: packages/shared-types/src/schema.d.ts
- FOUND: abb1443
- FOUND: 73bfda1
- FOUND: ef9d1be

---
*Phase: 03-charging-job-pipeline*
*Completed: 2026-07-01*
