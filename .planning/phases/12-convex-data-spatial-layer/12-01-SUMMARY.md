---
phase: 12-convex-data-spatial-layer
plan: 01
subsystem: convex-schema
tags: [convex-schema, provenance, schema-convergence, postgis-to-convex, supabase-shapes, spatial-scaffold]

requires:
  - phase: (Phase 7) CVX-SCHEMA
    provides: 6-table /pulse Convex schema (ports/highwaySegments/freightFlows/hotspots/marketSizing/userFilters), shared provenance validator, sensible-oriole-832 dev deployment
provides:
  - Converged 16-table apps/web/convex/schema.ts (6 Phase-7 preserved + 10 Phase-12 added)
  - provenance validator extended to 13 sources + optional method/inputs (P12-12 modeled-honesty scaffolding)
  - provenance.test.ts (node:test) enforcing the extended contract
  - POINT tables (chargers/carriers/parking/pois) with location{lat,lng} for the 12-02 spatial layer
  - LINE/ref/rollup tables (corridors/nhfnSegments/elevationProfiles/truckConfigs/simulations[metadata-only]/geoRegions)
  - convex/README.md documenting the converged inventory + simulations-metadata split
affects: [12-02 spatial queries, 12-03..12-08 ingest plans, 13 physics port]

tech-stack:
  added: []
  patterns: [additive-schema-convergence, shared-provenance-embed, point-location-object, line-bbox-plus-simplify-path, metadata-only-simulation-split]

key-files:
  created:
    - apps/web/convex/lib/provenance.test.ts
  modified:
    - apps/web/convex/lib/provenance.ts
    - apps/web/convex/schema.ts
    - apps/web/convex/README.md
  unchanged (deliberately):
    - apps/web/convex/ports.ts + userFilters.ts (Phase-7 query surface — 6 tables byte-preserved)

key-decisions:
  - "Additive-only convergence: the six Phase-7 tables + indexes are byte-preserved (only the header comment was rewritten). Convex's push validation accepted the change as non-breaking, so /pulse keeps running."
  - "Supabase field NAMES borrowed (isClass8Capable/isMcsCapable, corridors path+distanceMiles, simulations inputsHash) but org/auth/RLS DROPPED (P12-03) — WorkOS multi-tenancy stays deferred."
  - "provenance extended in ONE place to 13 sources (+AFDC/OSM/Census/NATD) + OPTIONAL method (measured|modeled|geocoded|extracted|estimate) + inputs[]; required-field rules (source-in-set, finite fetchedAt, 0..10 usefulnessScore, non-empty matchMethod, numeric year) unchanged."
  - "simulations is METADATA ONLY (RESEARCH §5) — no outputs/results field; a comment records that results + the physics engine land in Phase 13."
  - "POINT tables carry location{lat,lng} (for 12-02 nearest() + haversine); LINE tables keep the Phase-7 bbox + simplify-js path pattern (Convex ~1MB doc guard)."

patterns-established:
  - "tsx -e cannot statically resolve named .ts exports; write a temp .mts module + `node --import tsx file.mts` and delete it after (used for the provenance import-check + schema.tables count)."
  - "schema default export nests under `.default.tables` when imported via tsx — reach it as `(s.default ?? s).tables`."
---

# Phase 12 Plan 01 — Converge PostGIS + Supabase shapes into ONE Convex schema — Summary

**Requirements addressed:** CVX-SCHEMA-01, SPATIAL-00. Decisions P12-01, P12-02, P12-03 (+ P12-12 scaffolding).

## What was built

The two FleetVolt data models were converged into ONE `apps/web/convex/schema.ts` — additively.
The six Phase-7 `/pulse` tables and their indexes are preserved byte-compatibly; ten Phase-12
tables (converged from the PostGIS simulator tables + the aspirational Supabase field shapes) were
added, each embedding the shared `provenance` validator. This is schema-only work — no data ingest,
no spatial query implementation. All 5 plan tasks executed in order; one atomic `(12-01)` commit per task.

1. **provenance validator extended** (`66f585c`) — `PROVENANCE_SOURCES` 9→13 (+AFDC/OSM/Census/NATD);
   added OPTIONAL `method` (measured|modeled|geocoded|extracted|estimate) + `inputs:string[]` for the
   P12-12 modeled-score honesty; `assertProvenance` validates the new optionals; required-field rules unchanged.
