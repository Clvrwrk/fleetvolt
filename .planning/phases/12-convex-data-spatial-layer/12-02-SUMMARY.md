# 12-02 Execution Summary — Convex Spatial Layer + PostGIS Parity Gate

**Status: ✅ COMPLETE** (tasks 1-4 by the delegated executor before it crashed on an Anthropic billing error; tasks 5-6 completed directly in-chat).

## Outcome

The PostGIS spatial queries (ST_DWithin / ST_Distance / ST_Extent / ST_MakePoint) are reimplemented on Convex behind ONE swappable internal module (`lib/spatial.ts`): the `@convex-dev/geospatial` component for POINT data, a hand-rolled bbox+haversine fallback for LINE data (and points too), selected by `FV_SPATIAL_BACKEND`. Parity vs live PostGIS proven within 0.1 mi on both backends.

## Tasks

| Task | Result | Commit |
|------|--------|--------|
| 1 · install + register @convex-dev/geospatial | component installed, convex.config.ts | `1170c12` (exec) |
| 2 · pure haversine + bbox fallback + unit tests | 8/8 | `966b799` (exec) |
| 3 · internal spatial module (backend swap) | insert/remove/nearest/rectangle + line ops | `348808f` (exec) |
| 4 · thin Convex queries | nearestChargers/chargersInRegion/segmentsNear | `30889d3` (exec) |
| 5 · **capture live PostGIS fixtures** | 3 probes captured from live stack | `1f3fb9c` (recovery) |
| 6 · **parity gate test** | set-membership + 0.1mi + order, 7/7 both backends | `68f98e7` (recovery) |

## Tests

- provenance 7 + haversine 8 + spatial parity 7 = **22/22 pass**.
- Parity passes on the **default (component) backend AND `FV_SPATIAL_BACKEND=haversine`** — the swap safety net holds.
- tsc clean except pre-existing `scenario-form.tsx`.

## Parity fixture note (expected thinness)

The live PostGIS `chargers` table currently holds only the 6-row docker seed (the live AFDC ingest is **12-04's** job). So the captured fixture is thin — POLB=1 row, San Bernardino=1, Cajon=0 within 5 mi. This is exactly the sequencing the plan intended (line 29): 12-02 proves the spatial MATH parity against whatever PostGIS holds now; **12-04 re-captures the fixture after the live charger ingest and re-runs this same gate on real data.** The gate correctly reproduces the empty set at Cajon (proving it doesn't fabricate hits) and exact membership + distance at the populated probes.

## Recovery notes

The executor committed tasks 1-4 atomically before crashing (`HTTP 400: credit balance too low`, Anthropic). `capture_postgis_fixtures.py` was written but uncommitted; no fixture or parity test existed. Completed directly:
- Ran the capture against the live docker stack (verified reachable, HTTP 200) → real fixture, not fabricated.
- Wrote `spatial.test.ts` asserting set-membership + 0.1mi (161m sphere-vs-spheroid tolerance) + ordering, reconstructing each PostGIS row at its reported geodesic distance and confirming `nearestByHaversine` re-derives it. Skips LOUDLY if the fixture is absent (never vacuous-green).

## Honesty / verification

- Fixtures captured from the LIVE simulator ST_DWithin/ST_Distance endpoint — the script fails loudly (exit 1, no file) if the stack is unreachable or all probes return zero.
- The parity test skips (not passes) without a fixture.
- Component-vs-haversine split enforced: points → `nearestPoints`, lines → `segmentsNearPoint` (bbox+haversine only).
- All commits staged explicitly (no `git add -A`); the concurrent sibling (12-03) owned `schema.ts` this wave — 12-02 never touched it.

## Follow-up for 12-04

- After the live AFDC charger ingest, re-run `scripts/capture_postgis_fixtures.py` to refresh the fixture, then `node --import tsx --test convex/lib/spatial.test.ts` to re-verify parity on real data.
- 12-04's ingest must call `spatial.insertPoint` per station so the component index is maintained.
