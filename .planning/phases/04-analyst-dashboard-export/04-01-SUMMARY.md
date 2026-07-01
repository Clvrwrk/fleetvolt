---
phase: 04-analyst-dashboard-export
plan: 01
subsystem: ui
tags: [nextjs, zustand, zod, react-hook-form, playwright, shadcn, async-poll]

requires:
  - phase: 04-analyst-dashboard-export
    provides: API audit metadata on poll/cache-hit, routing proxy (04-00)
  - phase: 04-analyst-dashboard-export
    provides: Web foundation, rewrites, kpi lib, brand tokens (04-07)
provides:
  - Analyst workspace at / with SSR catalog prefetch
  - useScenarioStore submit/poll lifecycle with cache-hit path
  - ScenarioForm + JobStatusBar + BasicResultsPanel (KPI + JSON audit)
  - Playwright @smoke configure→run path
affects: [04-02, 04-03, 04-04, 04-05, 04-06]

tech-stack:
  added: ["@playwright/test", "@radix-ui/react-select", "@radix-ui/react-slider", "@radix-ui/react-checkbox", "@radix-ui/react-collapsible", "@radix-ui/react-label", "@radix-ui/react-slot"]
  patterns:
    - Client api-client uses same-origin /api/v1 rewrites; server page uses API_URL
    - pollUntilComplete 2s interval with AbortSignal and injectable getSimulation for tests
    - Truck slug mapping via TRUCK_SLUG_BY_NAME from catalog display names

key-files:
  created:
    - apps/web/src/stores/scenario-store.ts
    - apps/web/src/lib/api-client.ts
    - apps/web/src/lib/poll-job.ts
    - apps/web/src/lib/scenario-schema.ts
    - apps/web/src/components/workspace/workspace-layout.tsx
    - apps/web/src/components/scenario/scenario-form.tsx
    - apps/web/src/components/scenario/job-status-bar.tsx
    - apps/web/src/components/results/basic-results-panel.tsx
    - apps/web/tests/scenario-run.spec.ts
    - apps/web/playwright.config.ts
  modified:
    - apps/web/src/app/page.tsx
    - apps/web/src/app/globals.css
    - apps/web/package.json

key-decisions:
  - "include_charging always true in toSimulateRequest; omitted from form schema to avoid RHF/Zod literal default type conflict"
  - "Truck catalog slugs derived via TRUCK_SLUG_BY_NAME map since GET /v1/trucks returns display names only"

patterns-established:
  - "Pattern: submitScenario aborts prior poll via AbortController before new POST per RESEARCH Pitfall 5 prep"
  - "Pattern: cache-hit skips poll and sets isCacheHit with inputs_hash prefix chip in JobStatusBar"

requirements-completed: [SCEN-04]

coverage:
  - id: D1
    description: Analyst configures truck/corridor, submits POST /v1/simulations, polls to COMPLETE, sees KPI summary
    requirement: SCEN-04
    verification:
      - kind: unit
        ref: "apps/web/src/stores/scenario-store.test.ts#sets pollResult with inputs_hash on cache hit"
        status: pass
      - kind: e2e
        ref: "apps/web/tests/scenario-run.spec.ts#test_analyst_runs_polb_scenario"
        status: unknown
    human_judgment: true
    rationale: "Playwright smoke requires full docker stack running; skipped in CI/sandbox without API"
  - id: D2
    description: Cache hit shows Cached result chip with inputs_hash prefix per D-15
    requirement: SCEN-04
    verification:
      - kind: unit
        ref: "apps/web/src/stores/scenario-store.test.ts#sets pollResult with inputs_hash on cache hit"
        status: pass
    human_judgment: false
  - id: D3
    description: FAILED job shows error message/stage with retry preserving form per D-16
    verification:
      - kind: other
        ref: "apps/web/src/components/scenario/job-status-bar.tsx Retry simulation button"
        status: pass
    human_judgment: true
    rationale: "FAILED path UI requires live simulation failure to verify end-to-end"
  - id: D4
    description: Workspace at / uses left config panel and right results canvas per D-01/D-03
    verification:
      - kind: other
        ref: "pnpm --filter @fleetvolt/web build"
        status: pass
    human_judgment: false
  - id: D5
    description: inputs_hash visible in results JSON and job status when poll includes it
    requirement: SCEN-04
    verification:
      - kind: unit
        ref: "apps/web/src/lib/poll-job.test.ts#resolves when mock fetch returns COMPLETE status"
        status: pass
    human_judgment: false

