---
phase: 04-analyst-dashboard-export
plan: 02
subsystem: ui
tags: [mapbox, react-map-gl, turf, zustand, line-gradient, route-geometry]

requires:
  - phase: 04-analyst-dashboard-export
    provides: Analyst workspace submit/poll and KPI panel (04-01)
  - phase: 04-analyst-dashboard-export
    provides: segment-geojson, brand tokens, API rewrites (04-07)
  - phase: 04-analyst-dashboard-export
    provides: GET /v1/routing/route proxy (04-00)
provides:
  - Route geometry fetch/cache merged with simulation segments
  - RouteMap with SoC-gradient polyline and HD charger markers
  - MapTokenMissingBanner explicit fallback per D-04
  - Results canvas map region wired after job COMPLETE
affects: [04-03, 04-04, 04-05, 04-06]

tech-stack:
  added: []
  patterns:
    - "fetchRouteGeometry via /api/v1/routing/route with corridor catalog O/D"
    - "routeCoordinatesByJobId cache prevents repeat Valhalla fetches on re-render"
    - "RouteMapDynamic ssr:false with preserveDrawingBuffer for PDF prep (D-23)"

key-files:
  created:
    - apps/web/src/lib/route-geometry.ts
    - apps/web/src/components/map/route-map.tsx
    - apps/web/src/components/map/route-map-dynamic.tsx
    - apps/web/src/components/map/map-token-missing-banner.tsx
  modified:
    - apps/web/src/lib/segment-geojson.ts
    - apps/web/src/lib/segment-geojson.test.ts
    - apps/web/src/stores/scenario-store.ts
    - apps/web/src/components/results/basic-results-panel.tsx
    - apps/web/src/components/workspace/workspace-layout.tsx

key-decisions:
  - "totalDistM uses sum of per-segment dist_m (simulator contract) with cumulative line-progress stops"
  - "Route geometry cached in routeCoordinatesByJobId after COMPLETE; skipped when cache entry exists"

patterns-established:
  - "Pattern: mergeRouteWithSegments aligns Valhalla coordinates with simulation segment distances for Mapbox lineMetrics gradient"
  - "Pattern: Missing MAPBOX token shows MapTokenMissingBanner while KPI/table remain visible"

requirements-completed: [MAP-01, MAP-02]

coverage:
  - id: D1
    description: Interactive map with SoC-gradient route polyline after simulation COMPLETE
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "apps/web/src/lib/segment-geojson.test.ts#test_soc_gradient_stops"
        status: pass
      - kind: other
        ref: "apps/web/node_modules/.bin/next build"
        status: pass
    human_judgment: true
    rationale: "Live SoC gradient rendering requires MAPBOX token and docker stack with Valhalla"
  - id: D2
    description: Charger markers sized by power_kw with popup details
    requirement: MAP-02
    verification:
      - kind: other
        ref: "apps/web/src/components/map/route-map.tsx charger-circles layer"
        status: pass
    human_judgment: true
    rationale: "Popup interaction requires browser map with token and simulation charging_stops"
  - id: D3
    description: Missing MAPBOX token shows explicit Alert not blank map
    verification:
      - kind: other
        ref: "apps/web/src/components/map/map-token-missing-banner.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: Route geometry fetched via GET /api/v1/routing/route and cached by job_id
    verification:
      - kind: unit
        ref: "apps/web/src/lib/segment-geojson.test.ts#test_merge_route_total_distance"
        status: pass
    human_judgment: false

duration: 9 min
completed: 2026-07-01
status: complete
---

# Phase 4 Plan 02: Route Map Vertical Slice Summary

**Mapbox SoC-gradient route polyline with power-sized charger markers, Valhalla geometry fetch/cache, and explicit token-missing banner on analyst results canvas**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-01T20:22:36Z
- **Completed:** 2026-07-01T20:31:30Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `route-geometry.ts` fetches Valhalla coordinates via `/api/v1/routing/route` and merges with simulation segments for gradient scale
- `RouteMap` renders `route-soc` line-gradient layer and `charger-circles` with popups; `RouteMapDynamic` is SSR-safe
- Results canvas shows map above KPI summary with loading skeleton; geometry cached in Zustand by `job_id`

## Task Commits

Each task was committed atomically:

1. **Task 1: Route geometry fetch and segment merge utility** - `793c442` (test)
2. **Task 2: RouteMap component with SoC gradient and charger layers** - `967463b` (feat)
3. **Task 3: Wire map into results canvas after job COMPLETE** - `4d43be8` (feat)

## Files Created/Modified

- `apps/web/src/lib/route-geometry.ts` - fetchRouteGeometry, mergeRouteWithSegments, corridor endpoint resolver
- `apps/web/src/lib/segment-geojson.ts` - cumulative gradient stops + buildRouteGeoJsonSource helper
- `apps/web/src/components/map/route-map.tsx` - Mapbox map with route-soc and charger-circles layers
- `apps/web/src/components/map/route-map-dynamic.tsx` - dynamic import with loading skeleton
- `apps/web/src/components/map/map-token-missing-banner.tsx` - D-04 Alert fallback copy
- `apps/web/src/stores/scenario-store.ts` - routeCoordinatesByJobId cache after COMPLETE
- `apps/web/src/components/results/basic-results-panel.tsx` - map panel min-h 360px with KPI above
- `apps/web/src/components/workspace/workspace-layout.tsx` - syncs corridor catalog into store

## Decisions Made

- `totalDistM` uses sum of per-segment `dist_m` values (simulator emits segment lengths, not cumulative positions)
- Route geometry fetch skipped when `routeCoordinatesByJobId[jobId]` already populated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cumulative line-progress stops for per-segment dist_m**
- **Found during:** Task 1 (buildSocGradientExpression)
- **Issue:** Plan assumed `dist_m` was cumulative route position; simulator emits per-segment lengths
- **Fix:** Accumulate segment distances for gradient stops; `mergeRouteWithSegments` sums segments for `totalDistM`
- **Files modified:** apps/web/src/lib/segment-geojson.ts, apps/web/src/lib/route-geometry.ts
- **Verification:** `node --import tsx --test src/lib/segment-geojson.test.ts`
- **Committed in:** 793c442

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Correct gradient alignment with physics segment model; no API changes.

## Issues Encountered

- `pnpm` workspace hooks fail on ignored build scripts in sandbox; direct `tsc` and `next build` used for verification

## User Setup Required

Set `NEXT_PUBLIC_MAPBOX_TOKEN` in `apps/web/.env.local` for live map tiles (see `04-USER-SETUP.md`).

## Next Phase Readiness

- Plan 04-03 can add SoC profile chart synced to map hover via shared distance state
- `preserveDrawingBuffer` on RouteMap ready for PDF snapshot in Plan 04-06

## Self-Check: PASSED

- FOUND: apps/web/src/lib/route-geometry.ts
- FOUND: apps/web/src/components/map/route-map.tsx
- FOUND: apps/web/src/components/map/map-token-missing-banner.tsx
- FOUND: apps/web/src/stores/scenario-store.ts
- FOUND: 793c442
- FOUND: 967463b
- FOUND: 4d43be8

---
*Phase: 04-analyst-dashboard-export*
*Completed: 2026-07-01*
