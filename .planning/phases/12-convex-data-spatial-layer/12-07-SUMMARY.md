---
phase: 12-convex-data-spatial-layer
plan: 07
subsystem: database
tags: [convex, natd, osm, pyosmium, pbf, parking, pois, spatial, ingest, geospatial]

# Dependency graph
requires:
  - phase: 12-01-convex-data-spatial-layer
    provides: parking + pois table schemas (location, numberOfSpots, hgv, type union, provenance) with NATD + OSM provenance sources
  - phase: 12-02-convex-data-spatial-layer
    provides: lib/spatial POINT path (insertPoint / nearestPoints) for parking + pois
provides:
  - NATD CA truck-stop parking (83 sites) ingested onto the Convex parking table via an action + batched idempotent internalMutations keyed by parkingKey, spatial-indexed; numberOfSpots is the P12-12 capacity proxy
  - OSM POI extraction (P12-14, reverses BENEFIT-MATRIX ARCHIVE verdict) — streaming pyosmium pass over the 1.3GB california-latest.osm.pbf, SoCal/POLB-corridor-bbox-bounded, 12,964 POIs ingested onto the pois table (fuel 2595, convenience 2124, fast_food 8188, rest_area 53, truck_parking 4), spatial-indexed
  - classifyPoi — single tag->type precedence spec shared by Python (extract_pois.py) + Convex (classify.ts), dual-guarded by extract.test.ts (11/11)
  - poisInRadius (grouped by type, P12-15c) + parkingInRadius (+ totalSpotsWithinRadius capacity proxy, P12-15b) thin radius queries for the 12-08 report payload
affects: [12-08-report, hotspot-score, pulse-intensity]

# Tech tracking
tech-stack:
  added: [pyosmium]
  patterns:
    - "POINT-table ingest mirrors the 12-04 charger pattern: local Python prep -> action reads prepped JSON -> batched internalMutation upsert (BATCH_SIZE 50 for the geospatial 4096-reads/mutation re-index limit) -> spatial.insertPoint at write -> idempotent by a stable key (parkingKey / osmKey)"
    - "Streaming pbf extraction: pyosmium SimpleHandler (apply_file locations=True) filters the P12-14 tag set in ONE memory-safe pass, corridor-bbox-bounded, emitting a small POI JSON — the 1.3GB pbf is never loaded whole"
    - "Dual-classifier no-drift: classifyPoi precedence lives once, mirrored byte-for-byte in Python + TS; the mutation RE-DERIVES type from raw tags via classifyPoi (never trusts the wire type); extract.test.ts guards the TS side"

key-files:
  created:
    - data/ingest/natd/prep_parking.py (Task 1)
    - data/ingest/natd/out/.gitkeep (Task 1)
    - data/ingest/osm/extract_pois.py (Task 2)
    - data/ingest/osm/out/.gitkeep (Task 2)
    - apps/web/convex/pois/classify.ts (Task 3)
    - apps/web/convex/pois/extract.test.ts (Task 3)
    - apps/web/convex/pois/mutations.ts (Task 3)
    - apps/web/convex/parking/mutations.ts (Task 4)
    - apps/web/convex/parking/ingest.ts (Task 4)
    - apps/web/convex/pois/ingest.ts (Task 4)
    - scripts/natd_load.mjs (Task 4)
    - scripts/pois_load.mjs (Task 4)
    - apps/web/convex/pois/queries.ts (Task 5)
  modified:
    - apps/web/convex/schema.ts (added parkingKey/osmKey fields + by_parkingKey/by_osmKey indexes for idempotent upsert)

key-decisions:
  - "NATD spots column resolved to `number_of_spots`; the truck-stop parking geojson has `state` so CA filter is exact (83 sites, ALL with a numeric numberOfSpots). hgv:true set for every row (truck-stop parking is HGV by definition). parkingKey = md5(name|lat|lng)."
  - "OSM extraction bounded to the SoCal/POLB-corridor bbox (33.4,-118.7 -> 34.5,-116.9) per the plan (T-12-07a) — statewide fast_food/convenience is tens of thousands; the 12-08 report query only needs the corridor. Documented bound."
  - "Precedence fuel > truck_parking(hgv-required) > rest_area > convenience > fast_food. A fuel+convenience site classifies fuel; a plain amenity=parking with no hgv/access=hgv is NOT truck_parking (returns null) — never over-count car parks as truck parking (T-12-07d)."
  - "Only 4 truck_parking POIs statewide-in-corridor: OSM hgv-tagging on parking is genuinely sparse. This is honest crowd-sourced reality, not a bug — NATD parking (83 measured sites) is the primary truck-parking capacity source; OSM truck_parking is enrichment."
  - "schema.ts is NOT in the plan's files_modified, but the plan's Task-3/Task-4 <action> blocks explicitly call for by_parkingKey / by_osmKey indexes for idempotent upsert — the minimal schema change (2 optional fields + 2 indexes) is plan-sanctioned and additive (optional fields don't break existing rows)."
  - "usefulnessScore: parking=7 (measured NATD census, capacity proxy, but small n=83 + no per-site vintage); pois=6 (free crowd-sourced OSM, sparse hgv-tagging, no freshness stamp, way-centroid approximation). Rubric OUTPUT on the actual bytes, not catalog guesses."

