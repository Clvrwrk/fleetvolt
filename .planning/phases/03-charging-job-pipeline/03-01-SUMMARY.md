---
phase: 03-charging-job-pipeline
plan: 01
subsystem: api
tags: [charging, fastapi, postgis, valhalla, pytest, numpy]

requires:
  - phase: 02-physics-simulation-core
    provides: sync POST /v1/simulate pipeline, segment arrays, TruckParams, RouteProvider
provides:
  - integrate_charge_curve piecewise OEM dwell integration
  - plan_greedy_stops greedy HD charger selection
  - detour_seconds Valhalla truck detour validation
  - ChargingConditionsSpec / SimulateOptions / ChargingStopResult schemas
  - Sync simulate charging_stops when options.include_charging=true
affects:
  - 03-02-feasibility
  - 03-03-async-job-pipeline
  - 04-analyst-dashboard

tech-stack:
  added: []
  patterns:
    - "Inline PostGIS ST_DWithin for HD charger search (no HTTP self-call)"
    - "Valhalla multi-stop get_route_locations for detour validation"
    - "SimulateOptions.include_charging gates charging_stops in response"

key-files:
  created:
    - services/simulator/app/simulation/charge_curve.py
    - services/simulator/app/simulation/charging_planner.py
    - services/simulator/app/simulation/detour_validator.py
    - services/simulator/tests/test_charge_curve.py
    - services/simulator/tests/test_charging_planner.py
  modified:
    - services/simulator/app/simulation/route_provider.py
    - services/simulator/app/simulation/schemas.py
    - services/simulator/app/simulation/orchestrator.py
    - services/simulator/app/routes/simulate.py
    - services/simulator/tests/test_simulate_api.py

key-decisions:
  - "charging_stops omitted from JSON when include_charging=false via response_model_exclude_none"
  - "Phase 2 simulate API tests pass include_charging=false to preserve segment-only contract"
  - "feasibility=None placeholder deferred to Plan 03-02"

patterns-established:
  - "Greedy planner modifies soc array in-place after charge injection (D-16)"
  - "25 mi search with 50 mi fallback for zero HD candidates (D-17)"

requirements-completed: [CHRG-01, CHRG-02, CHRG-03]

coverage:
  - id: D1
    description: "Piecewise charge-curve dwell exceeds naive linear lower bound above 70% SOC taper"
    requirement: CHRG-03
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_charge_curve.py#test_taper_slows_above_70pct"
        status: pass
    human_judgment: false
  - id: D2
    description: "Greedy planner triggers at 18% SoC, filters HD 350kW+, radius fallback, detour cap, tie-break"
    requirement: CHRG-01
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_charging_planner.py"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sync POST /v1/simulate returns charging_stops when include_charging=true"
    requirement: CHRG-01
    verification:
      - kind: integration
        ref: "services/simulator/tests/test_charging_planner.py#test_simulate_include_charging_returns_stops_key"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-01
status: complete
---

# Phase 3 Plan 01: Charge Curve & Greedy Planner Summary

**Piecewise OEM charge-curve dwell, greedy HD stop planner with Valhalla detour validation, wired into sync POST /v1/simulate via include_charging option**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- `integrate_charge_curve` integrates energy band-by-band using OEM `max_kw` breakpoints scaled on `usable_kwh` (D-14)
- `plan_greedy_stops` forward-scans SoC, searches HD chargers at 25/50 mi radii, validates ≤10 min detour, selects shortest detour then highest power (D-06/D-17/D-20)
- Sync simulate extended with `options.include_charging` (default true), `charging_stops[]`, and `feasibility=None` placeholder (D-02/D-21)
- Seven unit tests plus two simulate API contract tests cover CHRG-01/02/03

## Task Commits

1. **Task 1: Failing charge curve and greedy planner unit tests** - `f080386` (test)
2. **Task 2: Charge curve integration, detour validator, and greedy planner core** - `00a08c7` (feat)
3. **Task 3: Wire charging planner into sync simulate response** - `e93c6f5` (feat)

## Files Created/Modified

- `services/simulator/app/simulation/charge_curve.py` - Piecewise SOC band dwell integration
- `services/simulator/app/simulation/charging_planner.py` - Greedy HD stop loop + PostGIS search
- `services/simulator/app/simulation/detour_validator.py` - Valhalla truck detour seconds
- `services/simulator/app/simulation/route_provider.py` - `get_route_locations` multi-stop helper
- `services/simulator/app/simulation/schemas.py` - ChargingConditionsSpec, SimulateOptions, ChargingStopResult
- `services/simulator/app/simulation/orchestrator.py` - Calls planner after integrate_soc
- `services/simulator/tests/test_charge_curve.py` - CHRG-03 taper test
- `services/simulator/tests/test_charging_planner.py` - CHRG-01/02 unit + simulate API tests

## Decisions Made

- `response_model_exclude_none=True` on `/v1/simulate` omits `charging_stops` when `include_charging=false`
- Existing Phase 2 API tests explicitly pass `include_charging: false` to preserve segment-only assertions
- `feasibility` field returns `null` until Plan 03-02 implements verdict logic

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added TDD stub modules in Task 1**
- **Found during:** Task 1
- **Issue:** Tests would fail collection without importable modules
- **Fix:** Minimal `NotImplementedError` stubs for `charge_curve.py` and `charging_planner.py`
- **Files modified:** services/simulator/app/simulation/charge_curve.py, charging_planner.py
- **Committed in:** f080386

**2. [Rule 2 - Missing Critical] Updated test_simulate_api for Phase 2 parity**
- **Found during:** Task 3
- **Issue:** Default `include_charging=true` would break existing simulate contract tests
- **Fix:** Pass `options.include_charging: false` in corridor/custom O/D test bodies
- **Files modified:** services/simulator/tests/test_simulate_api.py
- **Committed in:** e93c6f5

## Known Stubs

| Location | Stub | Resolved by |
|----------|------|-------------|
| orchestrator.py | `feasibility=None` | Plan 03-02 feasibility classifier |

## Issues Encountered

- Simulate API integration tests skip when `fleetvolt_test` DB unreachable; pass against running `fleetvolt` Postgres on port 5432

## Next Phase Readiness

- Plan 03-02 can implement `classify_feasibility` and populate `feasibility{}` verdict
- Plan 03-03 can wrap same orchestrator path in Celery worker
- No blockers for charging vertical slice continuation

## Self-Check: PASSED

- FOUND: services/simulator/app/simulation/charge_curve.py
- FOUND: services/simulator/app/simulation/charging_planner.py
- FOUND: services/simulator/app/simulation/detour_validator.py
- FOUND: services/simulator/tests/test_charge_curve.py
- FOUND: services/simulator/tests/test_charging_planner.py
- FOUND: f080386
- FOUND: 00a08c7
- FOUND: e93c6f5

---
*Phase: 03-charging-job-pipeline*
*Completed: 2026-07-01*
