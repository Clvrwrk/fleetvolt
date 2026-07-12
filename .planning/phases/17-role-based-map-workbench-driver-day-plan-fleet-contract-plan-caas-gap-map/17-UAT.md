---
status: testing
phase: 17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map
source:
  - 17-00-SUMMARY.md
started: 2026-07-08T22:20:00.000Z
updated: 2026-07-11T17:30:00.000-07:00
mode: mvp
---

## Current Test

number: 4
name: Fleet contract plan from dashboard
expected: |
  From /fleet, "Plan Contract" opens fleet workbench mode. After Calculate,
  you see trucks/drivers/charge-events style summary cards with assumption
  labels (and gap/CaaS support when applicable).
awaiting: user response

## Tests

### Section A — User-flow walk-through

### 1. Driver dashboard launchpad CTA
expected: At /driver, one dominant primary CTA reads "Start Day Plan" and the page feels like a launchpad (dashboard), not the planning work surface itself.
result: pass
severity: medium
reported: |
  CTA "Start Day Plan" is present and dashboard is launchpad-shaped. Empty
  global sidebar nav after login was superseded by the locked tool-rail
  pattern: on workbench routes, role nav lives above accordion tools in the
  left tool panel (see TOOL-RAIL.md). Dashboard sidebar soft-fallback remains
  optional polish, not a UAT blocker.

### 2. Driver opens full-viewport day-plan workbench
expected: Clicking "Start Day Plan" opens a full-viewport map workbench (left tools + map + right cards or mobile sheet). The primary work area is the map — not a centered FramedPanel / chat card layout.
result: pass
severity: high
reported: |
  Crash (getSnapshot loop) fixed. Layout rebuilt as stacked left tool rail
  (nav above, inputs/summary accordions below) + full-bleed map. User accepted
  UI/UX; marker toggle + detour spur polish shipped. Ready for Test 3.


### 3. Driver day plan produces map + result cards
expected: With origin/destination (or AI draft POLB→Barstow), run Calculate day plan. You see route geometry (or advisory warning), feasibility/charge-stop cards, and honest "unavailable" labels where detour/access isn't computed — not a long prose report as the primary output.
result: pass
reported: |
  SF→Barstow Calculate works: road-snapped route + live charger pins + result
  cards. Design accepted. Follow-ups (not blockers): (a) final data sweep so
  parking/POI/amenity layers return dense corridor coverage like chargers;
  (b) keep/confirm layer toggle switches in the tool rail so drivers can hide
  parking/amenities/etc. Layer toggle UI already exists in left panel —
  needs live multi-layer data to be useful.

### 4. Fleet contract plan from dashboard
expected: From /fleet, "Plan Contract" opens fleet workbench mode. After Calculate, you see trucks/drivers/charge-events style summary cards with assumption labels (and gap/CaaS support when applicable).
result: pending
reported: |
  2026-07-11 automated evidence: the /fleet "Plan Contract" CTA lands in
  fleet_contract_plan and the workbench shell/result-card chrome renders.
  A live calculation receipt against connected route/data providers is still
  required before this UAT can be marked pass.

### 5. CaaS gap map from dashboard
expected: From /caas, "Find Charger Gaps" opens CaaS workbench. You get a US/opportunity-style map with gap/carrier layers; drilldown steps that lack data are disabled/labeled rather than blocking the whole flow.
result: pending
reported: |
  2026-07-11 automated evidence: /caas now intentionally opens the map-first
  caas_gap_map shell directly; legacy /caas/gap-map redirects to /caas. A
  live carrier/gap-data drilldown remains required before acceptance.

### 6. Map-first AI command bar
expected: In any workbench mode, use the AI command bar with a role example prompt. Output updates draft/layers/cards first; any prose is a short summary — not a wall of text. Errors (if any) are human-readable.
result: pass
reported: |
  Playwright applies the deterministic Driver example, verifies the concise
  AI summary, opens Driver result cards, and confirms structured cards render.

### Section B — Technical checks (run only if Section A all pass)

### 7. Hybrid routes and mode parsing
expected: /driver/day-plan, /fleet/contract-plan, /caas/gap-map, and /workbench?mode=… all land in the same workbench shell with the correct mode chrome/copy.
result: pass
reported: |
  Playwright verifies Driver and Fleet semantic launchers, the intentional
  CaaS /caas landing, and direct /workbench?mode= parsing for Fleet and CaaS.

