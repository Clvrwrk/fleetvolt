---
phase: 04-analyst-dashboard-export
plan: 05
subsystem: ui
tags: [react, zustand, comparison, sensitivity, shadcn]

requires:
  - phase: 04-analyst-dashboard-export
    provides: Results tabs shell, KPI derivation, scenario form and polling from Plans 04-01–04-04
provides:
  - Comparison tray with A/B/C pinning (max 3) keyed by inputs_hash
  - Side-by-side KPI diff table with delta columns B−A and C−A
  - Sensitivity sliders with debounced 500ms re-run and delta KPI footer
affects: [04-06-export, 04-07-uat]

tech-stack:
  added: []
  patterns:
    - "Zustand comparisonScenarios[] with inputs_hash dedupe and label slots A/B/C"
    - "Sensitivity POST on slider onValueCommit only with poll sequence stale-guard"
    - "Shared executeSimulation helper with AbortController for main and sensitivity runs"

key-files:
  created:
    - apps/web/src/components/comparison/comparison-tray.tsx
    - apps/web/src/components/comparison/comparison-diff-table.tsx
    - apps/web/src/components/scenario/sensitivity-sliders.tsx
  modified:
    - apps/web/src/stores/scenario-store.ts
    - apps/web/src/components/scenario/scenario-form.tsx
    - apps/web/src/components/workspace/workspace-layout.tsx
    - apps/web/src/components/results/basic-results-panel.tsx
    - apps/web/src/lib/scenario-schema.ts

key-decisions:
  - "Temperature and headwind sliders map to discrete weather_preset enum with UI helper text per RESEARCH A3/A4"
  - "Sensitivity delta KPIs compare against first pinned baseline (Scenario A when present)"
  - "Tray-full feedback uses inline Alert on form rather than toast library (not in stack)"

patterns-established:
  - "Comparison pinning dedupes by inputs_hash — same hash updates existing slot"
  - "Numeric diff cells green when lower energy/time, red when worse per UI-SPEC"

requirements-completed: [SCEN-01, SCEN-02, SCEN-04]

coverage:
  - id: D1
    description: Comparison tray holds up to 3 scenarios A/B/C with inputs_hash immutability
    requirement: SCEN-04
    verification:
      - kind: unit
        ref: "pnpm --filter @fleetvolt/web typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: Side-by-side diff table with KPI rows, stop count, feasibility, and delta columns
    requirement: SCEN-01
    verification:
      - kind: unit
        ref: "apps/web/node_modules/.bin/tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: Delta color semantics and multi-scenario layout need visual confirmation
  - id: D3
    description: Sensitivity sliders debounce 500ms on commit and abort prior poll
    requirement: SCEN-02
    verification:
      - kind: unit
        ref: "pnpm --filter @fleetvolt/web typecheck"
        status: pass
    human_judgment: true
    rationale: Debounce timing and POST stampede prevention require interactive verification

duration: 25min
completed: 2026-07-01
status: complete
---

# Phase 4 Plan 05: Comparison & Sensitivity Summary

**Comparison tray (3 scenarios), KPI diff table, and debounced sensitivity re-run wired to Zustand and results tabs.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3/3
- **Files modified:** 8

## Accomplishments

- Extended `useScenarioStore` with `comparisonScenarios` (max 3), `pinCurrentResult`, `removeScenario`, `clearComparison`, and `inputs_hash` dedupe per SCEN-04
- Built `ComparisonTray` with A/B/C chips, dashed empty slots, remove/clear confirm dialogs, and Compare count badge in header
- Added "Add to comparison" checkbox on scenario form; auto-pins on COMPLETE with tray-full Alert feedback
- Created `ComparisonDiffTable` with KPI rows, stop count, feasibility verdict, and Δ(B−A)/Δ(C−A) with green/red numeric deltas
- Enabled Comparison tab in results panel with empty and single-scenario states per UI-SPEC
- Implemented `SensitivitySliders` (payload ±20%, temperature offset, headwind) with 500ms debounce on `onValueCommit` only
- Sensitivity runs abort prior poll, ignore stale responses via sequence counter, and show delta KPIs vs baseline A in tray footer

## Deviations from Plan

None — plan executed as written.

## Self-Check: PASSED

- FOUND: apps/web/src/components/comparison/comparison-tray.tsx
- FOUND: apps/web/src/components/comparison/comparison-diff-table.tsx
- FOUND: apps/web/src/components/scenario/sensitivity-sliders.tsx
- FOUND: commit c5afb70
- FOUND: commit 6e11d40
- FOUND: commit 1b38d4c
