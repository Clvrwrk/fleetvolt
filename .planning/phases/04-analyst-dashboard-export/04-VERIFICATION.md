---
phase: 04-analyst-dashboard-export
verified: 2026-07-01T22:00:00Z
status: gaps_found
score: 7/10 must-haves verified
behavior_unverified: 3
overrides_applied: 0
gaps:
  - truth: "Stack health page relocated to /status with Phase 1 diagnostics (D-01 / Plan 07)"
    status: failed
    reason: "/status exists but is a 7-line stub with only `<h1>FleetVolt Route</h1>` — no fetchStackMeta, no service health checks. SUMMARY 04-07 falsely claims fetchStackMeta is present."
    artifacts:
      - path: apps/web/src/app/status/page.tsx
        issue: "Placeholder stub; Phase 1 stack-health content not relocated"
    missing:
      - "Relocate Phase 1 health-check fetches (stack meta, API/simulator status) to /status, or implement collapsible Stack health drawer per UI-SPEC"
behavior_unverified_items:
  - truth: "Map ↔ chart hover sync updates shared activeDistanceM bidirectionally under 100ms perceived (MAP-03 / D-07)"
    test: "Run polb_cajon_pass simulation with NEXT_PUBLIC_MAPBOX_TOKEN set; hover chart line and map route"
    expected: "Chart ReferenceLine and map active-segment casing track the same distance; crosshair moves when hovering either surface"
    why_human: "Wiring exists in route-map.tsx and soc-profile-chart.tsx via Zustand, but no unit/E2E test exercises the hover transition invariant"
  - truth: "Interactive map renders SoC-gradient polyline and charger markers with popups (MAP-01/02)"
    test: "Complete a simulation with Mapbox token configured; inspect map panel"
    expected: "SoC color legend visible; gradient route line; sized charger circles; click popup with power/SoC/dwell"
    why_human: "Requires Mapbox token + live route geometry fetch; code paths verified statically only"
  - truth: "PDF export generates downloadable report with embedded map snapshot via Puppeteer (EXPR-02)"
    test: "Complete simulation → Export → Export PDF report with map visible"
    expected: "PDF downloads with KPI table, map image (or fallback text), physics snapshot, disclaimer footer"
    why_human: "API tests mock renderPdf; real Puppeteer + canvas capture not exercised in CI"
human_verification:
  - test: "Full analyst workflow: configure polb_cajon_pass + ecascadia_438, run, review map/chart/KPIs, pin 2 scenarios, adjust sensitivity sliders, export CSV/JSON/PDF"
    expected: "End-to-end flow completes without errors; comparison diff shows B−A deltas; exports contain inputs_hash and model versions"
    why_human: "Playwright smoke test exists (tests/scenario-run.spec.ts) but requires docker compose stack; not run during verification"
  - test: "Verify map-chart hover sync (see behavior_unverified_items)"
    expected: "Bidirectional highlight follows cursor on chart and map"
    why_human: "Behavior-dependent; presence checks insufficient"
  - test: "Verify PDF export with map snapshot (see behavior_unverified_items)"
    expected: "PDF includes route map image when token configured"
    why_human: "Puppeteer runtime + Mapbox canvas capture"
---

# Phase 4: Analyst Dashboard & Export Verification Report

**Phase Goal:** A fleet analyst can configure, visualize, compare, and export defensible POLB corridor scenarios from the desktop web UI  
**Verified:** 2026-07-01T22:00:00Z  
**Status:** gaps_found  
**Re-verification:** No — initial verification

> **MVP mode note:** ROADMAP marks this phase `mode: mvp`, but the goal is not in canonical user-story form (`As a …, I want …, so that …`). `gsd-tools query user-story.validate` returned `false`. Verification proceeds via goal-backward analysis on the functional goal; run `/gsd mvp-phase 4` to normalize the goal string.

## Goal Achievement

### User Flow Coverage