2. **provenance.test.ts** (`7f3aefa`) — node:test, no Convex server import; covers all 13 sources, the
   modeled method+inputs shape, and the rejection cases (bad source, out-of-range score, empty matchMethod, bad method, non-array inputs).
3. **POINT tables** (`010be73`) — `chargers` (stationId/location/powerKw/isClass8Capable/isMcsCapable + indexes by_stationId, by_class8),
   `carriers` (by_corridorCity, by_city; location optional for later geocode), `parking` (numberOfSpots capacity proxy),
   `pois` (OSM type union, by_type). Each carries `location:{lat,lng}` for the 12-02 spatial layer.
4. **LINE/ref/rollup tables** (`e0028f6`) — `corridors` (bbox+simplify-js path, by_corridorKey), `nhfnSegments` (by_segmentId),
   `elevationProfiles` (by_routeHash), `truckConfigs` (by_name), `simulations` (**metadata-only, NO results field** — by_inputsHash, by_status),
   `geoRegions` (by_level, by_fips, by_parent). Schema now **16 tables**.
5. **Push + README** (`e834d85`) — converged schema **pushed + validated against `sensible-oriole-832`**;
   README grown 6→16 tables with the P12-01 convergence note + simulations-metadata split.

## Verification (real results)

- **Task 1:** `node --import tsx` import-check → `sources 13` / `OK` (AFDC row + OSM row with method:"extracted"+inputs[] both accepted). ✅
- **Task 2:** `node --import tsx --test convex/lib/provenance.test.ts` → `# pass 7 / # fail 0 / # skipped 0`. ✅
- **Task 3:** `npx convex codegen` regenerated `_generated` cleanly; `tsc --noEmit` → `TSC_CLEAN_EXCEPT_PREEXISTING` (exactly 1 error: the documented pre-existing `scenario-form.tsx(45,27) TS2769`). ✅
- **Task 4:** codegen clean; `tsc` → `TSC_CLEAN_EXCEPT_PREEXISTING`; `schema.tables` →
  `carriers,chargers,corridors,elevationProfiles,freightFlows,geoRegions,highwaySegments,hotspots,marketSizing,nhfnSegments,parking,pois,ports,simulations,truckConfigs,userFilters` (**COUNT: 16**). ✅
- **Task 5:** `npx convex dev --once` → `✔ Convex functions ready! (1.07s)` against
  `https://sensible-oriole-832.convex.cloud`; README grep = 8. ✅

**Final table count: 16** (6 Phase-7 preserved + 10 Phase-12 added).
**tsc:** clean except the single pre-existing `scenario-form.tsx` error.
**codegen:** regenerates `_generated` cleanly on every run.

## Live Convex push — SUCCEEDED (not a manual pre-ship step)

`npx convex dev --once` ran non-interactively (auth cached from Phase 7; no `CONVEX_DEPLOY_KEY` needed)
and pushed + validated the converged schema against `sensible-oriole-832`, printing
`✔ Convex functions ready!`. Convex validates schema on push, so a shrinking/removed Phase-7 field would
have been rejected here — it was not. `git diff` of schema.ts confirms the only removed lines are header
comment text; no Phase-7 table field was dropped (additive-only invariant held). The live push is
**done**, not flagged as manual.

## Deviations / notes

- **tsx `-e` eval couldn't statically resolve named `.ts` exports** (`PROVENANCE_SOURCES`/`assertProvenance`)
  and the schema `.tables` prop nests under `.default`. Verified via throwaway `.mts` modules run with
  `node --import tsx`, deleted immediately after — same assertions the plan's inline snippets intended.
- **Working tree had pre-existing unrelated dirt** (phase 1–4 `.planning` docs, docker-compose, orchestrator.py,
  a stale `_generated/api.d.ts` mod, etc.). Every commit staged ONLY this plan's files via explicit
  `git add <path>` — never `git add -A`/`.`. The regenerated `_generated/` was intentionally left unstaged
  (codegen output, do-not-hand-edit; regenerated on demand).
- **`convex/lib/provenance.ts` path:** the shared validator lives under `convex/lib/`, not `apps/web/lib/`.

## Output

Plan 12-01 complete. ONE converged 16-table Convex schema exists and pushes/validates against
`sensible-oriole-832`; provenance enforces 13 sources + optional modeled method/inputs; `simulations`
is metadata-only. This is Wave 0 with no dependencies — the ingest plans (12-03..12-08) and the spatial
query plan (12-02) now have their target tables + indexes.
