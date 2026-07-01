---
phase: 02-physics-simulation-core
plan: 01
subsystem: api
tags: [numpy, scipy, physics, soc, segmentation, pytest]

requires:
  - phase: 01-foundation-spatial-data
    provides: truck configs, elevation cache patterns, corridor fixtures
provides:
  - NumPy vectorized PhysicsEngine with force balance
  - Sequential SoC integrator with regen caps
  - KPI aggregator (total kWh, Wh/mi, regen, time)
  - 10 US mile + 6% grade SegmentBuilder
  - OEM reference validation fixtures
affects: [02-02, 02-03, 02-04, 02-05]

tech-stack:
  added: [numpy==2.5.0, scipy==1.18.0]
  patterns: [centralized constants.py, usable_kwh SoC basis, 150m grade rescan subdivision]

key-files:
  created:
    - services/simulator/app/simulation/physics_engine.py
    - services/simulator/app/simulation/soc_integrator.py
    - services/simulator/app/simulation/kpi_aggregator.py
    - services/simulator/app/simulation/segment_builder.py
    - services/simulator/app/simulation/constants.py
    - data/validation/reference_cases.json
    - services/simulator/tests/test_physics_engine.py
    - services/simulator/tests/test_segment_builder.py
  modified:
    - services/simulator/requirements.txt

key-decisions:
  - "Rolling-resistance dominance test uses 40 mph where F_roll > F_aero for loaded eCascadia"
  - "Regen disabled above regen_soc_cutoff 90%; capped at 350 kW OEM charge max"
  - "Segment cap 200 enforced via ValueError per threat T-02-02"

patterns-established:
  - "Pattern 1: NumPy batch forces + sequential SoC loop for SOC-dependent regen"
  - "D-05/D-07: 10 US mile base segments with 150m internal grade rescan and 6% splits"

requirements-completed: [PHYS-02, PHYS-03, PHYS-05]

coverage:
  - id: D1
    description: PhysicsEngine segment force balance (rolling, aero, grade, aux)
    requirement: PHYS-02
    verification:
      - kind: unit
        ref: services/simulator/tests/test_physics_engine.py#test_flat_segment_rolling_resistance_dominates
        status: pass
    human_judgment: false
  - id: D2
    description: SoC forward integration with regen cap and 90% cutoff
    requirement: PHYS-05
    verification:
      - kind: unit
        ref: services/simulator/tests/test_physics_engine.py#test_regen_capped_on_steep_downhill
        status: pass
      - kind: unit
        ref: services/simulator/tests/test_physics_engine.py#test_soc_decreases_monotonically_uphill
        status: pass
    human_judgment: false
  - id: D3
    description: KPI aggregation (total kWh, Wh/mi, regen, travel time)
    requirement: PHYS-03
    verification:
      - kind: unit
        ref: services/simulator/tests/test_physics_engine.py#test_kpi_aggregator_hand_calc
        status: pass
    human_judgment: false
  - id: D4
    description: 10 US mile segmentation with 6% grade subdivision
    requirement: PHYS-02
    verification:
      - kind: unit
        ref: services/simulator/tests/test_segment_builder.py#test_steep_profile_subdivides_more_than_flat
        status: pass
      - kind: unit
        ref: services/simulator/tests/test_segment_builder.py#test_cajon_synthetic_has_steep_segment
        status: pass
    human_judgment: false
  - id: D5
    description: OEM reference validation fixtures on disk for D-11 gate
    requirement: PHYS-02
    verification:
      - kind: unit
        ref: services/simulator/tests/test_physics_engine.py#test_reference_cases_fixture
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-07-01
status: complete
---

# Phase 2 Plan 01: Physics Core Summary

**NumPy physics engine with regen-capped SoC integration, KPI aggregation, and 10-mile grade-aware segmentation**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-01T18:00:00Z
- **Completed:** 2026-07-01T18:18:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- PhysicsEngine computes vectorized rolling, aero, grade, and aux power per Technical Architecture §3.3
- SocIntegrator applies usable_kwh basis with regen_power_cap and 90% SOC cutoff (PHYS-05)
- SegmentBuilder honors D-05 (10 US mile) and D-07 (6% grade splits at 150m resolution)
- reference_cases.json provides flat_highway_oem and polb_cajon_grade fixtures for Plan 05 MAPE gate

## Task Commits

1. **Task 1: Scientific stack, constants, and reference fixtures** - `a8dd83a` (test)
2. **Task 2: PhysicsEngine, SocIntegrator, and KPI aggregator** - `bbc554d` (feat)
3. **Task 3: SegmentBuilder — 10 US mile discretization with 6% grade splits** - `6268c35` (feat)

## Files Created/Modified

- `services/simulator/app/simulation/physics_engine.py` - Vectorized force/power batch computation
- `services/simulator/app/simulation/soc_integrator.py` - Sequential SoC with regen limits
- `services/simulator/app/simulation/kpi_aggregator.py` - Total kWh, Wh/mi, regen, time KPIs
- `services/simulator/app/simulation/segment_builder.py` - D-05/D-07 route segmentation
- `services/simulator/app/simulation/constants.py` - Centralized unit constants and caps
- `data/validation/reference_cases.json` - D-11 OEM validation reference bands
- `services/simulator/tests/test_physics_engine.py` - Force, SoC, KPI unit tests
- `services/simulator/tests/test_segment_builder.py` - Segmentation edge-case tests

## Decisions Made

- Rolling-resistance dominance assertion uses 40 mph (F_roll > F_aero for loaded eCascadia at that speed)
- Regen power cap set to 350 kW matching eCascadia CCS max from charge curve
- Segment overflow raises ValueError at 200 segments per RESEARCH security table

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Physics core ready for route integration in Plan 02-02 (Valhalla geometry → segment builder → physics pipeline)
- reference_cases.json on disk for Plan 02-05 validation gate
- scipy pinned for future interpolation hooks; not yet used in this plan

## Self-Check: PASSED

- FOUND: services/simulator/app/simulation/physics_engine.py
- FOUND: services/simulator/app/simulation/segment_builder.py
- FOUND: data/validation/reference_cases.json
- FOUND: a8dd83a
- FOUND: bbc554d
- FOUND: 6268c35

---
*Phase: 02-physics-simulation-core*
*Completed: 2026-07-01*