patterns-established:
  - "Streaming-pbf POI extraction: a corridor-bounded pyosmium pass is the free amenities source (P12-14 reverses ARCHIVE), no new paid dependency"
  - "POINT-ingest idempotency + spatial-index-at-write for a second/third point table (parking, pois) reusing the exact 12-04 charger discipline"

requirements-completed: [INGEST-06, INGEST-07]

coverage:
  - id: D1
    description: "NATD CA truck-stop parking (83 sites, all with numberOfSpots capacity proxy + hgv) prepped from the geojson; spots column documented; fails loudly if absent"
    requirement: "INGEST-06"
    verification:
      - kind: other
        ref: "data/ingest/natd/prep_parking.py => 83 CA rows, 83 with numeric numberOfSpots, spots col 'number_of_spots' (commit b21862b)"
        status: pass
    human_judgment: false
  - id: D2
    description: "parking table populated idempotently by parkingKey with NATD measured provenance, spatial-indexed via insertPoint"
    requirement: "INGEST-06"
    verification:
      - kind: integration
        ref: "node scripts/natd_load.mjs => received=83 inserted=83 withSpots=83; re-run inserted=0 patched=83 (idempotent) (commit 7f12b7e)"
        status: pass
    human_judgment: false
  - id: D3
    description: "OSM POIs extracted from the 1.3GB pbf via a streaming corridor-bounded pyosmium pass (12,964 POIs, per-type counts) and ingested with OSM extracted provenance, spatial-indexed"
    requirement: "INGEST-07"
    verification:
      - kind: integration
        ref: "extract_pois.py => 12964 POIs (fuel 2595/convenience 2124/fast_food 8188/rest_area 53/truck_parking 4) (52fe93d); node scripts/pois_load.mjs => inserted=12964 byType matches (7f12b7e)"
        status: pass
    human_judgment: false
  - id: D4
    description: "classifyPoi shared precedence spec; extract.test.ts green covering each tag->type + fuel-over-convenience precedence + hgv-required rule + null-for-unmatched"
    requirement: "INGEST-07"
    verification:
      - kind: unit
        ref: "apps/web/convex/pois/extract.test.ts => # tests 11 # pass 11 # fail 0 (commit 93219cf)"
        status: pass
    human_judgment: false
  - id: D5
    description: "poisInRadius (grouped by type) + parkingInRadius (+ totalSpotsWithinRadius capacity proxy) thin radius queries backing the 12-08 report payload (P12-15b/c)"
    requirement: "INGEST-07"
    verification:
      - kind: integration
        ref: "npx convex run pois/queries:poisInRadius {POLB,30km,[fuel,truck_parking]} => total 163; parkingInRadius {POLB,200km} => count 14 totalSpotsWithinRadius 280 (commit 69538fb)"
        status: pass
    human_judgment: false

# Metrics
duration: 42min
completed: 2026-07-07
status: complete
---

# Phase 12 Plan 07: NATD truck-stop parking + OSM POI extraction Summary

**83 NATD CA truck-stop parking sites (measured spot-count capacity proxy) ingested onto the Convex parking layer, plus 12,964 truck-relevant POIs stream-extracted from the 1.3GB california-latest.osm.pbf via a single corridor-bounded pyosmium pass (fuel/convenience/fast_food/rest_area/truck_parking) onto the pois layer — both spatial-indexed, idempotent, with a shared Python+TS tag->type precedence classifier**

## Performance

- **Duration:** ~42 min
- **Completed:** 2026-07-07
- **Tasks:** 5 (all committed atomically with hooks, no --no-verify)
- **Files created:** 13 (+1 modified: schema.ts)

## Accomplishments

