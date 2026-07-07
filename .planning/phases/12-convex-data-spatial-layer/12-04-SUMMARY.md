---
phase: 12-convex-data-spatial-layer
plan: 04
subsystem: database
tags: [convex, geospatial, afdc, nlr, chargers, postgis, parity, class8, spatial]

# Dependency graph
requires:
  - phase: 12-01-convex-data-spatial-layer
    provides: chargers table schema (by_stationId, by_class8 indexes)
  - phase: 12-02-convex-data-spatial-layer
    provides: spatial module (nearestChargers, insertPoint, nearestPoints), PostGIS parity harness + capture_postgis_fixtures.py
provides:
  - Live AFDC CA DC-fast charger ingest into Convex (2867 stations, 13 Class-8) via an action + spatial-indexing mutations
  - Class-8 capability classifier (>=350kW AND MD/HD gate) mirrored from the Phase-1 PostGIS logic
  - Charger flagship queries — nearestClass8, fiveClosest(+config), class8Gap(corridor)
  - P12-05 end-to-end parity re-run on live data (geodesic component<->haversine<->PostGIS within 0.1mi) + honest Class-8 corridor gap surfacing
  - P12-08 fix — dead developer.nrel.gov refs repointed to developer.nlr.gov
affects: [12-06-corridor, 12-08-report, flagship-query, solar-charger-rec]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Charger read surface delegates to lib/spatial (backend-agnostic component/haversine); never imports @convex-dev/geospatial directly"
    - "Class-8 filter applied as a doc-level JS predicate on isClass8Capable, NOT an in-index filterEq (the 12-02 index keys on `class8`) — so the gap can never be silently zeroed or inflated"
    - "Live-deployment tests via ConvexHttpClient with a lazy boot promise (tsx transpiles to CJS — no top-level await) and loud-skip when the deployment/ingest is absent"

key-files:
  created:
    - apps/web/convex/chargers/queries.ts
    - apps/web/convex/chargers/ingest.test.ts
    - apps/web/convex/chargers/classify.ts (Task 2)
    - apps/web/convex/chargers/classify.test.ts (Task 2)
    - apps/web/convex/chargers/ingest.ts (Task 3)
    - apps/web/convex/chargers/mutations.ts (Task 3)
    - scripts/chargers_load.mjs (Task 4)
  modified:
    - data/ingest/chargers.py (Task 1)
    - data/ingest/refresh_chargers.py (Task 1)
    - apps/web/convex/fixtures/postgis-nearest.json (Task 5 — regenerated; identical 3-seed content)

key-decisions:
  - "Geodesic parity, not literal stationId-set parity: docker PostGIS holds only 3 synthetic corridor seeds while Convex holds 2867 live AFDC rows — disjoint by construction. The honest live gate is component distanceM ≡ haversine reference (≡ PostGIS ST_Distance via the 12-02 proof) within 0.1mi, plus a genuine empty-set match at Cajon."
  - "Flagship 0-Class-8 gap has CLOSED on live data: the current AFDC feed returns 3 legitimate >=350kW HD stations on POLB→SB (WattEV Pier A 360kW, WattEV San Bernardino 360kW, Greenlane 400kW). Tests assert the honest live reality + non-inflation invariants; they do NOT hard-assert a stale 0."
  - "usefulnessScore=8 (data-review-gate on the AFDC bytes): +2 identity/keys, +1 precise GPS, +1 temporal freshness, +2 measured federal source, +1 full connector detail+provenance, +1 coverage; docked 2 for many null per-connector power_kw + no MCS vehicle-class field beyond maximum_vehicle_class."

patterns-established:
  - "Doc-level JS class8 predicate is authoritative over in-index filter keys — defends the flagship gap honesty (T-12-04b) against a filterKey drift"
  - "Live-data Convex tests loud-skip (throw) rather than vacuous-green when the deployment/ingest is unavailable"

requirements-completed: [INGEST-03, SPATIAL-03, CVX-CHARGER-01]

coverage:
  - id: D1
    description: "P12-08 — dead developer.nrel.gov refs repointed to developer.nlr.gov in data/ingest/ source"
    requirement: "INGEST-03"
    verification:
      - kind: other
        ref: "grep -rn --include=*.py developer.nrel.gov data/ingest/ => NO_DEAD_NREL_REFS_IN_SOURCE"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pure Class-8 classifier (>=350kW AND MD/HD) + connector normalization"
    requirement: "CVX-CHARGER-01"
    verification:
      - kind: unit
        ref: "convex/chargers/classify.test.ts (13/13 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AFDC charger ingest action + batched spatial-indexing mutations; live ingest ran (2867 chargers, 13 Class-8, idempotent)"
    requirement: "INGEST-03"
    verification:
      - kind: integration
        ref: "npx convex run chargers/ingest:run => ingested 2867, class8Capable 13; re-run patched=2867 inserted=0 (commit 65a0cc4/ef28362)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Charger flagship queries: nearestClass8, fiveClosest(+config), class8Gap(corridor gap)"
    requirement: "CVX-CHARGER-01"
    verification:
      - kind: integration
        ref: "convex/chargers/ingest.test.ts#fiveClosest @ POLB / gap honesty / gap finding (live deployment)"
        status: pass
    human_judgment: false
  - id: D5
    description: "P12-05 live-data parity (geodesic component≡haversine≡PostGIS within 0.1mi; Cajon empty-set) + honest Class-8 corridor gap"
    requirement: "SPATIAL-03"
    verification:
      - kind: integration
        ref: "convex/chargers/ingest.test.ts (6/6 pass against sensible-oriole-832)"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-07-07
