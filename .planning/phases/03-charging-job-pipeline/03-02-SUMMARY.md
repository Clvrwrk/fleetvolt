---
phase: 03-charging-job-pipeline
plan: 02
subsystem: api
tags: [charging, feasibility, fastapi, pytest, pydantic]

requires:
  - phase: 03-charging-job-pipeline
    plan: 01
    provides: plan_greedy_stops, charging_stops sync response, ChargingConditionsSpec
provides:
  - classify_feasibility pure verdict/tier classifier
  - shadow_pass_depot_at_origin for depot_required vs infrastructure_gap
  - FeasibilityResult schema with Literal verdict/tier enums
  - SegmentResult charging_event and stop_sequence annotations
  - get_charging_assumptions CHRG-06 deferred weights documentation
  - simulate API tests for charging-enabled and disabled paths
affects:
  - 03-03-async-job-pipeline
  - 04-analyst-dashboard

tech-stack:
  added: []
  patterns:
    - "Pure classify_feasibility(stops, final_soc, conditions, planner_outcome) no side effects"
    - "PlannerStatus tuple from plan_greedy_stops feeds feasibility classifier"
    - "Shadow depot pass at origin distinguishes depot_required from infrastructure_gap"

key-files:
  created:
    - services/simulator/tests/test_feasibility.py
  modified:
    - services/simulator/app/simulation/feasibility.py
    - services/simulator/app/simulation/schemas.py
    - services/simulator/app/simulation/orchestrator.py
    - services/simulator/app/simulation/charging_planner.py
    - services/simulator/tests/test_simulate_api.py
    - services/simulator/tests/test_charging_planner.py

key-decisions:
  - "No feasible HD charger at trigger returns PlannerStatus failure immediately (not skip-forward)"
  - "AssumptionEntry extended with optional category/note for CHRG-06 greedy rationale"
  - "segment_index stripped from API stop payload; used only for segment annotation"

patterns-established:
  - "Feasibility tier: public_hd → shadow depot → depot_required | infrastructure_gap"
  - "Critical verdict: arrival SoC 5–10% or single stop dwell_s < 1800s"

requirements-completed: [CHRG-04, CHRG-05, CHRG-06]

coverage:
  - id: D1
    description: "Three-tier feasibility verdict feasible/critical/infeasible per D-10"
    requirement: CHRG-04
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_feasibility.py"
        status: pass
    human_judgment: false
  - id: D2
    description: "Infrastructure tier tags public_hd/depot_required/infrastructure_gap per D-11"
    requirement: CHRG-05
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_feasibility.py#test_public_hd_tier"
        status: pass
    human_judgment: false
  - id: D3
    description: "CHRG-06 satisfied via documented greedy weights in assumptions per D-07"
    requirement: CHRG-06
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_feasibility.py#test_greedy_assumption_entry"
        status: pass
    human_judgment: false
  - id: D4
    description: "Sync simulate returns charging_stops and feasibility when include_charging=true"
    requirement: CHRG-04
    verification:
      - kind: integration
        ref: "services/simulator/tests/test_simulate_api.py#test_simulate_with_charging_enabled"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-01
status: complete
---

# Phase 3 Plan 02: Feasibility Classifier Summary

**Three-tier feasibility verdict with infrastructure tags, segment charging annotations, and full sync simulate response including feasibility{}**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- `classify_feasibility` implements D-10/D-11/D-12/D-13 as pure classifier with no side effects
- `shadow_pass_depot_at_origin` distinguishes `depot_required` from `infrastructure_gap` when public greedy fails
- Orchestrator attaches `feasibility{}`, segment `charging_event`/`stop_sequence`, and CHRG-06 assumptions entry
- Eight unit tests plus extended simulate API contract tests cover charging-enabled and Phase 2 parity paths

## Task Commits

1. **Task 1: Failing feasibility classifier unit tests** - `b5bdc70` (test)
2. **Task 2: Feasibility classifier and orchestrator wiring** - `6fbf676` (feat)
3. **Task 3: Update simulate API tests** - `505f58c` (feat)

## Files Created/Modified

- `services/simulator/app/simulation/feasibility.py` - Verdict/tier classifier, shadow pass, CHRG-06 assumptions
- `services/simulator/app/simulation/schemas.py` - FeasibilityResult, SegmentResult charging fields
- `services/simulator/app/simulation/orchestrator.py` - Wires planner → classifier → response
- `services/simulator/app/simulation/charging_planner.py` - PlannerStatus tuple, segment_index tracking
- `services/simulator/tests/test_feasibility.py` - CHRG-04/05 unit coverage
- `services/simulator/tests/test_simulate_api.py` - Sync charging response contract

## Decisions Made

- Greedy planner returns failure immediately when no feasible charger at trigger (clearer infeasible signal)
- AssumptionEntry extended with optional `category` and `note` for non-numeric charging rationale
- `segment_index` kept internal to orchestrator; not exposed in D-21 stop payload

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated test_charging_planner for tuple return from plan_greedy_stops**
- **Found during:** Task 2
- **Issue:** plan_greedy_stops signature change broke six existing planner tests
- **Fix:** Unpack `stops, _ = plan_greedy_stops(...)` in all call sites
- **Files modified:** services/simulator/tests/test_charging_planner.py
- **Committed in:** 6fbf676

**2. [Rule 2 - Missing Critical] Fail fast on no feasible charger at trigger**
- **Found during:** Task 2
- **Issue:** Original planner skipped trigger when no charger found, masking infeasible routes
- **Fix:** Return PlannerStatus with blocking_reason=no_charger_in_radius
- **Files modified:** services/simulator/app/simulation/charging_planner.py
- **Committed in:** 6fbf676

## Known Stubs

None — feasibility classifier fully wired on sync path.

## Issues Encountered

- Simulate API integration tests skip when `fleetvolt_test` DB unreachable; pass against running Postgres on port 5432

## Next Phase Readiness

- Plan 03-03 can wrap same orchestrator path in Celery worker with identical feasibility payload
- Phase 4 can consume `charging_event`/`stop_sequence` on segments for chart hover sync

## Self-Check: PASSED

- FOUND: services/simulator/app/simulation/feasibility.py
- FOUND: services/simulator/tests/test_feasibility.py
- FOUND: services/simulator/tests/test_simulate_api.py (updated)
- FOUND: b5bdc70
- FOUND: 6fbf676
- FOUND: 505f58c

---
*Phase: 03-charging-job-pipeline*
*Completed: 2026-07-01*
