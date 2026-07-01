---
phase: 02-physics-simulation-core
plan: 02
subsystem: api
tags: [valhalla, elevation, speed-resolver, postgis, httpx, pytest]

requires:
  - phase: 02-01
    provides: physics_engine, segment_builder in app/simulation/
provides:
  - RouteProvider with Valhalla /route and /trace_attributes
  - ElevationService cache-first from elevation_profiles
  - SpeedResolver with route-history overlay per D-08
  - model_assumptions.md speed overlay documentation
affects: [02-03, 02-04, orchestrator, simulate-api]

tech-stack:
  added: []
  patterns:
    - "Two-step Valhalla: /route geometry then /trace_attributes edge speeds"
    - "Cache-first elevation by corridor_key with Open-Elevation fallback"
    - "Forward-pass speed overlay from cumulative realized/posted history"

key-files:
  created:
    - services/simulator/app/simulation/route_provider.py
    - services/simulator/app/simulation/elevation_service.py
    - services/simulator/app/simulation/speed_resolver.py
    - services/simulator/docs/model_assumptions.md
    - services/simulator/tests/test_route_provider.py
    - services/simulator/tests/test_elevation_service.py
    - services/simulator/tests/test_speed_resolver.py
  modified:
    - services/simulator/app/routes/routing.py

key-decisions:
  - "Route-history overlay uses distance-weighted prior realized/posted ratio clamped 0.85–1.0 per D-08"
  - "ElevationService reuses data/ingest/elevation.py sampling utilities for live fallback"
  - "corridor_key validated with alphanumeric+underscore pattern for SQL safety"

patterns-established:
  - "RouteProvider centralizes Class 8 Valhalla constants and polyline decode"
  - "ElevationService parameterized SQLAlchemy text queries for cache lookup"

requirements-completed: [ROUT-01, PHYS-03]

coverage:
  - id: D1
    description: RouteProvider returns Class 8 truck geometry with distance and coordinates
    requirement: ROUT-01
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_route_provider.py#test_get_route_returns_geometry"
        status: pass
    human_judgment: false
  - id: D2
    description: trace_attributes yields per-edge posted speeds mapped to cumulative distance
    requirement: ROUT-01
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_route_provider.py#test_parse_trace_attributes_returns_edge_speeds"
        status: pass
    human_judgment: false
  - id: D3
    description: ElevationService loads cached elevation_profiles by corridor_key without HTTP
    requirement: PHYS-03
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_elevation_service.py#test_corridor_cache_hit_no_open_elevation"
        status: pass
    human_judgment: false
  - id: D4
    description: Custom O/D routes fall back to Open-Elevation batch sampling
    requirement: PHYS-03
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_elevation_service.py#test_cache_miss_uses_open_elevation"
        status: pass
    human_judgment: false
  - id: D5
    description: SpeedResolver blends posted limits with route-history overlay clamped 0.85–1.0
    requirement: ROUT-01
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_speed_resolver.py#test_overlay_factor_clamped_at_085"
        status: pass
    human_judgment: false
  - id: D6
    description: model_assumptions.md documents overlay formula and first-segment exception
    requirement: ROUT-01
    verification:
      - kind: unit
        ref: "services/simulator/docs/model_assumptions.md"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-01
status: complete
---

# Phase 2 Plan 02: Spatial Integration Summary

**Valhalla Class 8 routing, cache-first elevation, and D-08 speed overlay wired as simulation spatial inputs**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-01T18:00:00Z
- **Completed:** 2026-07-01T18:25:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- RouteProvider extracts Class 8 Valhalla `/route` and `/trace_attributes` with edge speed parsing
- ElevationService loads `elevation_profiles` by `corridor_key` first; custom routes use Open-Elevation batch fallback
- SpeedResolver applies distance-weighted posted speeds with forward route-history overlay (0.85–1.0 clamp)
- `model_assumptions.md` documents overlay formula for D-08 audit trail

## Task Commits

Each task was committed atomically:

1. **Task 1: RouteProvider with Valhalla route and trace_attributes** - `787767f` (feat)
2. **Task 2: ElevationService cache-first with Open-Elevation fallback** - `96f87a0` (feat)
3. **Task 3: SpeedResolver — posted limits plus route-history overlay** - `4eb47c7` (feat)

## Files Created/Modified

- `services/simulator/app/simulation/route_provider.py` - Valhalla adapter, RouteGeometry, EdgeSpeed parsing
- `services/simulator/app/simulation/elevation_service.py` - Cache-first profile loader with live fallback
- `services/simulator/app/simulation/speed_resolver.py` - Posted speed + overlay forward pass
- `services/simulator/app/routes/routing.py` - Delegates GET /v1/routing/route to RouteProvider
- `services/simulator/docs/model_assumptions.md` - D-08 overlay documentation
- `services/simulator/tests/test_route_provider.py` - httpx mocks + @integration Valhalla test
- `services/simulator/tests/test_elevation_service.py` - Cache hit/miss and validation tests
- `services/simulator/tests/test_speed_resolver.py` - Overlay and truck cap unit tests

## Decisions Made

- Route-history overlay uses distance-weighted prior realized/posted ratio clamped 0.85–1.0 (RESEARCH Pattern 5)
- ElevationService imports `sample_polyline`, `fetch_elevations_batch`, `filter_bridge_spikes` from ingest module
- corridor_key validated with `^[a-z0-9_]+$` before SQL bind (T-02-04 mitigation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RouteProvider, ElevationService, and SpeedResolver ready for SimulationOrchestrator wiring (Plan 02-03)
- GET /v1/routing/route backward compatible; existing Phase 1 integration tests unchanged

## Self-Check: PASSED

- FOUND: services/simulator/app/simulation/route_provider.py
- FOUND: services/simulator/app/simulation/elevation_service.py
- FOUND: services/simulator/app/simulation/speed_resolver.py
- FOUND: services/simulator/docs/model_assumptions.md
- FOUND: services/simulator/tests/test_route_provider.py
- FOUND: services/simulator/tests/test_elevation_service.py
- FOUND: services/simulator/tests/test_speed_resolver.py
- FOUND: 787767f
- FOUND: 96f87a0
- FOUND: 4eb47c7

---
*Phase: 02-physics-simulation-core*
*Completed: 2026-07-01*
