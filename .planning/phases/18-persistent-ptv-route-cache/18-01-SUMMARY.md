---
phase: 18-persistent-ptv-route-cache
plan: 01
status: complete
completed: 2026-07-11
requirements: [ROUTE-CACHE-01, ROUTE-CACHE-02, ROUTE-CACHE-03, ROUTE-CACHE-04, ROUTE-CACHE-05]
---

# Phase 18 Plan 01 Summary

Implemented a persistent Convex repository for successful PTV road geometry. Directional canonical requests reuse geometry for 90 days, then serve stale while one caller owns a two-minute refresh lease. Refresh failures retain stale geometry and record the error; missing or failed routes never fabricate endpoint-only lines.

## Delivered

- `routeGeometries` schema with request inputs, geometry, provider metadata, freshness timestamps, leases, errors, access counters, and refresh counters.
- Internal claim, complete, fail, and read functions providing the route repository boundary.
- PTV action integration that checks Convex before PTV, persists only usable PTV geometry, and leaves Google fallback outside the 90-day PTV cache.
- Observable metadata: cache status, freshness, pulled/expiry timestamps, age, access count, refresh count, and request hash.
- Pure policy tests for 90-day boundaries, stale leases, directional identity, route validity, and age receipts.

## Verification

- Route policy and adapter tests: 9 passed, 0 failed.
- Focused ESLint: passed.
- Convex function deployment: passed against `sensible-oriole-832`.
- Live identical route request 1: `database-miss-write`, 800 returned road points, `refreshCount: 1`.
- Live identical route request 2: `database-hit`, `accessCount: 2`, `refreshCount: 1`; no second PTV refresh.
- Docker production build: passed; `fleetvolt-review-web` rebuilt and running at `http://localhost:3000/caas`.
- Responsive review: passed at 1440x900, 1024x1366, and 390x844 after map load, with zero document-level horizontal overflow. Evidence is in `verification/`.

## Decisions Preserved

- A→B and B→A remain distinct route identities.
- The database caches every successful planned route; future catalog phases decide which routes are promoted or shown in Recents.
- Convex remains the system of record; no Supabase dual-write was introduced.

## Next

Phase 19 should attach independently refreshed truck traffic, freight, charger, Class 8 gap, parking, amenity, carrier, and fleet-yard intelligence to the persisted road geometry.