status: complete
---

# Phase 12-04: Live AFDC Charger Ingest + Flagship Gap Queries + PostGIS Parity Summary

**LIVE AFDC CA DC-fast charger ingest (2867 stations) into Convex with the ≥350kW-AND-MD/HD Class-8 gate, flagship queries (nearestClass8 / fiveClosest / class8Gap), and an end-to-end geodesic parity re-run vs PostGIS — which surfaced that the flagship POLB→SB "0 Class-8" gap has since CLOSED (3 live HD stations)**

## Performance

- **Duration:** ~45 min (Task 5 + SUMMARY; Tasks 1–4 by a prior executor)
- **Completed:** 2026-07-07T23:26Z
- **Tasks:** 5 (Tasks 1–4 pre-committed; Task 5 + SUMMARY this session)
- **Files modified/created (Task 5):** 3

## Accomplishments

- **Task 1 (P12-08):** Dead `developer.nrel.gov` refs repointed to `developer.nlr.gov` (v1.json endpoint, `NLR_API_KEY`, `SOURCE_LABEL="AFDC"`); grep confirms zero dead refs in `data/ingest/` source. — `2898af1`
- **Task 2 (P12-07):** Pure Class-8 classifier — `isClass8Capable(maxPowerKw>=350 AND maxVehicleClass in MD/HD)`, `stationMaxPowerKw`, `normalizeConnectors`, `isMcsCapable`; `classify.test.ts` 13/13 green incl. LD-at-75kW→false and power/class boundary cases. — `e7389a8`
- **Task 3 (P12-07):** `ingest.ts` action (fetch AFDC CA dc_fast, classify, chunk) + `mutations.ts` `upsertChargerBatch` (idempotent by stationId + `spatial.insertPoint` per row, `provenance{source:"AFDC", method:"measured", usefulnessScore:8}`). — `65a0cc4`
- **Task 4:** `scripts/chargers_load.mjs` driver + `BATCH_SIZE 500→50` (geospatial re-index read-limit fix). **Live ingest ran** against `sensible-oriole-832`: **2867 chargers ingested, 13 Class-8-capable, idempotent** (re-run patched=2867, inserted=0). — `ef28362`
- **Task 5 (P12-05 / P12-10b):** `queries.ts` (nearestClass8, fiveClosest+config, class8Gap) + `ingest.test.ts` live-deployment parity/gap suite; regenerated PostGIS fixture. — `2082b3d`

## Task Commits

1. **Task 1: repoint dead NREL refs** — `2898af1` (fix)
2. **Task 2: Class-8 classifier + connector normalization** — `e7389a8` (feat)
3. **Task 3: AFDC ingest action + spatial-indexing mutations** — `65a0cc4` (feat)
4. **Task 4: charger loader + BATCH_SIZE fix** — `ef28362` (feat)
5. **Task 5: flagship queries + live parity/gap tests** — `2082b3d` (feat)

## Files Created/Modified

- `apps/web/convex/chargers/queries.ts` — nearestClass8 / fiveClosest / class8Gap; class8 filter as a doc-level JS predicate (defends gap honesty)
- `apps/web/convex/chargers/ingest.test.ts` — live-deployment parity (POLB geodesic + Cajon empty-set) + Class-8 gap honesty/finding + fiveClosest config integrity; loud-skips when deployment/ingest absent
- `apps/web/convex/fixtures/postgis-nearest.json` — regenerated from live docker PostGIS (identical 3-seed content: 900001/900003; Cajon empty)

## Key Verification Results

- **Parity gate — PASS.** POLB: live component `distanceM` matches the great-circle reference within 0.1mi (161m) across all ≥5 in-window stations; `lib/spatial.test.ts` (12-02) proved that same reference ≡ PostGIS `ST_Distance` within 0.1mi, so component ≡ PostGIS transitively on live coords. Cajon: **both engines return 0 rows within 5mi** (genuine empty-set membership parity). Literal stationId-set parity is not applicable — docker PostGIS holds 3 synthetic seeds vs Convex's 2867 live rows (disjoint by construction).
- **class8Gap on POLB→SB — `class8WithinCorridor === 3` (NOT 0).** Live AFDC now has 3 real Class-8 chargers on the corridor: WattEV Port of Long Beach Pier A (360kW, HD, 2570m), WattEV San Bernardino (360kW, 3666m), Greenlane Charging Center (400kW, 4511m). The 2026-07-07 flagship "0 Class-8" gap has **closed** (WattEV/Greenlane deployed HD charging). This is a real-world change, not an ingest error — each station clears the exact ≥350kW AND MD/HD gate. The suite asserts honest live invariants (count === surfaced list, no LD unit inflated, closest === min distance) and logs the finding; it does not fabricate a stale 0.
- **tsc `--noEmit` — CLEAN** except the pre-existing `scenario-form.tsx(45,27)` error (unrelated to this plan).
- **Tests:** `ingest.test.ts` 6/6 pass (live deployment); `classify.test.ts` 13/13 pass.

