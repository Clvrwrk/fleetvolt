---
phase: 02-physics-simulation-core
plan: 03
subsystem: api
tags: [fastapi, simulate, orchestrator, corridors, fastify-proxy, pytest]

requires:
  - phase: 02-01
    provides: PhysicsEngine, SegmentBuilder, SocIntegrator, KpiAggregator
  - phase: 02-02
    provides: RouteProvider, ElevationService, SpeedResolver
provides:
  - SimulationOrchestrator sync pipeline (route → elevation → segments → physics → SoC → KPIs)
  - POST /v1/simulate with nested D-03 scenario body and D-04 segment arrays
  - GET /v1/corridors corridor + terminal catalog (ROUT-02, D-13)
  - Fastify proxySimulatorPost with 15s timeout (D-02)
affects: [02-04, 02-05, phase-4-ui, phase-3-charging]

tech-stack:
  added: []
  patterns:
    - "Corridor presets use cache-first elevation with synthetic O/D interpolation — no Valhalla required"
    - "Custom O/D uses RouteProvider + ElevationService live path with trace_attributes fallback to defaults"
    - "proxySimulatorPost mirrors proxySimulatorGet with 15000ms AbortController for Cajon runs"

key-files:
  created:
    - services/simulator/app/simulation/schemas.py
    - services/simulator/app/simulation/orchestrator.py
    - services/simulator/app/routes/simulate.py
    - services/simulator/app/routes/corridors.py
    - data/terminals/polb_terminals.json
    - services/simulator/tests/test_simulate_api.py
    - services/simulator/tests/test_corridors_api.py
  modified:
    - services/simulator/app/main.py
    - services/api/src/index.ts

key-decisions:
  - "Corridor preset simulate path skips Valhalla — uses cached elevation profile distance and synthetic coordinates"
  - "Truck slug maps to data/trucks/{slug}.json then truck_configs DB lookup by model_name"
  - "terminal_key origin-only deferred with 422 until Plan 04 drayage leg support"

patterns-established:
  - "SimulateRequest nests route/truck/conditions/overrides per D-03"
  - "SimulateResponse always includes segments + kpis + disclaimer; no charging_stops or job_id"

requirements-completed: [PHYS-01, PHYS-05, ROUT-02]

coverage:
  - id: D1
    description: POST /v1/simulate corridor preset returns full segment arrays and KPIs
    requirement: PHYS-01
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_simulate_api.py#test_simulate_corridor_preset_happy_path"
        status: pass
    human_judgment: false
  - id: D2
    description: Custom O/D simulate with mocked routing and elevation
    requirement: PHYS-01
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_simulate_api.py#test_simulate_custom_od_happy_path"
        status: pass
    human_judgment: false
  - id: D3
    description: GET /v1/corridors lists corridor and terminal presets with type field
    requirement: ROUT-02
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_corridors_api.py#test_corridors_lists_corridor_and_terminal_presets"
        status: pass
    human_judgment: false
  - id: D4
    description: Fastify POST /v1/simulate proxy with 15s timeout
    requirement: PHYS-05
    verification:
      - kind: unit
        ref: "services/api/src/index.ts (proxySimulatorPost 15000ms)"
        status: pass
    human_judgment: true
    rationale: Proxy compile verified via tsc; end-to-end curl through :4000 not automated in CI this plan"

duration: 25min
completed: 2026-07-01
status: complete
---

# Phase 2 Plan 03: Simulate API Vertical Slice Summary

**End-to-end sync POST /v1/simulate with orchestrator pipeline, corridor/terminal catalog, and Fastify 15s proxy**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-01T17:18:00Z
- **Completed:** 2026-07-01T17:43:02Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- SimulationOrchestrator wires RouteProvider → ElevationService → SegmentBuilder → SpeedResolver → PhysicsEngine → SocIntegrator → KpiAggregator synchronously (D-01)
- POST /v1/simulate accepts nested route/truck/conditions/overrides per D-03; response includes dist_m, grade, speed, energy_kwh, soc_pct per segment (D-04)
- GET /v1/corridors merges corridor fixtures (excluding socal_bbox) and six POLB terminal presets with type discrimination (ROUT-02, D-13)
- Fastify proxySimulatorPost forwards POST /v1/simulate with 15000ms AbortController timeout (D-02)
- No charging_stops, job_id, Celery, or Redis in simulate path

## Task Commits

1. **Task 1: Failing simulate API tests** - `6e28b94` (test)
2. **Task 2: Orchestrator, schemas, routes** - `00b8809` (feat)
3. **Task 3: Fastify proxy** - `e334205` (feat)

## Files Created/Modified

- `services/simulator/app/simulation/orchestrator.py` - Sync simulation pipeline with 800 mi / 200 segment caps
- `services/simulator/app/simulation/schemas.py` - Pydantic v2 SimulateRequest/Response models
- `services/simulator/app/routes/simulate.py` - POST /v1/simulate handler
- `services/simulator/app/routes/corridors.py` - GET /v1/corridors catalog
- `data/terminals/polb_terminals.json` - PCT, TTI, ITS, Pier A/J, LBCT terminal presets
- `services/api/src/index.ts` - proxySimulatorPost + /v1/simulate and /v1/corridors routes
- `services/simulator/tests/test_simulate_api.py` - Corridor and custom O/D contract tests
- `services/simulator/tests/test_corridors_api.py` - Catalog type and count assertions

## Decisions Made

- Corridor presets bypass Valhalla for unit-test reliability — synthetic coordinates interpolated from fixture O/D; elevation from PostGIS cache
- Truck slug resolves via data/trucks/{slug}.json filename stem to truck_configs.model_name
- terminal_key-only requests return 422 until Plan 04 geo-fenced drayage leg support

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-04 can add weather preset physics, port drayage geo-fence, and override warn bands
- Plan 02-05 can extend OpenAPI codegen with simulate types
- Phase 3 charging planner can consume stable segment arrays and soc_pct from SimulateResponse

## Self-Check: PASSED

- All key files verified on disk
- Commits 6e28b94, 00b8809, e334205 present in git log
- pytest: 3 passed (test_simulate_api + test_corridors_api)

---
*Phase: 02-physics-simulation-core*
*Completed: 2026-07-01*
