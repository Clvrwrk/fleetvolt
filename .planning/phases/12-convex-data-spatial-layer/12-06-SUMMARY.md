---
phase: 12-convex-data-spatial-layer
plan: 06
subsystem: database
tags: [convex, caltrans, aadt, highways, truck, class8, spatial, bbox, flagship, ingest]

# Dependency graph
requires:
  - phase: 12-01-convex-data-spatial-layer
    provides: highwaySegments table schema (segmentId, route, path, aadt, truckAADT, bbox, provenance; by_route/by_segmentId indexes)
  - phase: 12-02-convex-data-spatial-layer
    provides: lib/spatial LINE path (segmentsInBbox / segmentsNearPoint, bbox+haversine)
provides:
  - CalTrans Truck AADT ingest onto highwaySegments (6,865 postmile segments) via an action + batched idempotent internalMutations keyed by segmentId ("CT-<OBJECTID>")
  - truckAADT (5-axle = Class-8 proxy) populated DISTINCT from aadt (total-truck AADT) — Phase-7 PITFALLS #7 honored
  - Data-driven mostCongestedRoute query (flagship gap #1 closed) — ranks routes by aggregate 5-axle truckAADT from data, replacing the hardcoded POLB→SB constant
  - segmentsInBbox (corridor-region / ST_Extent replacement) + corridorCongestion (12-08 freight-intensity proxy) queries
  - Corridor-region set-parity gate vs a same-source ground-truth fixture (fixtures/postgis-corridor.json)
affects: [12-08-report, flagship-query, pulse-intensity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Highway (LINE) ingest mirrors the 12-04/12-05 pattern: local Python prep -> action reads prepped JSON -> batched internalMutation upsert (idempotent by segmentId) -> BUT no geospatial-component insert; the bbox stored per row IS the index for the 12-02 bbox+haversine LINE queries"
    - "mostCongestedRoute replaces a hardcoded flagship constant with a real group-by-route aggregate ranking over 5-axle truckAADT"
    - "Same-source corridor parity: PostGIS holds no CalTrans table, so the corridor ground truth is an INDEPENDENT JS bbox computation over the raw prepped rows (the ST_&&-bbox equivalent), asserted for identical set membership — source mismatch documented, not faked"

key-files:
  created:
    - data/ingest/caltrans/prep_truck_aadt.py (Task 1)
    - data/ingest/caltrans/out/.gitkeep (Task 1)
    - apps/web/convex/highways/mutations.ts (Task 2)
    - apps/web/convex/highways/ingest.ts (Task 2)
    - scripts/highways_load.mjs (Task 2)
    - apps/web/convex/highways/queries.ts (Task 3)
    - apps/web/convex/highways/queries.test.ts (Task 4)
    - apps/web/convex/fixtures/postgis-corridor.json (Task 4 — same-source corridor ground truth)
  modified: []

key-decisions:
  - "CalTrans geojson features are POINT postmiles, NOT LINESTRINGs — the plan assumed lines. Each segment's path is a single WGS84 vertex + degenerate bbox (min==max). No Douglas-Peucker simplify needed; trivially under the 1MB doc guard; fully compatible with the 12-02 bbox-intersection LINE queries. Documented deviation."
  - "The Truck__Average_Daily_Traffic.csv is REDUNDANT — the geojson properties already carry every axle-class AADT column in WGS84, so the csv join is a no-op. Prep reads the geojson alone (documented)."
  - "truckAADT <- TRK_5_AXLE (5-axle Class-8 proxy); aadt <- TOT_TRK_AADT (total TRUCK AADT, NOT VEHICLE_AADT_TOTAL) — kept in the truck domain, 5-axle a clean subset of the total; PITFALLS #7 honored."
  - "segmentId namespace 'CT-<OBJECTID>' cannot collide with any Phase-7 seed id; upsert-by-segmentId is additive/patch-only, never clobbers Phase-7 rows."
  - "usefulnessScore=8 (data-review-gate on the CalTrans bytes): +2 identity/keys, +1 precise WGS84 postmile, +1 per-segment EST_YEAR vintage, +2 measured state traffic census, +1 full axle breakdown+provenance, +1 statewide coverage; docked 2 for postmile POINTS not routed LINESTRINGs + varying per-segment estimate year."
  - "PostGIS has no CalTrans highwaySegments table (chargers + nhfn_network only) — corridor parity is asserted against a same-source independent-bbox fixture, source mismatch documented (T-12-06d contingency), not fabricated."

patterns-established:
  - "LINE-table ingest deliberately skips spatial.insertPoint (point-only component); the per-row bbox is the spatial index for segmentsInBbox/segmentsNearPoint"
  - "Flagship hardcoded answers become real group-by aggregate queries (mostCongestedRoute); tests assert a strict data-driven ORDER, never a stale constant"

requirements-completed: [INGEST-05, SPATIAL-04]

coverage:
  - id: D1
    description: "CalTrans Truck AADT prepped to 6,865 highwaySegment rows with 5-axle truckAADT DISTINCT from total-truck aadt, thinned path + bbox, documented 5-axle source column"
    requirement: "INGEST-05"
    verification:
      - kind: other
        ref: "data/ingest/caltrans/prep_truck_aadt.py => 6865 segments, 6865 with truckAADT, max=32102 median=486, only 2 coincidental truckAADT==aadt (commit 15cfd68)"
        status: pass
    human_judgment: false
  - id: D2
    description: "highwaySegments populated idempotently by segmentId (CT-<OBJECTID>) with Caltrans_AADT provenance; no geospatial-component insert (LINE bbox path)"
    requirement: "INGEST-05"
    verification:
      - kind: integration
        ref: "node scripts/highways_load.mjs => received=6865 inserted=6865 withTruck=6865; re-run inserted=0 patched=3 (idempotent) (commit b741d07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Data-driven mostCongestedRoute ranking (flagship gap #1 closed) + segmentsInBbox corridor-region + corridorCongestion queries; thin wrappers over lib/spatial"
    requirement: "SPATIAL-04"
    verification:
      - kind: integration
        ref: "npx convex run highways/queries:mostCongestedRoute {limit:3} => RTE5(3.08M) > RTE99(1.75M) > RTE10(1.34M), data-ranked not constant (commit 154f751)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Corridor-region set-parity (Convex segmentsInBbox membership == same-source corridor fixture) + data-driven ranking + 5-axle distinctness tests"
    requirement: "SPATIAL-04"
    verification:
      - kind: integration
        ref: "convex/highways/queries.test.ts (3/3 pass; 825-segment corridor set parity, ranking desc, truckAADT<=aadt on >50% strictly) (commit 06ccfb0)"
        status: pass
    human_judgment: false

# Metrics
duration: 38min
completed: 2026-07-07
status: complete
---

# Phase 12 Plan 06: CalTrans Truck AADT → Convex highways layer Summary

**6,865 CalTrans Truck-AADT postmile segments ingested onto Convex highwaySegments with the 5-axle Class-8 proxy (truckAADT) kept strictly distinct from total-truck aadt, corridor-region bbox parity, and the flagship's hardcoded "most congested route" replaced by a real data-driven mostCongestedRoute ranking (RTE 5 tops statewide by 5-axle volume)**

## Performance

- **Duration:** ~38 min
- **Completed:** 2026-07-07
- **Tasks:** 4 (all committed atomically with hooks, no --no-verify)
- **Files created:** 8

## Accomplishments

- **Task 1:** `prep_truck_aadt.py` parses the CalTrans geojson (6,865 features) → `caltrans_segments.json`. 6,865 segments, all with truckAADT (5-axle), max=32,102 median=486; truckAADT DISTINCT from aadt (only 2 coincidental equals). — `15cfd68`
- **Task 2:** `mutations.ts` (upsertSegmentBatch, bbox-encloses-path validated, idempotent by segmentId, NO geospatial-component insert), `ingest.ts` (chunked action), `highways_load.mjs` (loader + fixture regen + top-N print). **Live ingest ran** against sensible-oriole-832: **6,865 inserted, all with truckAADT; re-run idempotent (inserted=0, patched=3).** — `b741d07`
- **Task 3:** `queries.ts` — `segmentsInBbox` (corridor-region / ST_Extent replacement), `mostCongestedRoute` (5-axle group-by-route ranking, flagship gap #1 closed), `corridorCongestion` (12-08 freight proxy). Thin wrappers over lib/spatial. — `154f751`
- **Task 4:** `queries.test.ts` (3/3 pass) + `fixtures/postgis-corridor.json` (825-segment same-source corridor ground truth). — `06ccfb0`

## Task Commits

1. **Task 1: prep CalTrans Truck AADT** — `15cfd68` (feat)
2. **Task 2: ingest action + mutations + loader** — `b741d07` (feat)
3. **Task 3: corridor-region + congested-route queries** — `154f751` (feat)
4. **Task 4: parity + ranking tests + fixture** — `06ccfb0` (test)

## Files Created/Modified

- `data/ingest/caltrans/prep_truck_aadt.py` — geojson → 6,865 segment rows; documents TRK_5_AXLE as the 5-axle Class-8 proxy and TOT_TRK_AADT as the total-truck denominator
- `data/ingest/caltrans/out/.gitkeep` — output dir marker (the derived caltrans_segments.json is NOT committed)
- `apps/web/convex/highways/mutations.ts` — upsertSegmentBatch (idempotent, bbox validation, no point-index)
- `apps/web/convex/highways/ingest.ts` — chunked action reading prepped rows
- `apps/web/convex/highways/queries.ts` — segmentsInBbox / mostCongestedRoute / corridorCongestion
- `apps/web/convex/highways/queries.test.ts` — corridor parity + data-driven ranking + 5-axle distinctness
- `apps/web/convex/fixtures/postgis-corridor.json` — same-source corridor ground truth (825 segmentIds in POLB→SB bbox)
- `scripts/highways_load.mjs` — ingest driver + fixture regen + top-N congested print

## Key Verification Results

- **Prepped:** 6,865 segments (matches the expected ~6,865), all carrying truckAADT(5-axle); truckAADT max=32,102 median=486; distinct from aadt (2 coincidental equals only).
- **Ingested:** 6,865 highwaySegments into sensible-oriole-832, all withTruck. **Idempotent:** re-run inserted=0, patched=3.
- **mostCongestedRoute (data-driven):** RTE 5 (sum 5-axle 3,079,080) > RTE 99 (1,747,234) > RTE 10 (1,337,478) > RTE 101 > RTE 60 … — a real statewide ranking from data, NOT the hardcoded POLB→SB constant. Flagship gap #1 closed.
- **Corridor-region parity:** Convex `segmentsInBbox` over the POLB→SB bbox returns **825 segments — identical membership** to the same-source fixture (0 missing, 0 extra).
- **Tests:** `queries.test.ts` **3/3 pass** (parity, ranking, distinctness).
- **tsc `--noEmit`:** CLEAN except the pre-existing `scenario-form.tsx` error.

## Decisions Made

See `key-decisions` frontmatter. Headlines: (1) CalTrans features are POINT postmiles not LINESTRINGs → single-vertex path + degenerate bbox; (2) the csv is redundant (geojson properties carry all AADT columns in WGS84); (3) truckAADT←TRK_5_AXLE, aadt←TOT_TRK_AADT (both truck-domain, PITFALLS #7); (4) segmentId="CT-<OBJECTID>" namespace can't collide with Phase-7; (5) PostGIS lacks a CalTrans table → same-source independent-bbox parity fixture.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Geometry is POINTs, not LINESTRINGs**
- **Found during:** Task 1 (reading the actual geojson bytes)
- **Issue:** The plan assumed CalTrans segments are LINES needing simplify-js/Douglas-Peucker thinning. The authoritative geojson is 6,865 **Point** postmiles — there is no polyline to simplify.
- **Fix:** Each segment's `path` is a single WGS84 vertex and `bbox` is its degenerate envelope (min==max). This still satisfies the schema (path[], bbox{}), the 1MB doc guard, and the 12-02 bbox-intersection LINE queries (a degenerate bbox is a point-in-rectangle test). No simplify needed.
- **Files modified:** data/ingest/caltrans/prep_truck_aadt.py
- **Verification:** 6,865 segments emitted; corridor bbox query returns 825; tests pass.
- **Committed in:** `15cfd68`

**2. [Rule 3 - Blocking] highways/* functions not deployed to the dev deployment**
- **Found during:** Task 2 (first ingest attempt returned "function not found")
- **Issue:** `npx convex codegen` only generates TypeScript bindings; it does NOT push functions. The loader's `npx convex run highways/ingest:run` failed because the action wasn't deployed.
- **Fix:** Ran `npx convex dev --once` (with CONVEX_TMPDIR set) to push the highways functions before ingesting. Same before Task 3/4 queries.
- **Files modified:** none (deployment step only)
- **Verification:** ingest then ran clean (6,865 inserted); queries + tests green.
- **Committed in:** n/a (no source change)

**3. [Rule 2 - Missing Critical] PostGIS has no CalTrans highwaySegments table**
- **Found during:** Task 4 (fixture capture)
- **Issue:** The plan's corridor parity gate references a PostGIS ST_Extent ground truth. The docker PostGIS holds only `chargers` + `nhfn_network` — no CalTrans AADT table exists, so a literal PostGIS fixture cannot be captured without fabricating data.
- **Fix:** Per the plan's own T-12-06d contingency, the corridor ground truth is computed INDEPENDENTLY in `highways_load.mjs` (plain-JS bbox-intersection over the raw prepped rows — the ST_&&-bbox equivalent) and written to `fixtures/postgis-corridor.json`. The test asserts Convex `segmentsInBbox` returns the identical set (825 segments). The source mismatch is documented in the fixture, the test header, and here — not papered over.
- **Files modified:** scripts/highways_load.mjs, apps/web/convex/highways/queries.test.ts, apps/web/convex/fixtures/postgis-corridor.json
- **Verification:** parity test passes with 0 missing / 0 extra vs the same-source truth.
- **Committed in:** `b741d07` (loader) / `06ccfb0` (test + fixture)

---

**Total deviations:** 3 (2 missing-critical, 1 blocking) — all necessary and within plan scope.
**Impact on plan:** No scope creep. The POINT-vs-LINE reality and the absent PostGIS CalTrans table are honest data-shape findings the plan pre-authorized handling for (T-12-06d). All four artifacts delivered.

## Issues Encountered

- **POINT vs LINE geometry** (Deviation 1) — resolved with degenerate single-vertex path + bbox; the 12-02 LINE spatial path handles it unchanged.
- **Convex function deployment** (Deviation 2) — `codegen` ≠ deploy; `convex dev --once` required before running server-side functions.
- **No same-source PostGIS ground truth** (Deviation 3) — resolved with an independent-bbox same-source fixture, mismatch documented.

## Flagship / downstream notes

- **Flagship gap #1 CLOSED:** the "most congested freight route" is now `mostCongestedRoute`, a real 5-axle ranking. Statewide it returns **RTE 5** (I-5 freight spine); the SoCal freight routes RTE 10 (#3), RTE 60 (#5), RTE 91, RTE 710 all rank high. 12-08 / the flagship narrative should reconcile that the hardcoded "POLB→SB" is a *corridor* framing, while the raw statewide 5-axle leader is I-5 — filter to the SoCal/POLB corridor bbox (via `corridorCongestion`) if the flagship answer must stay corridor-scoped.
- **corridorCongestion** supplies the per-segment 5-axle freight-intensity the 12-08 hotspot score + pulse-intensity render consume.

## User Setup Required

None — CalTrans Truck AADT is a local file; no API key or external service.

## Next Phase Readiness

- highwaySegments carries CalTrans 5-axle truckAADT (Class-8 proxy) distinct from total-truck aadt; queryable via segmentsInBbox / mostCongestedRoute / corridorCongestion for 12-08 consumption.
- **STATE.md / ROADMAP.md not touched** (orchestrator-owned), as instructed.
- **Git hygiene:** explicit `git add <path>` only; the pre-existing dirty `_generated/api.d.ts` and the derived `out/caltrans_segments.json` were left uncommitted.

## Self-Check: PASSED

- `git log --grep="12-06"` returns 4 commits (15cfd68, b741d07, 154f751, 06ccfb0).
- Task acceptance re-run: prep 6,865 segments; ingest 6,865 (idempotent re-run patched=3); mostCongestedRoute data-ranked; queries.test.ts 3/3; tsc clean except scenario-form.
- Plan `<verification>`: 6,865 segments truckAADT distinct from aadt ✓; idempotent by segmentId ✓; three queries exist + thin ✓; corridor set parity (825) + real 5-axle ranking ✓; tsc clean-except-preexisting ✓.

---
*Phase: 12-convex-data-spatial-layer*
*Completed: 2026-07-07*
