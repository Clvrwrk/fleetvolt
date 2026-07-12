# Phase 19: Road-Level Route Intelligence — Context

**Gathered:** 2026-07-11
**Status:** Ready for execution

<domain>
## Phase Boundary

Attach auditable, independently refreshed intelligence to a Phase-18 persisted PTV road route. This phase builds the backend route-intelligence asset and receipt. Dropdown catalog UI belongs to Phase 20; overlapping-road selection belongs to Phase 21; workspace layout belongs to Phase 22.
</domain>

<decisions>
## Locked Decisions

### Route truth
- The persisted PTV polyline is the only spatial spine. Endpoint chords and bbox-only membership are forbidden.
- Direction remains part of identity through the Phase-18 request hash.
- Enrichment failure never invalidates or rewrites usable route geometry.

### Freshness and caching
- Enrichment lifetime is seven days, independent of the 90-day PTV geometry lifetime.
- At expiry, serve stale enrichment while one caller owns a two-minute refresh lease.
- Failed refresh preserves the last usable snapshot and records a bounded error.

### Dataset semantics
- Caltrans `truckAADT` is the daily 5-axle truck proxy. Missing values stay unknown, not zero.
- FAF is annual, zone-level context with explicit ktons and million-USD units. It is never described as measured traffic on an individual road segment.
- AFDC charger classification continues to require at least 350 kW and MD/HD support for Class 8.
- NATD parking, OSM POIs, geocoded carriers, and FleetVolt fleet yards are matched by proximity to sampled points on the actual route.

### Provenance and coverage
- Every category returns source, method, scope/radius, fetched or computed time, item count, and coverage state.
- Empty source tables or unmatched geography return `unavailable` with reasons; they do not fabricate counts.
- Convex remains the system of record. No Supabase dual-write.
</decisions>

<canonical_refs>
## Canonical References

- `apps/web/convex/routes/cache.ts` — Phase-18 route repository.
- `apps/web/convex/lib/spatial.ts` — shared point/line spatial boundary.
- `apps/web/convex/highways/queries.ts` — Caltrans 5-axle AADT semantics.
- `apps/web/convex/chargers/queries.ts` — honest Class 8 corridor gap behavior.
- `apps/web/convex/pois/queries.ts` — NATD parking and OSM POI payloads.
- `apps/web/convex/carriers/queries.ts` — located-carrier payload.
- `apps/web/convex/faf/queries.ts` — explicit FAF scope and units.
</canonical_refs>

<deferred>
## Deferred

- Route promotion and Recents selectors: Phase 20.
- Road-to-route membership chooser: Phase 21.
- Right-mounted responsive CaaS workspace: Phase 22.
</deferred>