- **Task 1 (`b21862b`):** `prep_parking.py` reads the NATD truck-stop parking geojson (1,915 features), filters to CA via the `state` property → **83 sites, ALL with a numeric `number_of_spots`** (the P12-12 capacity proxy), `hgv:true` by definition, stable `parkingKey`. Fails loudly if the spots column is absent. Also emits a lightweight alt-fuel corridor names note (352 CA rows).
- **Task 2 (`52fe93d`):** `extract_pois.py` — a single streaming pyosmium pass over the **1.3GB** pbf (never loaded whole into RAM), SoCal/POLB-corridor-bbox-bounded → **12,964 POIs**: fuel 2595, convenience 2124, fast_food 8188, rest_area 53, truck_parking 4. Nodes use own lat/lon; ways use a member-node centroid.
- **Task 3 (`93219cf`):** `classifyPoi` — the single tag→type precedence spec (mirrored exactly in Python), `pois/mutations.ts` re-derives type from raw tags via it. `extract.test.ts` **11/11 green**. schema.ts gained `parkingKey`/`osmKey` + `by_parkingKey`/`by_osmKey` indexes.
- **Task 4 (`7f12b7e`):** parking + pois ingest actions/mutations + loaders. **Live ingest against sensible-oriole-832:** parking **83 inserted / 83 withSpots** (re-run idempotent: 0 inserted / 83 patched); pois **12,964 inserted**, byType exactly matching extraction, 0 skippedUnclassified.
- **Task 5 (`69538fb`):** `pois/queries.ts` — `poisInRadius` (grouped by type, P12-15c) + `parkingInRadius` (+ `totalSpotsWithinRadius`, P12-15b). Thin wrappers over lib/spatial. **Live-verified.**

## Task Commits

1. **Task 1: prep NATD CA parking** — `b21862b` (feat)
2. **Task 2: streaming OSM POI extraction** — `52fe93d` (feat)
3. **Task 3: shared classifyPoi + test + mutation + schema** — `93219cf` (test)
4. **Task 4: parking + POI ingest actions + loaders** — `7f12b7e` (feat)
5. **Task 5: POI + parking radius queries** — `69538fb` (feat)

## Files Created/Modified

- `data/ingest/natd/prep_parking.py` — NATD geojson → 83 CA parking rows; documents `number_of_spots` as the capacity proxy
- `data/ingest/natd/out/.gitkeep` — output marker (derived natd_parking.json NOT committed)
- `data/ingest/osm/extract_pois.py` — streaming pyosmium pbf pass → corridor-bounded POI JSON; per-type counts; classify_poi mirrors classify.ts
- `data/ingest/osm/out/.gitkeep` — output marker (derived osm_pois.json NOT committed)
- `apps/web/convex/pois/classify.ts` — shared classifyPoi + matchedTag (single precedence spec)
- `apps/web/convex/pois/extract.test.ts` — 11 tests: each tag→type + precedence + hgv-required + null
- `apps/web/convex/pois/mutations.ts` — upsertPoiBatch (re-derives type, upsert by osmKey, insertPoint filterFields{type})
- `apps/web/convex/pois/ingest.ts` — chunked action (BATCH_SIZE 50)
- `apps/web/convex/pois/queries.ts` — poisInRadius / parkingInRadius
- `apps/web/convex/parking/mutations.ts` — upsertParkingBatch (upsert by parkingKey, insertPoint filterFields{hgv})
- `apps/web/convex/parking/ingest.ts` — chunked action (BATCH_SIZE 50)
- `apps/web/convex/schema.ts` — parking.parkingKey + pois.osmKey fields + by_parkingKey/by_osmKey indexes
- `scripts/natd_load.mjs` / `scripts/pois_load.mjs` — ingest drivers + count printers

## Key Verification Results

- **NATD parking prepped:** 83 CA sites, 83 with numeric numberOfSpots (spots col `number_of_spots`).
- **NATD parking ingested:** 83 inserted / 83 withSpots; **idempotent** re-run 0 inserted / 83 patched.
- **OSM POIs extracted:** 12,964 (fuel 2595, convenience 2124, fast_food 8188, rest_area 53, truck_parking 4) from a streaming 1.3GB-pbf pass, corridor-bbox-bounded.
- **OSM POIs ingested:** 12,964 inserted, byType exactly matching extraction, 0 skippedUnclassified.
- **extract.test.ts:** 11/11 pass.
- **Radius queries live:** poisInRadius {POLB, 30km, [fuel,truck_parking]} → total 163; parkingInRadius {POLB, 200km} → count 14, totalSpotsWithinRadius 280; nearest 3 parking within 500km all resolve with distanceM (spatial index works).
- **tsc --noEmit:** CLEAN except the pre-existing scenario-form.tsx error.

