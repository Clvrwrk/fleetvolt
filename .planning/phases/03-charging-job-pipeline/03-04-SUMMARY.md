---
phase: 03-charging-job-pipeline
plan: 04
subsystem: api
tags: [fastify, postgresql, pg, inputs-hash, async-jobs, node-test]

requires:
  - phase: 03-charging-job-pipeline
    plan: 03
    provides: simulation_runs schema, Python inputs_hash, Celery enqueue endpoint
provides:
  - Node pg pool and DATABASE_URL in Compose api service
  - Cross-language inputs_hash parity with Python test vector
  - POST/GET /v1/simulations with cache hit and HTTP enqueue boundary
  - Fastify inject unit tests for submit and poll paths
  - @integration async lifecycle test scaffold
affects:
  - 03-05-openapi-integration

tech-stack:
  added:
    - pg@8.22.0
    - "@types/pg@^8.11.14"
  patterns:
    - "Node owns simulation_runs lifecycle; poll reads Postgres directly"
    - "Cache SELECT before INSERT; skip enqueue on COMPLETE hit"
    - "buildApp() export for Fastify inject tests with injectable deps"

key-files:
  created:
    - services/api/src/db.ts
    - services/api/src/inputs_hash.ts
    - services/api/src/inputs_hash.test.ts
    - services/api/src/simulations.ts
    - services/api/src/simulations.test.ts
    - services/api/src/app.ts
    - scripts/verify_async_job.sh
  modified:
    - services/api/src/index.ts
    - services/api/package.json
    - docker-compose.yml
    - services/simulator/tests/test_simulations_job.py

key-decisions:
  - "Extracted buildApp into app.ts so index.ts only listens when run as main"
  - "Test script uses node --import tsx for TypeScript on Node 22 dev hosts"
  - "SimulationsDeps interface allows mock pool/fetch in inject tests"

patterns-established:
  - "POST /v1/simulate remains pure proxySimulatorPost unchanged per D-02"
  - "Parameterized $1 SQL only in simulations.ts per T-03-10"

requirements-completed: [PLAT-02]

coverage:
  - id: D1
    description: "Node inputs_hash matches Python committed test vector"
    requirement: PLAT-02
    verification:
      - kind: unit
        ref: "services/api/src/inputs_hash.test.ts#matches Python committed test vector"
        status: pass
      - kind: unit
        ref: "services/simulator/tests/test_inputs_hash.py"
        status: pass
    human_judgment: false
  - id: D2
    description: "POST /v1/simulations cache miss enqueues; cache hit skips enqueue"
    requirement: PLAT-02
    verification:
      - kind: unit
        ref: "services/api/src/simulations.test.ts#returns PENDING on cache miss and enqueues job"
        status: pass
      - kind: unit
        ref: "services/api/src/simulations.test.ts#returns COMPLETE on cache hit without enqueue"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET /v1/simulations/:id polls Postgres row without Python round-trip"
    requirement: PLAT-02
    verification:
      - kind: unit
        ref: "services/api/src/simulations.test.ts#returns status and outputs when row is COMPLETE"
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
    rationale: "Requires full docker compose stack (API, Postgres, sim-worker, Redis)"

duration: 35min
completed: 2026-07-01
status: complete
---

# Phase 3 Plan 04: Fastify Job API Summary

**Node pg client, cross-language inputs_hash parity, and POST/GET /v1/simulations with cache-hit short-circuit and HTTP Celery enqueue boundary**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- `pg` pool singleton wired with `DATABASE_URL` on api Compose service
- Node `computeInputsHash` produces `789f5200…39266c` matching Python test vector
- `POST /v1/simulations` cache lookup, PENDING insert, and FastAPI enqueue on miss
- `GET /v1/simulations/:id` reads `simulation_runs` directly from Postgres
- Six Fastify inject / node:test cases pass; Python unit suite passes with `-m "not integration"`

## Task Commits

1. **Task 1: Node pg pool and inputs_hash parity** - `33882b1` (feat)
2. **Task 2: POST and GET /v1/simulations** - `aeb0c70` (feat)
3. **Task 3: Integration test scaffold** - `b49850a` (feat)

## Files Created/Modified

- `services/api/src/db.ts` - pg Pool from DATABASE_URL
- `services/api/src/inputs_hash.ts` - Canonical SHA-256 matching shared spec
- `services/api/src/inputs_hash.test.ts` - Cross-language parity tests
- `services/api/src/simulations.ts` - Job submit/poll handlers with injectable deps
- `services/api/src/simulations.test.ts` - Cache miss/hit and GET poll inject tests
- `services/api/src/app.ts` - buildApp factory with route registration
- `services/api/src/index.ts` - Main entry; listen only when executed directly
- `docker-compose.yml` - api DATABASE_URL + postgres health dependency
- `services/simulator/tests/test_simulations_job.py` - `test_async_submit_poll_complete`
- `scripts/verify_async_job.sh` - Optional manual curl verification wrapper

## Decisions Made

- Extracted `buildApp()` to `app.ts` for testability without changing runtime behavior
- Test script uses `node --import tsx --test` because local Node 22 lacks stable `.ts` ESM resolution without compile step

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript tests require loader on Node 22**
- **Found during:** Task 1 verification
- **Issue:** `node --test src/**/*.test.ts` fails with ERR_MODULE_NOT_FOUND for `.js` imports from `.ts` sources
- **Fix:** Updated test script to `node --import tsx --test src/**/*.test.ts`
- **Files modified:** services/api/package.json
- **Committed in:** 33882b1

**2. [Rule 2 - Missing Critical] Added @types/pg for strict tsc**
- **Found during:** Task 1 typecheck
- **Issue:** pg@8.22.0 lacked types in strict TS config
- **Fix:** Added `@types/pg` devDependency
- **Files modified:** services/api/package.json, pnpm-lock.yaml
- **Committed in:** 33882b1

**3. [Rule 2 - Missing Critical] Extracted app.ts for buildApp export**
- **Found during:** Task 2 inject tests
- **Issue:** index.ts top-level listen prevented isolated Fastify inject testing
- **Fix:** Moved route registration to `app.ts`; index.ts guards listen with isMain check
- **Files modified:** services/api/src/app.ts, services/api/src/index.ts
- **Committed in:** aeb0c70

## Known Stubs

None — handlers return real DB rows and enqueue responses; integration test requires live stack.

## Issues Encountered

None blocking — Python job tests skip when `fleetvolt_test` DB unreachable (existing pattern).

## Next Phase Readiness

- Plan 03-05 can export OpenAPI for `/v1/simulations` and run full non-integration suite
- Run `pytest tests/test_simulations_job.py -m integration` with stack up to validate end-to-end async path
- Manual check: `scripts/verify_async_job.sh` after `docker compose up -d`

## Self-Check: PASSED

- FOUND: services/api/src/db.ts
- FOUND: services/api/src/inputs_hash.ts
- FOUND: services/api/src/simulations.ts
- FOUND: services/api/src/simulations.test.ts
- FOUND: services/api/src/app.ts
- FOUND: scripts/verify_async_job.sh
- FOUND: 33882b1
- FOUND: aeb0c70
- FOUND: b49850a

---
*Phase: 03-charging-job-pipeline*
*Completed: 2026-07-01*