## Decisions Made

- **Geodesic parity over literal set parity** (disjoint backends — see Key Verification). The honest, reproducible gate on live data is distance-equivalence + empty-set match, which the plan's "distances within 0.1mi" clause explicitly anchors.
- **Doc-level JS class8 predicate, not in-index filterEq.** During Task 5 the initial `class8Gap` returned a false `0` because `nearestChargers`/the query passed `filterEq:{field:"isClass8Capable"}` while the 12-02 ingest indexes points under filter key `class8` — the in-index eq matched nothing. Fixed to filter on the doc's `isClass8Capable` field (authoritative), which correctly surfaces the 3 live Class-8 stations.
- **Report the closed gap honestly.** Rather than assert a stale `=== 0` (which live data contradicts), the test documents the current count and asserts non-inflation soundness. Flagged for 12-08 (the flagship narrative must reflect that corridor HD charging now exists).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Blocking] class8Gap in-index filter returned a false zero**
- **Found during:** Task 5 (queries.ts wiring)
- **Issue:** `filterEq:{field:"isClass8Capable"}` matched no index entries (12-02 indexes on filter key `class8`), silently zeroing the gap and hiding 3 real Class-8 stations.
- **Fix:** Dropped the broken `filterEq`; rely on the doc-level JS predicate `doc.isClass8Capable === true` in both `nearestClass8` and `class8Gap`.
- **Files modified:** apps/web/convex/chargers/queries.ts
- **Verification:** `class8Gap` now returns 3 (WattEV Pier A / WattEV SB / Greenlane) matching an unfiltered scan of live data.
- **Committed in:** `2082b3d`

**2. [Rule 3 - Blocking] tsx CJS transpile forbids top-level await**
- **Found during:** Task 5 (test first run)
- **Issue:** `node --import tsx` transpiles to CJS; the top-level `await client.query(...)` boot failed with "Top-level await is currently not supported".
- **Fix:** Moved the live fetch into a lazy `boot()` promise awaited inside each `liveTest` body.
- **Files modified:** apps/web/convex/chargers/ingest.test.ts
- **Verification:** 6/6 tests pass.
- **Committed in:** `2082b3d`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes essential for correctness (the first is a genuine gap-honesty bug that would have under-reported Class-8 coverage; the second is a runner-compat fix). No scope creep — changes stayed within `queries.ts` + `ingest.test.ts`.

## Issues Encountered

- **Disjoint parity backends.** PostGIS was never loaded with the full live AFDC set (its Phase-1 loader is CSV+≥350kW-filtered; it holds 3 synthetic seeds), so literal live stationId-set parity vs Convex is structurally impossible. Resolved by asserting geodesic distance-equivalence (component≡haversine≡PostGIS via the 12-02 proof) + the genuine Cajon empty-set match — both honest and reproducible.
- **Flagship gap closed.** The most consequential finding: live AFDC now shows Class-8 charging on POLB→SB. Surfaced honestly in tests + this SUMMARY for 12-08 to reconcile.

## User Setup Required

None — `NLR_API_KEY` already set in the Convex deployment env (verified; value never logged). No key appears in any committed file or fixture.

## Next Phase Readiness

- Flagship charger sub-answers are queryable (nearestClass8, fiveClosest+config, class8Gap) for 12-08 consumption.
- **Blocker/flag for 12-08 + flagship narrative:** `FLAGSHIP-QUERY-VERIFIED.md` (2026-07-07) records 0 Class-8 on the corridor; live data now shows 3. The report/visualization must reflect the current reality (corridor HD charging exists — WattEV/Greenlane) rather than the stale zero-gap headline. Recommend re-verifying the flagship doc against live data before it drives UI copy.

## Self-Check: PASSED

- `git log --grep="12-04"` returns 5 commits (2898af1, e7389a8, 65a0cc4, ef28362, 2082b3d).
- Task acceptance re-run: grep (no dead NREL source refs), classify 13/13, ingest.test 6/6, tsc clean except scenario-form.
- Plan `<verification>`: parity within 0.1mi (geodesic) ✓; class8Gap surfaced honestly (=3, not a fabricated 0) ✓; tsc clean-except-preexisting ✓; NLR_API_KEY not leaked ✓.

---
*Phase: 12-convex-data-spatial-layer*
*Completed: 2026-07-07*
