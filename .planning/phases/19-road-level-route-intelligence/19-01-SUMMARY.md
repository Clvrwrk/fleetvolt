---
phase: 19-road-level-route-intelligence
plan: 01
subsystem: routes
status: complete
completed: 2026-07-11
requirements: [ROUTE-INTEL-01, ROUTE-INTEL-02, ROUTE-INTEL-03, ROUTE-INTEL-04, ROUTE-INTEL-05]
---

# Phase 19 Plan 01 Summary

Implemented independently refreshed road-level intelligence snapshots for persisted PTV routes. Each snapshot is keyed by the directional Phase-18 request hash, expires after seven days, uses a single refresh lease, and preserves stale intelligence on refresh failure without touching the 90-day geometry row.

## Delivered

- `routeEnrichments` repository with access/refresh counters, freshness, leases, stale failure retention, and controlled force refresh.
- Dataset-specific Convex queries with separate read/time budgets, coordinated by one enrichment action.
- Road-proximity intelligence for Caltrans 5-axle truck AADT, AFDC chargers and true Class 8 gap, NATD truck parking, OSM amenities, located carriers, and FleetVolt fleet yards.
- Explicit FAF zone-061 annual context with thousand-tons/year and million-USD/year units; never represented as daily segment traffic.
- Provenance/coverage receipts including source, method, radius/scope, source freshness, item counts, truncation state, unavailable reasons, and cache metadata.

## Commits

| Commit | Description |
| --- | --- |
| `9889be9` | Phase 19 context, research, requirements, validation, and plan |
| `1b1fc9f` | Route-intelligence schema, repository, source queries, action, and tests |

## Verification

- Tests: 17 passed, 0 failed.
- Focused ESLint: passed.
- Convex deployment: passed on `sensible-oriole-832`.
- Live controlled refresh: `database-refreshed`, full untruncated category coverage.
- Identical second request: `database-hit`, access count increased to 5 while enrichment refresh count remained 2.
- Geometry regression: `database-hit`, 800 PTV points, original expiry retained, geometry refresh count remained 1.
- Docker production build and health: passed; `fleetvolt-review-web` healthy on port 3000.
- Responsive regression: map settled at 1440x900, 1024x1366, and 390x844 with zero horizontal overflow.

## Deviations

- The first aggregation attempt exposed the geospatial component's hidden 32k cell-read amplification. The implementation was strengthened by splitting datasets into independent queries and computing route proximity from bounded source reads.
- A combined exact-distance query then hit Convex's one-second query limit. The final design uses a coordinating action plus per-source queries and a 128-point deterministic road simplification for point assets. Highway matching remains a bbox prefilter plus road-distance refine.

## Self-Check

PASSED. All five requirements have live evidence and no geometry/source semantic boundary was weakened.
