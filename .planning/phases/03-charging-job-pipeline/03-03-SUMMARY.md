---
phase: 03-charging-job-pipeline
plan: 03
subsystem: api
tags: [celery, redis, postgresql, async-jobs, inputs-hash, fastapi]

requires:
  - phase: 03-charging-job-pipeline
    plan: 02
    provides: orchestrator charging path, feasibility classifier, sync simulate response
provides:
  - simulation_runs Alembic migration with cache indexes
  - cross-language inputs_hash spec and Python implementation
  - Celery worker run_simulation_task with COMPLETE/FAILED persistence
  - POST /v1/internal/jobs/{id}/enqueue internal boundary
  - sim-worker Docker Compose service
affects:
  - 03-04-fastify-job-api
  - 03-05-integration-tests

tech-stack:
  added:
    - celery[redis]==5.6.3
    - redis>=5.0.2,<6.5
  patterns:
    - "Node → HTTP enqueue → Celery task.delay — no Redis from Fastify"
    - "Worker forces include_charging=True for async jobs per D-02"
    - "Canonical SHA-256 inputs_hash with recursive key sort and 6-decimal floats"

key-files:
  created:
    - services/simulator/alembic/versions/003_simulation_runs.py
    - services/simulator/app/simulation/inputs_hash.py
    - services/simulator/app/worker.py
    - services/simulator/app/routes/simulations.py
    - packages/shared/inputs-hash-spec.md
    - services/simulator/tests/test_inputs_hash.py
    - services/simulator/tests/test_simulations_job.py
  modified:
    - services/simulator/app/main.py
    - services/simulator/requirements.txt
    - docker-compose.yml

key-decisions:
  - "redis-py pinned to 5.x because celery 5.6.3/kombu rejects redis-py 8.0.1; Redis server remains 8-alpine"
  - "execute_simulation_run extracted for unit tests without Redis eager mode"
  - "Worker SessionLocal patched in tests via wrapper to share transactional fixture session"

patterns-established:
  - "Internal enqueue validates PENDING row then calls run_simulation_task.delay only"
  - "FAILED status stores error JSONB with code, message, stage fields"

requirements-completed: [PLAT-02]

coverage:
  - id: D1
    description: "simulation_runs table with inputs_hash and status indexes per D-04"
    requirement: PLAT-02
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_inputs_hash.py"
        status: pass
      - kind: other
        ref: "alembic upgrade head creates simulation_runs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Celery worker runs orchestrator and persists COMPLETE outputs"
    requirement: PLAT-02
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_simulations_job.py#test_worker_task_completes_row"
        status: pass
    human_judgment: false
  - id: D3
    description: "Internal enqueue endpoint respects single queue boundary"
    requirement: PLAT-02
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_simulations_job.py#test_enqueue_pending_run"
        status: pass
    human_judgment: false
  - id: D4
    description: "sim-worker Compose service with visibility_timeout 600"
    requirement: PLAT-02
    verification:
      - kind: other
        ref: "docker compose config includes sim-worker"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-01
status: complete
---

# Phase 3 Plan 03: Async Job Pipeline Summary

**simulation_runs persistence, canonical inputs_hash, Celery worker with internal enqueue endpoint, and sim-worker Compose service**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Alembic 003 creates `simulation_runs` with JSONB inputs/outputs, status lifecycle, and cache indexes
- Python `compute_inputs_hash` matches shared spec test vector `789f5200…39266c`
- Celery `run_simulation_task` runs full charging pipeline and UPDATEs COMPLETE/FAILED rows
- `POST /v1/internal/jobs/{id}/enqueue` dispatches tasks without exposing Redis to Node
- `sim-worker` service added to Docker Compose with production-safe visibility timeout

## Task Commits

1. **Task 1: simulation_runs migration and inputs_hash** - `c8c954d` (feat)
2. **Task 2: Celery worker and sim-worker Compose** - `91b2960` (feat)
3. **Task 3: Internal enqueue endpoint and worker tests** - `2dcd3e0` (feat)

## Files Created/Modified

- `services/simulator/alembic/versions/003_simulation_runs.py` - Job persistence schema (D-04)
- `services/simulator/app/simulation/inputs_hash.py` - Canonical SHA-256 hash with test vector
- `packages/shared/inputs-hash-spec.md` - Cross-language contract for Node parity (Plan 03-04)
- `services/simulator/app/worker.py` - Celery app and `execute_simulation_run`
- `services/simulator/app/routes/simulations.py` - Internal enqueue route
- `services/simulator/tests/test_inputs_hash.py` - Hash vector and float/key-order tests
- `services/simulator/tests/test_simulations_job.py` - Worker completion and enqueue unit tests
- `docker-compose.yml` - `sim-worker` service block

## Decisions Made

- redis-py constrained to 5.x because Celery 5.6.3/kombu cannot resolve redis-py 8.0.1; Redis **server** image unchanged at 8-alpine
- `execute_simulation_run` exposed for direct unit testing without Celery broker
- Worker tests patch `SessionLocal` to reuse transactional pytest session

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] redis-py version incompatible with celery[redis]==5.6.3**
- **Found during:** Task 2
- **Issue:** Plan specified `redis==8.0.1` but pip resolution fails (kombu requires redis<6.5)
- **Fix:** Pinned `redis>=5.0.2,<6.5` alongside `celery[redis]==5.6.3`
- **Files modified:** services/simulator/requirements.txt
- **Committed in:** 91b2960

## Known Stubs

None — worker persists full charging simulation outputs including `feasibility.verdict`.

## Issues Encountered

- Job tests skip when `fleetvolt_test` DB unreachable; pass with `DATABASE_URL` pointing at running Postgres (same pattern as Phase 2/3 simulate tests)

## Next Phase Readiness

- Plan 03-04 can add Fastify `POST/GET /v1/simulations` with Node `inputs_hash` parity against shared spec
- Full HTTP→Redis→worker lifecycle marked `@integration` for Plan 05

## Self-Check: PASSED

- FOUND: services/simulator/alembic/versions/003_simulation_runs.py
- FOUND: services/simulator/app/worker.py
- FOUND: services/simulator/app/routes/simulations.py
- FOUND: services/simulator/app/simulation/inputs_hash.py
- FOUND: packages/shared/inputs-hash-spec.md
- FOUND: services/simulator/tests/test_inputs_hash.py
- FOUND: services/simulator/tests/test_simulations_job.py
- FOUND: c8c954d
- FOUND: 91b2960
- FOUND: 2dcd3e0

---
*Phase: 03-charging-job-pipeline*
*Completed: 2026-07-01*