Functional analyst journey derived from phase goal and CONTEXT.md:

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Open analyst workspace | `/` shows config panel + results canvas | `apps/web/src/app/page.tsx` → `WorkspaceLayout`; grid layout in `workspace-layout.tsx` | ✓ VERIFIED |
| Configure scenario | Truck, corridor, weather, payload, port drayage | `scenario-form.tsx` + Zod `scenario-schema.ts`; defaults `polb_cajon_pass` / `ecascadia_438` | ✓ VERIFIED |
| Run async simulation | POST + 2s poll until COMPLETE; cache chip on hit | `scenario-store.ts` `executeSimulation`, `poll-job.ts` (2000ms), `job-status-bar.tsx` cached chip | ✓ VERIFIED |
| Visualize results | SoC map, profile chart, KPIs, charging table, assumptions | `basic-results-panel.tsx` wires `RouteMapDynamic`, `SocProfileChart`, `KpiCardRow`, `ChargingPlanTable`, `AssumptionsPanel` | ⚠️ PRESENT (runtime unverified) |
| Compare scenarios | Pin up to 3; diff table B−A, C−A | `comparison-tray.tsx`, `comparison-diff-table.tsx`, `pinCurrentResult` keyed by `inputs_hash` | ✓ VERIFIED |
| Sensitivity what-if | Payload/temp/headwind sliders debounced 500ms re-run | `sensitivity-sliders.tsx` `DEBOUNCE_MS = 500`, `onValueCommit` → `submitSensitivityRun` | ✓ VERIFIED |
| Export artifacts | CSV/JSON client download; PDF server route | `export-menu.tsx`, `export-csv.ts`, `export-json.ts`, `services/api/src/exports.ts` | ⚠️ PRESENT (PDF runtime unverified) |
| Outcome: defensible deliverables | Audit trail with hash, versions, disclaimer | Poll metadata in API + assumptions panel + export headers/template | ✓ VERIFIED |

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees interactive map with SoC-gradient route polyline, charger markers, and synced SoC/energy profile chart on hover (ROADMAP SC-1) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `route-map.tsx`: `line-gradient` via `buildSocGradientExpression`; charger circles 8–20px by `power_kw`; `soc-profile-chart.tsx` shares `activeDistanceM` with map mousemove/chart onMouseMove |
| 2 | User sees KPI cards, charging plan table, and assumptions & limitations panel with model version and disclaimer (ROADMAP SC-2) | ✓ VERIFIED | Seven KPI cards in `kpi-card-row.tsx`; six-column `charging-plan-table.tsx` with `flyTo` on row click; `assumptions-panel.tsx` shows versions, hash, disclaimer |
| 3 | User can run and compare 2+ scenarios side-by-side with sensitivity sliders showing delta KPIs (ROADMAP SC-3) | ✓ VERIFIED | Max 3 pins in store; diff table with Δ(B−A)/Δ(C−A); sensitivity delta summary in tray |
| 4 | Simulation results stored immutably with input hash for cache replay and comparison (ROADMAP SC-4) | ✓ VERIFIED | `simulations.ts` cache SELECT by `inputs_hash`; poll returns hash/versions/inputs; `simulations.test.ts` cache-hit tests pass |
| 5 | User can export full simulation profile as CSV/JSON and PDF with map snapshot, assumptions, physics snapshot, model version (ROADMAP SC-5) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | CSV/JSON: `buildCsvExport` header comments + full poll JSON; PDF: `export-template.ts` sections + `exports.test.ts` (mocked Puppeteer) |
| 6 | GET poll returns audit metadata; routing proxy for map geometry (Plan 00) | ✓ VERIFIED | `getSimulation` SELECT includes audit columns; `app.ts` `GET /v1/routing/route` proxy |
| 7 | Workspace at `/` with left config + right results canvas (Plan 01 / D-01) | ✓ VERIFIED | `workspace-layout.tsx` 320px + 1fr grid |
| 8 | Cache hit skips poll; FAILED shows error + retry (Plan 01) | ✓ VERIFIED | `isCacheHit` branch in store; `job-status-bar.tsx` retry button |
| 9 | Missing MAPBOX token shows explicit Alert (Plan 02 / D-04) | ✓ VERIFIED | `map-token-missing-banner.tsx`; used in `route-map.tsx` and results panel |
| 10 | Stack health relocated to `/status` (Plan 07 / D-01) | ✗ FAILED | `status/page.tsx` is stub only — no diagnostics relocated from Phase 1 |

