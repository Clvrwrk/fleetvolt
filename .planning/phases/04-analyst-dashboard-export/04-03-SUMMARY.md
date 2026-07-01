---
phase: 04-analyst-dashboard-export
plan: 03
subsystem: ui
tags: [recharts, zustand, mapbox, hover-sync, segment-lookup]

requires:
  - phase: 04-analyst-dashboard-export
    provides: RouteMap with SoC gradient and geometry cache (04-02)
  - phase: 04-analyst-dashboard-export
    provides: segment-lookup utility stub (04-07)
provides:
  - SocProfileChart with distance (mi) vs SoC % and charging stop reference lines
  - Zustand activeDistanceM bidirectional map↔chart hover sync
  - Cumulative-distance segment index lookup hardened for simulator dist_m contract
affects: [04-04, 04-05, 04-06]

tech-stack:
  added: []
  patterns:
    - "activeDistanceM in Zustand — not Recharts syncId — for map↔chart sync per D-07"
    - "Recharts 3 onMouseMove uses activeTooltipIndex to read chartData distM"
    - "Map mousemove via turf nearestPointOnLine location × totalDistM"

key-files:
  created:
    - apps/web/src/components/charts/soc-profile-chart.tsx
  modified:
    - apps/web/src/lib/segment-lookup.ts
    - apps/web/src/lib/segment-lookup.test.ts
    - apps/web/src/stores/scenario-store.ts
    - apps/web/src/lib/route-geometry.ts
    - apps/web/src/components/map/route-map.tsx
    - apps/web/src/components/results/basic-results-panel.tsx

key-decisions:
  - "findSegmentIndexByDistanceM uses cumulative end-of-segment midpoints because simulator dist_m is per-segment length"
  - "Primary panel 3/2 flex wired in basic-results-panel (results canvas) where map already lives from 04-02"

patterns-established:
  - "Pattern: Chart ReferenceLine crosshair at activeDistanceMi (#6366f1); map white 9px casing on active segment"

requirements-completed: [MAP-03]

coverage:
  - id: D1
    description: SoC profile chart with distance on X-axis and SoC on Y-axis per D-08
    requirement: MAP-03
    verification:
      - kind: other
        ref: "apps/web/node_modules/.bin/next build"
        status: pass
    human_judgment: true
    rationale: "Live chart rendering and stop reference line alignment require browser with simulation outputs"
  - id: D2
    description: Hovering chart updates shared activeDistanceM and highlights map segment per D-07
    requirement: MAP-03
    verification:
      - kind: unit
        ref: "apps/web/src/lib/segment-lookup.test.ts#test_nearest_segment_at_distance"
        status: pass
    human_judgment: true
    rationale: "Cross-widget hover sync requires MAPBOX token and interactive browser"
  - id: D3
    description: Hovering map route updates chart crosshair at matching distance per D-07
    requirement: MAP-03
    verification:
      - kind: other
        ref: "apps/web/src/components/map/route-map.tsx onMapMouseMove"
        status: pass
    human_judgment: true
    rationale: "Map mousemove → chart crosshair requires live map session"
  - id: D4
    description: Charging stop vertical reference lines at stop distances per D-08
    verification:
      - kind: other
        ref: "apps/web/src/components/charts/soc-profile-chart.tsx ReferenceLine"
        status: pass
    human_judgment: true
    rationale: "Stop line placement vs segment geometry needs visual check with charging_stops data"

duration: 10 min
completed: 2026-07-01
status: complete
---

# Phase 4 Plan 03: SoC Profile Chart Map Sync Summary

**Recharts SoC profile chart with bidirectional map↔chart hover sync via Zustand activeDistanceM and cumulative segment lookup**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-01T20:23:00Z
- **Completed:** 2026-07-01T20:33:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- `SocProfileChart` renders SoC % vs distance (mi) with optional energy kWh series and dashed stop reference lines
- `activeDistanceM` in Zustand drives chart crosshair (#6366f1) and map segment white casing highlight
- Map `mousemove` and chart `onMouseMove` both update shared distance state without Recharts `syncId`

## Task Commits

Each task was committed atomically:

1. **Task 1: Segment lookup utility tests and store activeDistanceM** - `7a10128` (test)
2. **Task 2: SocProfileChart with Recharts line and stop reference lines** - `beb7caa` (feat)
3. **Task 3: Bidirectional map-chart hover sync in workspace layout** - `6c6bd74` (feat)

## Files Created/Modified

- `apps/web/src/lib/segment-lookup.ts` - Cumulative distance lookup, chart data mapping, stop distance helper
- `apps/web/src/lib/segment-lookup.test.ts` - nearest segment, edge-before-first, miles conversion tests
- `apps/web/src/stores/scenario-store.ts` - activeDistanceM, setActiveDistanceM, getActiveSegmentIndex
- `apps/web/src/components/charts/soc-profile-chart.tsx` - Recharts LineChart with sync and stop markers
- `apps/web/src/components/map/route-map.tsx` - Map hover sets distance; active segment highlight layer
- `apps/web/src/lib/route-geometry.ts` - sliceRouteByDistanceM, segmentDistanceBoundsM
- `apps/web/src/components/results/basic-results-panel.tsx` - 3/2 map/chart flex primary panel

## Decisions Made

- Cumulative mid-segment distance for index lookup matches simulator per-segment `dist_m` contract (not raw dist_m values)
- Recharts 3 `MouseHandlerDataParam` uses `activeTooltipIndex` instead of deprecated `activePayload`
- Map/chart flex layout placed in `basic-results-panel` (actual results canvas from 04-02) rather than `workspace-layout` shell

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cumulative distance for segment index lookup**
- **Found during:** Task 1
- **Issue:** Raw `dist_m` comparison incorrect when simulator emits per-segment lengths
- **Fix:** Accumulate segment lengths for midpoint search; chart data uses cumulative end distances
- **Files modified:** apps/web/src/lib/segment-lookup.ts
- **Committed in:** 7a10128

**2. [Rule 3 - Blocking] Recharts 3 mouse event API**
- **Found during:** Task 2 typecheck
- **Issue:** `activePayload` removed from `MouseHandlerDataParam` in Recharts 3.9
- **Fix:** Read `activeTooltipIndex` and map to `chartData[index].distM`
- **Files modified:** apps/web/src/components/charts/soc-profile-chart.tsx
- **Committed in:** beb7caa

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Required for correct sync behavior and TypeScript build; no scope creep.

## Issues Encountered

- pnpm install hooks fail in sandbox; direct `tsc` and `next build` used for verification

## User Setup Required

Set `NEXT_PUBLIC_MAPBOX_TOKEN` for live map hover sync; chart renders without token.

## Next Phase Readiness

- Plan 04-04 can add charging plan table with row selection synced to map stops
- Shared `activeDistanceM` ready for comparison diff and sensitivity overlays

## Self-Check: PASSED

- FOUND: apps/web/src/components/charts/soc-profile-chart.tsx
- FOUND: apps/web/src/lib/segment-lookup.ts
- FOUND: apps/web/src/stores/scenario-store.ts
- FOUND: apps/web/src/components/map/route-map.tsx
- FOUND: 7a10128
- FOUND: beb7caa
- FOUND: 6c6bd74

---
*Phase: 04-analyst-dashboard-export*
*Completed: 2026-07-01*