### 8. Desktop / mobile layout chrome
expected: Desktop: map dominates viewport with left tools + right cards. Mobile (~390px): map primary + bottom sheet for tools (not a squeezed three-column layout).
result: pass
reported: |
  Desktop 1440x900 verifies map-first chrome, expandable result rail, and
  viewport height. Mobile 390x844 verifies real Calculate controls in the
  bottom sheet, hidden desktop rails, visible map, and zero horizontal overflow.

### Section C — Coverage / visual judgment

### 9. Screenshot / visual review (Driver, Fleet, CaaS)
expected: Visually confirm Driver, Fleet, and CaaS workbench initial states look map-first; Google tiles may be blank if key/referrer blocks — DOM/layout still must look correct.
result: pending

## Summary

total: 9
passed: 6
issues: 0
pending: 3
skipped: 0
blocked: 0

## Automated repair receipt — 2026-07-11

- `pnpm exec playwright test tests/map-workbench.spec.ts`: 9 passed, 1 skipped.
  The skipped assertion is the opt-in live Google marker interaction.
- Deterministic browser runs explicitly omit Google Maps credentials; use
  `FLEETVOLT_E2E_MAPS=1` for the live-map/referrer gate.
- `choropleth-geometry.test.ts`: 3 passed, including rejection of bbox-only
  geography so a California bounding rectangle cannot render as a polygon.
- Workbench store tests: 12 passed.
- Targeted workbench/auth ESLint: zero warnings/errors.

## Follow-ups (accepted design; ship later)

- id: corridor-layer-data-sweep
  severity: medium
  summary: Final data sweep so parking/POI/amenity pins match charger coverage
  detail: |
    Calculate currently surfaces chargers well along SF→Barstow; parking and
    POI probes are thinner (destination/stop-radius limited). Before final
    ship, re-ingest/verify parking + POI spatial indexes and sample origin /
    mid / destination (and optionally more probes) so all driver layers light
    up on long corridors.
  files:
    - apps/web/convex/workbench/actions.ts
    - apps/web/convex/pois/queries.ts
    - apps/web/convex/parking/

- id: layer-toggle-toolbar
  severity: low
  status: verified
  summary: Confirm driver layer toggles work once multi-layer data is live
  detail: |
    Verified 2026-07-08: Driver layer toggles hide/show pins without recalculating.
    Tool rail uses layersForMode + toggleLayer (Route / Chargers / Parking / Amenities).

## Gaps

- id: empty-role-sidebar
  test: 1
  severity: medium
  summary: Driver sidebar shows no nav items after WorkOS login
  status: superseded
  detail: |
    Superseded by locked tool-rail UX (TOOL-RAIL.md). Workbench routes hide
    the global AppShell sidebar; role navigation sits above accordion tools
    in the left tool panel. Optional later: soft-fallback nav items on
    /driver|/fleet|/caas dashboards when useUserRole() lags — not required
    for Phase 17 workbench acceptance.
  files:
    - .planning/phases/17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map/TOOL-RAIL.md
    - apps/web/src/components/workbench/map-workbench/workbench-rail-nav.tsx
    - apps/web/src/components/nav/app-shell.tsx

- id: workbench-crushed-layout
  test: 2
  severity: high
  summary: Map crushed by dual overlays; rebuilt as stacked left tool rail
  detail: |
    User asked to move Day-plan inputs + Day-plan summary into the left
    graphite rail with accordion collapse (inputs open / summary collapsed
    on load), map full-bleed beside it, last Convex run or stable per-user
    core corridor on first open. Implemented MapWorkbenchShell stacked rail,
    workbenchRuns table, bootstrap + saveRun on Calculate. Global AppShell
    sidebar hidden on workbench routes. Documented in TOOL-RAIL.md.
  files:
    - apps/web/src/components/workbench/map-workbench/map-workbench-shell.tsx
    - apps/web/src/components/workbench/map-workbench/workbench-rail-nav.tsx
    - apps/web/src/components/workbench/map-workbench/workbench-bootstrap.tsx
    - apps/web/convex/workbench/runs.ts
    - apps/web/convex/schema.ts
    - apps/web/src/components/nav/app-shell.tsx
    - .planning/phases/17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map/TOOL-RAIL.md
  status: fixed
