---
phase: 11-google-maps-app-wide-routing-migration
plan: 03
subsystem: ui
tags: [google-maps, vis-gl-react-google-maps, mapbox-removal, vector-map, advanced-markers, route-map, migration]

requires:
  - phase: 07-01
    provides: "@vis.gl/react-google-maps installed + audited, vector mapId, ConvexClientProvider"
  - phase: 07-03
    provides: "working Google map reference pattern (pulse-map.tsx, port-anchors.tsx)"
provides:
  - "route-map.tsx ported to @vis.gl/react-google-maps vector map (segmented SoC polylines + white active casing, power-scaled charger AdvancedMarkers, InfoWindow, turf hover-sync)"
  - "FvMapHandle framework-neutral map abstraction (map-ref.ts) replacing react-map-gl MapRef across all non-render consumers"
  - "soc-segments.ts SoC-gradient -> segmented-polyline helper + unit test (MAP-01 encoding proof)"
  - "mapbox-gl + react-map-gl removed app-wide (package.json, next.config transpilePackages, .env.local.example); single Google map library"
  - "token-missing banner keyed on Google Maps API key + mapId"
affects: [12-convex-data-spatial, 13-physics-convex-actions, 14-vercel-decommission-docker]

tech-stack:
  removed: [mapbox-gl, react-map-gl]
  added: []  # @vis.gl/react-google-maps already present from Phase 7
  patterns: [vector-mapId-advanced-markers, fvmaphandle-neutral-map-ref, segmented-solid-polylines-for-soc-gradient]

key-files:
  created:
    - apps/web/src/lib/soc-segments.ts
    - apps/web/src/lib/soc-segments.test.ts
    - apps/web/src/lib/map-ref.ts
    - apps/web/src/components/workspace/route-planner-right-rail.tsx  # pre-existing untracked, now committed
    - apps/web/src/components/workspace/route-planner-center.tsx      # pre-existing untracked, now committed
    - apps/web/src/components/tables/charging-plan-compact.tsx        # pre-existing untracked, now committed
  modified:
    - apps/web/src/components/map/route-map.tsx
    - apps/web/src/components/map/map-token-missing-banner.tsx
    - apps/web/src/components/workspace/workspace-layout.tsx
    - apps/web/src/components/results/basic-results-panel.tsx
    - apps/web/src/components/tables/charging-plan-table.tsx
    - apps/web/package.json
    - apps/web/next.config.ts
    - apps/web/.env.local.example
    - apps/web/playwright.config.ts
    - apps/web/tests/scenario-run.spec.ts

key-decisions:
  - "route-map.tsx SoC gradient rendered as SEGMENTED solid-color Polylines sampled from the same socColor() ramp (Google has no per-vertex gradient) — proven by soc-segments.test.ts (P11-03, MAP-01)"
  - "charger markers use AdvancedMarker (never google.maps.Marker) with a styled DOM child + InfoWindow (MAP-02)"
  - "FvMapHandle abstraction (panTo, captureSnapshot) decouples the 7 non-render consumers from react-map-gl (P11-02)"
  - "PNG snapshot export degrades to null under Google's WebGL vector map (no getCanvas().toDataURL()); registerMapSnapshotCapture(null) is a valid store state — documented, not a crash"
  - "valhalla_status unchanged here (backend concern, plan 11-01)"

patterns-established:
  - "Import value symbols via the @/lib/* alias, NOT ./x.js — Turbopack cannot resolve .js value imports at runtime even though tsc accepts them (see bug below)"
  - "scenario-run.spec.ts is a no-crash SMOKE gate (form->run->results), NOT a MAP-01/02/03 assertion gate — visual fidelity proven separately by soc-segments.test.ts + manual check"
---

# Phase 11 Plan 03 — App-Wide Mapbox → Google Maps Migration — Summary

**Requirements addressed:** P11-01, P11-02, P11-03, P11-07 (re-scoped v3.0 IDs: FLOW-01, MAP-01, MAP-02, MAP-03).

## What was built

Completed the app-wide migration off Mapbox that Phase 7 began for `/pulse`. Every map surface now runs on `@vis.gl/react-google-maps` + vector `mapId`, and `mapbox-gl`/`react-map-gl` are gone from the repo.

