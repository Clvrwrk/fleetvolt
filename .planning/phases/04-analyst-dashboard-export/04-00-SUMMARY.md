---
phase: 04-analyst-dashboard-export
plan: 00
subsystem: api
tags: [fastify, openapi, simulations, routing-proxy, audit-metadata]

requires:
  - phase: 03-charging-job-pipeline
    provides: simulation_runs table with inputs_hash and version columns, PLAT-02 job API
provides:
  - Poll and cache-hit responses with inputs_hash, physics_version, charger_version, inputs
  - GET /v1/routing/route Fastify proxy for browser map geometry
  - Regenerated OpenAPI schema and shared-types codegen
affects: [04-01, 04-02, 04-04, 04-06]

tech-stack:
  added: []
  patterns:
    - appendAuditFields helper for poll/cache-hit audit metadata
    - proxySimulatorGet passthrough for routing geometry

key-files:
  created: []
  modified:
    - services/api/src/simulations.ts
    - services/api/src/simulations.test.ts
    - services/api/src/app.ts
    - services/simulator/app/simulation/schemas.py
    - services/simulator/openapi.json
    - packages/shared-types/src/schema.d.ts

key-decisions:
  - "Audit fields optional on OpenAPI models; included in poll payload when present in DB row"
  - "Routing proxy uses existing proxySimulatorGet with query passthrough per Pattern 2"

patterns-established:
  - "appendAuditFields: shared helper for inputs_hash, physics_version, charger_version, inputs on responses"

requirements-completed: [SCEN-04]

coverage:
  - id: D1
    description: GET /v1/simulations/{id} returns inputs_hash, physics_version, charger_version, inputs on poll
    requirement: SCEN-04
    verification:
      - kind: unit
        ref: "services/api/src/simulations.test.ts#returns audit metadata when row is COMPLETE per D-12"
        status: pass
    human_judgment: false
  - id: D2
    description: POST /v1/simulations cache hit includes audit metadata per D-15
    requirement: SCEN-04
    verification:
      - kind: unit
        ref: "services/api/src/simulations.test.ts#returns COMPLETE on cache hit with audit metadata per D-15"
        status: pass
    human_judgment: false
  - id: D3
    description: GET /v1/routing/route proxied through Fastify for browser route geometry
    verification:
      - kind: other
        ref: "grep -c 'routing/route' services/api/src/app.ts"
        status: pass
    human_judgment: false

duration: 15 min
completed: 2026-07-01
status: complete
---

# Phase 4 Plan 00: API Audit Contract Summary

**Simulation poll and cache-hit responses expose inputs_hash and model versions; routing geometry available via Fastify proxy**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-01T20:10:50Z
- **Completed:** 2026-07-01T20:26:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Extended `GET /v1/simulations/{id}` and cache-hit `POST /v1/simulations` with `inputs_hash`, `physics_version`, `charger_version`, and `inputs` per D-12/D-15/SCEN-04
- Regenerated `openapi.json` and `schema.d.ts` with audit fields on `SimulationJobPollResponse` and `SimulationJobSubmitResponse`
- Added `GET /v1/routing/route` proxy via `proxySimulatorGet` for client map segment merge

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED):** add failing audit metadata tests - `18e1785` (test)
2. **Task 1 (GREEN):** extend poll/cache with audit metadata - `1bc57ef` (feat)
3. **Task 2:** proxy routing route endpoint - `ab75edb` (feat)

## Files Created/Modified

- `services/api/src/simulations.ts` - Extended SQL SELECT and poll/cache payload with audit fields
- `services/api/src/simulations.test.ts` - Audit metadata assertions for poll and cache hit
- `services/api/src/app.ts` - `GET /v1/routing/route` proxy registration
- `services/simulator/app/simulation/schemas.py` - Optional audit fields on job response models
- `services/simulator/openapi.json` - Regenerated gateway contract schemas
- `packages/shared-types/src/schema.d.ts` - Codegen updated types for audit fields

## Decisions Made

- Audit fields included when present on DB row (optional in OpenAPI, not required for PENDING jobs)
- Reused `appendAuditFields` helper to keep poll and cache-hit paths consistent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created local Python venv for OpenAPI export**
- **Found during:** Task 1 (OpenAPI regeneration)
- **Issue:** System Python lacked FastAPI; PEP 668 blocked global pip install
- **Fix:** Created `services/simulator/.venv` and ran export via venv Python
- **Files modified:** services/simulator/openapi.json (regenerated)
- **Verification:** export_openapi.py succeeded; codegen updated schema.d.ts
- **Committed in:** 1bc57ef

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Environment setup only; no scope or API contract changes.

## Issues Encountered

- `pnpm run codegen` failed due to workspace install/build policy; used `npx openapi-typescript` directly with same result

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SCEN-04 backend contract satisfied for Plan 01 (analyst workspace) and export waves
- Web UI can poll audit metadata and fetch route geometry via `/api/v1/routing/route`

## Self-Check: PASSED

- FOUND: services/api/src/simulations.ts
- FOUND: services/api/src/app.ts
- FOUND: packages/shared-types/src/schema.d.ts
- FOUND: services/simulator/openapi.json
- FOUND: 18e1785
- FOUND: 1bc57ef
- FOUND: ab75edb

---
*Phase: 04-analyst-dashboard-export*
*Completed: 2026-07-01*