**Score:** 7/10 truths verified (3 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `apps/web/src/stores/scenario-store.ts` | Zustand poll/comparison/sync state | ✓ VERIFIED | 500+ lines; immer middleware; wired across workspace |
| `apps/web/src/components/scenario/scenario-form.tsx` | Configure + submit | ✓ VERIFIED | Zod + react-hook-form; POST via store |
| `apps/web/src/components/map/route-map.tsx` | SoC map + chargers | ✓ VERIFIED | Mapbox layers, popups, hover sync |
| `apps/web/src/components/charts/soc-profile-chart.tsx` | Recharts profile + sync | ✓ VERIFIED | Reference lines at stops; activeDistance crosshair |
| `apps/web/src/components/kpi/kpi-card-row.tsx` | Seven KPI cards | ✓ VERIFIED | Includes feasibility badge + tier |
| `apps/web/src/components/tables/charging-plan-table.tsx` | Six-column plan + map zoom | ✓ VERIFIED | Row click `flyTo`; selected styling via `ui/table.tsx` |
| `apps/web/src/components/comparison/comparison-tray.tsx` | Pin A/B/C | ✓ VERIFIED | Max 3; hash-keyed |
| `apps/web/src/components/export/export-menu.tsx` | CSV/JSON/PDF menu | ✓ VERIFIED | Wired to store + API |
| `services/api/src/exports.ts` | Puppeteer PDF route | ✓ VERIFIED | UUID + 5MB validation; loads DB row |
| `services/api/src/simulations.ts` | Audit metadata on poll/cache | ✓ VERIFIED | `appendAuditFields` on GET/POST cache hit |
| `apps/web/next.config.ts` | API rewrites | ✓ VERIFIED | `/api/v1/:path*` → Fastify |
| `apps/web/src/app/status/page.tsx` | Stack health diagnostics | ✗ STUB | Only placeholder heading |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `scenario-form.tsx` | `POST /api/v1/simulations` | `submitScenario` → `postSimulation` | ✓ WIRED | Zod-validated body |
| `poll-job.ts` | `GET /api/v1/simulations/{id}` | 2s interval loop | ✓ WIRED | AbortSignal on unmount |
| `route-geometry.ts` | `GET /api/v1/routing/route` | `fetchRouteGeometry` | ✓ WIRED | Origin/dest from corridor catalog |
| `soc-profile-chart.tsx` | `scenario-store activeDistanceM` | onMouseMove sets distM | ✓ WIRED | Bidirectional with map |
| `route-map.tsx` | `scenario-store activeDistanceM` | mousemove nearest segment | ✓ WIRED | Highlights active segment casing |
| `charging-plan-table.tsx` | `mapRef.flyTo` | row click handler | ✓ WIRED | Passes mapRef from results panel |
| `export-menu.tsx` | `POST /api/v1/exports/pdf` | `postPdfExport` + canvas capture | ✓ WIRED | `registerMapSnapshotCapture` in results panel |
| `exports.ts` | `simulation_runs` | SELECT by job_id | ✓ WIRED | Template renders row data |
| `sensitivity-sliders.tsx` | comparison store + POST | debounced `submitSensitivityRun` | ✓ WIRED | Aborts prior poll via `abortController` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `KpiCardRow` | `outputs.kpis`, `outputs.feasibility` | `pollResult.outputs` from API | Yes — `deriveKpiSummary` | ✓ FLOWING |
| `RouteMap` | `segments`, `routeCoords` | poll outputs + `fetchRouteGeometry` | Yes — not hardcoded | ✓ FLOWING |
| `SocProfileChart` | `segments` chart data | poll `outputs.segments` | Yes — `segmentsToChartData` | ✓ FLOWING |
| `ComparisonDiffTable` | `comparisonScenarios` | pinned poll results by hash | Yes — empty until user pins | ✓ FLOWING |
| `ExportMenu` | `pollResult` | Zustand store after COMPLETE | Yes — disabled until complete | ✓ FLOWING |
| `AssumptionsPanel` | `physics_version`, `inputs_hash` | poll metadata from API | Yes — from DB row | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Web lib unit tests | `npm test` in `apps/web` | 22/22 pass | ✓ PASS |
| API simulation + export tests | `npm test` in `services/api` | 16/16 pass | ✓ PASS |
| Poll loop interval | grep `POLL_INTERVAL_MS = 2000` | 2000ms confirmed | ✓ PASS |
| Playwright smoke test | `pnpm test:e2e` | Not run (requires docker stack) | ? SKIP |
| Map hover sync | Manual browser test | Not run | ? SKIP |

### Probe Execution

Step 7c: SKIPPED — no phase-declared probes or `scripts/*/tests/probe-*.sh` for this UI phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| MAP-01 | 04-02 | SoC-gradient route polyline | ⚠️ NEEDS HUMAN | `segment-geojson.ts`, `route-map.tsx` |
| MAP-02 | 04-02 | Charger markers + popup | ⚠️ NEEDS HUMAN | Circle layer + Popup in `route-map.tsx` |
| MAP-03 | 04-03 | Chart synced with map hover | ⚠️ NEEDS HUMAN | Shared `activeDistanceM` store |
| MAP-04 | 04-04 | KPI cards | ✓ SATISFIED | `kpi-card-row.tsx` (7 cards) |
| MAP-05 | 04-04 | Charging plan table | ✓ SATISFIED | `charging-plan-table.tsx` |
| MAP-06 | 04-04 | Assumptions + disclaimer | ✓ SATISFIED | `assumptions-panel.tsx` |
| SCEN-01 | 04-05 | Compare 2+ scenarios | ✓ SATISFIED | Tray + diff table |
| SCEN-02 | 04-05 | Sensitivity sliders + delta KPIs | ✓ SATISFIED | `sensitivity-sliders.tsx` + delta summary |
| SCEN-04 | 04-00, 04-01, 04-07 | Immutable hash cache replay | ✓ SATISFIED | API + UI hash display |
| EXPR-01 | 04-06 | CSV/JSON export | ✓ SATISFIED | Client export libs + tests |
| EXPR-02 | 04-06 | PDF with map + assumptions | ⚠️ NEEDS HUMAN | Template + route; Puppeteer not live-tested |
| EXPR-03 | 04-06 | Physics snapshot + model version in export | ✓ SATISFIED | CSV headers + PDF template sections |
| SCEN-03 | Phase 5 | Corridor gap analysis | — ORPHANED (deferred) | Correctly absent from web app |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `apps/web/src/app/status/page.tsx` | 1–6 | Placeholder stub vs claimed stack health | 🛑 Blocker | Plan 07 must-have failed; SUMMARY claim inaccurate |
| — | — | No TBD/FIXME/XXX in phase source files | — | Clean |

### Human Verification Required

1. **Full analyst E2E workflow** — Configure → run → visualize → compare → export with docker compose + Mapbox token. Expected: complete flow without errors. Why: Playwright smoke exists but was not executed; map/PDF need runtime stack.

2. **Map ↔ chart hover sync** — Hover chart and map alternately after simulation COMPLETE. Expected: shared crosshair/highlight. Why: behavior-dependent invariant; no automated test.

3. **PDF export with map snapshot** — Export PDF with map token configured. Expected: embedded route image in PDF. Why: Puppeteer path mocked in unit tests.

### Gaps Summary

Phase 4 delivers the core analyst dashboard: workspace shell, async simulation flow, map/chart/KPI/table/assumptions components, comparison + sensitivity, and export pipeline are **implemented and wired** in code. Unit tests pass for API audit metadata, exports (mocked PDF), and web pure libs.

**One blocking gap** prevents a clean pass: `/status` was supposed to relocate Phase 1 stack-health diagnostics (Plan 07 / D-01), but the file is a placeholder stub. SUMMARY 04-07 incorrectly reports `fetchStackMeta` verification as passing — adversarial check confirms that function does not exist anywhere in the repo.

**Three roadmap capabilities** (interactive map rendering, map-chart hover sync, live PDF generation) are present and wired but require human UAT with `NEXT_PUBLIC_MAPBOX_TOKEN`, docker compose, and Puppeteer runtime — classified as behavior-unverified, not failed.

**Recommendation:** Fix `/status` stack health relocation (or implement header drawer alternative per UI-SPEC), then run manual UAT checklist in `04-USER-SETUP.md` before marking Phase 4 complete.

---

_Verified: 2026-07-01T22:00:00Z_  
_Verifier: Claude (gsd-verifier)_