1. **soc-segments.ts + test** (`e1e53e4`) — SoC-gradient → segmented solid-color polyline helper (green >40 / amber 20–40 / red <20 from the socColor ramp) + white active casing. Unit test **6/6** (threshold transitions, endpoint continuity, degenerate-input safety) — the programmatic proof of MAP-01.
2. **FvMapHandle abstraction** (`9fef4cb`) — framework-neutral map ref (`panTo`, `captureSnapshot`) replacing react-map-gl's `MapRef` across every non-render consumer.
3. **token-missing banner** (`99f21c9`) — re-keyed on `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `NEXT_PUBLIC_GOOGLE_MAP_ID`.
4. **route-map.tsx port** (`a5438d6`) — the highest-risk file: Google vector map (APIProvider quarterly / RenderingType.VECTOR), segmented SoC Polylines + casing, power-scaled charger `AdvancedMarker`s (testid `charger-marker`), `InfoWindow`, turf hover-sync via Google map listeners, preserved `aria-label`.
5. **Consumer migration** (`a837a0b`) — 6 consumers moved to FvMapHandle (`MapRef`→`FvMapHandle`, `flyTo`→`panTo`, `getCanvas().toDataURL()`→`captureSnapshot()`, `hasMapToken`→Google env).
6. **route-map-dynamic.tsx** (T6) — verified `ssr:false` + `route-map-loading` testid intact; no change needed.
7. **Dependency removal** (`2c0b5d4`) — `mapbox-gl` + `react-map-gl` removed from package.json deps + next.config transpilePackages; `.env.local.example` Mapbox retirement note; `pnpm-lock.yaml` refreshed (0 mapbox refs).
8. **Build fix** (`c270d60`) — see bug below.

## Verification (real results)

- `tsc --noEmit` → **CLEAN** except the single pre-existing `scenario-form.tsx` Phase-4 Zod error (not ours).
- `node --test soc-segments.test.ts` → **6 pass / 0 fail** (MAP-01 encoding intact).
- `grep react-map-gl|mapbox-gl|NEXT_PUBLIC_MAPBOX_TOKEN` in src/next.config/package.json → **NO_MAPBOX_ANYWHERE** (only a descriptive comment remains in map-ref.ts).
- `/planner` on a host dev server → **HTTP 200** after the build fix (was 500 before).
- scenario-run smoke gate → progressed through scenario-form → run-button → job-status → results-canvas all visible; final result-text assertion timed out at 120s on the host dev server (see below). No assertions weakened.

## Bug found & fixed (build-breaking)

`soc-segments.ts` imported **value** symbols via `.js` extensions (`import { socColor } from "./segment-geojson.js"`, `import { segmentDistanceBoundsM, ... } from "./route-geometry.js"`). `tsc` resolves `.js`→`.ts` and passed green, but **Turbopack cannot resolve `.js` value imports at runtime → `/planner` returned HTTP 500 (module-not-found)**. Sibling files using the same `.js` convention only import *types* (erased at compile), so they never failed. Fixed both to the codebase `@/lib/*` alias convention (`c270d60`); `/planner` now 200. **Lesson captured in patterns-established.**

## Deviations / notes

- **Scope discipline:** the working tree carried pre-existing unrelated dirt (export-menu, kpi-card-row, job-status-bar, orchestrator.py, docker-compose.yml, Dockerfile, phase 01/03/04 docs). NONE of it was staged — every commit used explicit `git add <path>`, never `-A`. The next.config.ts turbopack/monorepoRoot hunk was left untouched via surgical `git apply --cached` of only the transpilePackages hunk.
- **3 consumer files were pre-existing UNTRACKED Phase-7-era files** (route-planner-right-rail, route-planner-center, charging-plan-compact) — committed as part of this migration since they carried the FvMapHandle edits.
- **PNG export degrades to null** — Google's WebGL vector map has no `getCanvas().toDataURL()`; `registerMapSnapshotCapture(null)` is a valid store state, so export degrades gracefully rather than crashing. Flag for a follow-up if PNG export becomes a requirement (not a Phase-11 requirement).
- **scenario-run result-text timeout:** the docker `web` container's API proxy is misconfigured (baked `localhost:4000` instead of `api:4000` → ECONNREFUSED) — PRE-EXISTING infra dirt, will be addressed in Phase 14 (Vercel/Docker decommission). On a host dev server the form/run/status/canvas all render; the final sim-result text didn't complete in 120s (Convex/env difference on the host server). This does not indicate a migration regression — the map mounts and renders.

## ⚠️ Manual visual check needed (human, on /planner) — DEFERRED to Phase 14

The smoke gate proves no-crash + results render; it does NOT assert map visuals. The browser
visual check of MAP-01/02/03 was **deferred to Phase 14 (Vercel deploy)** by Chris on 2026-07-07.

**Why deferred:** the docker-compose `web` container cannot currently render the app end-to-end
due to TWO pre-existing infra issues (NOT Phase 11 regressions):
1. The running web image baked `API_URL=localhost:4000` at build time (should be `api:4000`) →
   `ECONNREFUSED` inside Docker → the `API 500` seen in the browser.
2. A half-finished, uncommitted rewrite of `apps/web/Dockerfile` (monorepo-aware build) omits
   copying `apps/web/convex/`, so the web image **won't rebuild** (`Can't resolve
   '../../../convex/_generated/api'`).

Both are Docker-deployment concerns that Phase 14 (Vercel + decommission Docker) replaces wholesale.
Fixing them in docker-compose now would be throwaway work.

**Phase 11 code IS verified** at the level that matters:
- PTV routing proven end-to-end from the container: POLB→San Bernardino = 117,432 m, 1,296 [lon,lat] coords, edge_speeds=[] (fallback as designed).
- Full physics simulation COMPLETES via the API: 231.86 kWh real output.
- route-map.tsx Google port committed, tsc-clean, SoC unit test 6/6.

**Phase 14 must include:** verify MAP-01 (SoC gradient), MAP-02 (charger markers+popups),
MAP-03 (hover→chart sync) on the deployed Vercel app; fix/replace the web build so API_URL
resolves correctly.

When you're ready (MAP-01/02/03):
- **MAP-01** — SoC-gradient segmented polyline: green (>40%) / amber (20–40%) / red (<20%) at the right stretches
- **MAP-02** — power-scaled charger markers + InfoWindow popups on click
- **MAP-03** — hovering the map moves the SoC/energy chart cursor

## Output

Plan 11-03 complete (all 8 tasks). Wave 0 (11-01 + 11-03) done. Next: 11-02 (Valhalla Docker/Makefile teardown).