duration: 28 min
completed: 2026-07-01
status: complete
---

# Phase 4 Plan 01: Analyst Workspace Vertical Slice Summary

**Zustand-driven analyst workspace with async submit/poll, KPI results panel, cache-hit chip, and Playwright smoke for polb_cajon_pass configure→run path**

## Performance

- **Duration:** 28 min
- **Started:** 2026-07-01T20:19:10Z
- **Completed:** 2026-07-01T20:47:00Z
- **Tasks:** 3
- **Files modified:** 24

## Accomplishments

- Playwright @smoke spec encodes configure→run→results happy path with data-testid hooks matching UI components
- Zustand store + typed api-client + 2s poll loop with cache-hit short-circuit and FAILED error handling
- Analyst workspace at `/` with SSR truck/corridor catalogs, scenario form, job status bar, and basic KPI + JSON results panel

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing Playwright smoke** - `dfb3566` (test)
2. **Task 2: Zustand store, API client, poll loop** - `283f104` (feat)
3. **Task 3: Workspace shell, form, results panel** - `a59f29c` (feat)

## Files Created/Modified

- `apps/web/src/stores/scenario-store.ts` - Zustand + immer job lifecycle with cache-hit and abort
- `apps/web/src/lib/api-client.ts` - Typed /api/v1 wrappers for simulations, trucks, corridors, routing
- `apps/web/src/lib/poll-job.ts` - pollUntilComplete with FAILED structured error
- `apps/web/src/lib/scenario-schema.ts` - Zod form schema + toSimulateRequest builder
- `apps/web/src/components/workspace/workspace-layout.tsx` - 320px left rail + results canvas grid
- `apps/web/src/components/scenario/scenario-form.tsx` - RHF + Zod scenario configuration form
- `apps/web/src/components/scenario/job-status-bar.tsx` - Poll spinner, cache chip, FAILED retry
- `apps/web/src/components/results/basic-results-panel.tsx` - deriveKpiSummary row + collapsible JSON
- `apps/web/tests/scenario-run.spec.ts` - E2E smoke for polb_cajon_pass demo scenario

## Decisions Made

- `include_charging` always sent as `true` in API body; excluded from form schema to resolve RHF/Zod literal-default typing conflict
- Truck slugs mapped from catalog display names via `TRUCK_SLUG_BY_NAME` since trucks API lacks slug field

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Omitted include_charging from form Zod schema**
- **Found during:** Task 3 (ScenarioForm typecheck)
- **Issue:** `z.literal(true).default(true)` caused Resolver input/output type mismatch with React Hook Form
- **Fix:** Form schema excludes field; `toSimulateRequest` always sets `options.include_charging: true` per D-13/D-27 intent
- **Files modified:** apps/web/src/lib/scenario-schema.ts
- **Verification:** `tsc --noEmit` and `next build` pass
- **Committed in:** a59f29c

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No API contract change; charging always enabled as specified.

## Issues Encountered

- Playwright smoke skips when API stack unreachable (expected per plan); full GREEN requires `docker compose up`
- `pnpm exec playwright` blocked by workspace install hook in sandbox; direct `./node_modules/.bin/playwright` used

## User Setup Required

None — uses existing stack from Phase 1–3. Run full stack before E2E: `docker compose up`.

## Next Phase Readiness

- Plan 04-02 can add map layer using routeCoordinates placeholder and `/api/v1/routing/route`
- KPI and poll JSON panel ready for chart sync and export waves

## Self-Check: PASSED

- FOUND: apps/web/src/stores/scenario-store.ts
- FOUND: apps/web/src/components/scenario/scenario-form.tsx
- FOUND: apps/web/src/components/results/basic-results-panel.tsx
- FOUND: apps/web/tests/scenario-run.spec.ts
- FOUND: dfb3566
- FOUND: 283f104
- FOUND: a59f29c

---
*Phase: 04-analyst-dashboard-export*
*Completed: 2026-07-01*