## Decisions Made

See `key-decisions` frontmatter. Headlines: (1) `number_of_spots` is the spots column, CA filtered by `state` (83 sites all with capacity); (2) OSM extraction corridor-bbox-bounded per T-12-07a; (3) fuel-over-convenience precedence + hgv-required truck_parking; (4) only 4 truck_parking POIs is honest sparse OSM hgv-tagging (NATD's 83 measured sites are the primary capacity source); (5) minimal plan-sanctioned schema change (parkingKey/osmKey + indexes) for idempotent upsert; (6) usefulnessScore parking=7, pois=6 (rubric on actual bytes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] schema.ts index additions for idempotent upsert**
- **Found during:** Task 3/4 (writing the upsert-by-key mutations)
- **Issue:** The plan's Task-3/Task-4 `<action>` blocks call for `by_parkingKey` and `by_osmId` indexes, but schema.ts is not in the declared files_modified. Without the fields+indexes the fully-selective idempotent upsert (`withIndex(...).unique()`) cannot run.
- **Fix:** Added `parkingKey` (parking) + `osmKey` (pois) as OPTIONAL fields plus `by_parkingKey` / `by_osmKey` indexes. Optional fields are additive — no existing row breaks. Used `osmKey = "<elementType>/<osmId>"` (string) rather than a bare numeric `by_osmId` so node and way ids in the same numeric space cannot collide.
- **Files modified:** apps/web/convex/schema.ts
- **Verification:** codegen + tsc clean; ingest idempotent (parking re-run patched=83).
- **Committed in:** `93219cf` (Task 3 commit)

**2. [Rule 3 - Blocking] pois/parking functions not deployed before action run**
- **Found during:** Task 4 (before first ingest)
- **Issue:** `npx convex codegen` generates bindings but does NOT push functions (same finding as 12-06). The loader's `npx convex run` needs the deployed action.
- **Fix:** Ran `npx convex dev --once` (CONVEX_TMPDIR set) to push before ingesting.
- **Files modified:** none (deployment step)
- **Verification:** parking + pois ingests then ran clean.
- **Committed in:** n/a (no source change)

---

**Total deviations:** 2 (1 missing-critical, 1 blocking) — both necessary and within plan scope.
**Impact on plan:** No scope creep. The schema index add is exactly what the plan's action text asked for; the deploy step is a known Convex codegen≠push gotcha. All five artifacts delivered and live-verified.

## Issues Encountered

- **Sparse OSM truck_parking (4 in corridor)** — genuine crowd-sourced reality (hgv-tagging on parking is rare). NOT faked or inflated; NATD's 83 measured parking sites are the primary capacity source, OSM truck_parking is enrichment. Documented honestly.
- **NATD parking is geographically sparse near POLB** — 0 sites within 50km of the port, 14 within 200km (280 spots). This is the real NATD distribution (mostly interstate rest stops), not a query bug — proven by the nearest-3-within-500km query resolving with distances.

## User Setup Required

None — both sources are LOCAL files (NATD geojson + california-latest.osm.pbf). pyosmium was already installed in the ingest venv. No API keys.

## Next Phase Readiness

- parking carries NATD measured spot-count capacity (P12-12 proxy) + pois carries OSM extracted amenities, both spatial-indexed and queryable within radius by type via poisInRadius / parkingInRadius for the 12-08 report query (P12-15b/c).
- **STATE.md / ROADMAP.md not touched** (orchestrator-owned), as instructed.
- **Git hygiene:** explicit `git add <path>` only; the pre-existing dirty `_generated/api.d.ts`, the 1.3GB pbf (gitignored, verified), and the derived out/*.json byproducts were left uncommitted.

## Self-Check: PASSED

- `git log --grep="12-07"` returns 5 commits (b21862b, 52fe93d, 93219cf, 7f12b7e, 69538fb).
- Plan `<verification>`: natd_parking.json (83 CA, numberOfSpots) ✓; osm_pois.json (corridor-bbox, per-type counts, streaming) ✓; extract.test.ts 11/11 ✓; parking+pois ingested idempotently + spatial-indexed with NATD/OSM provenance (pois method:"extracted" + osm tag in inputs[]) ✓; poisInRadius/parkingInRadius return the report shapes incl totalSpotsWithinRadius ✓; tsc clean-except-preexisting ✓.

---
*Phase: 12-convex-data-spatial-layer*
*Completed: 2026-07-07*
