# Phase 19 Technical Research

## Existing primitives to reuse

- `routeGeometries` already stores the authoritative PTV path and request hash.
- `nearestPoints` supports chargers, carriers, parking, POIs, and ports through the shared geospatial component with a haversine fallback.
- `segmentsInBbox` and `distanceToPolylineM` support line data without pretending the point-only index can solve line membership.
- `class8WithinRadius` is the defensive single source of truth for true Class 8 chargers.
- `freightOD` is indexed by origin/year and already exposes explicit FAF units and provenance.
- `fleetParkingLots` is small and carries precise locations but is not in the shared geospatial point index.

## Selected architecture

1. Add `routeEnrichments`, keyed by Phase-18 `requestHash`, with a seven-day expiry and two-minute refresh lease.
2. Use a pure policy module for freshness, sampling, corridor bbox expansion, and deterministic coverage summaries.
3. Use one coordinating action with independent internal queries per dataset so each source has its own Convex document/time budget.
4. Preserve 16 audit probes and use a 128-point deterministic simplification of the persisted 800-point road path for point-source distance; the 8 km matching radius remains wider than the simplification interval.
5. Fetch Caltrans segments once by expanded route bbox, then refine membership against the road polyline so crossing-but-distant bbox segments are excluded.
6. Persist a bounded snapshot containing complete category counts/summaries plus capped detail rows needed by later route cards and selectors.
7. Expose one action that claims cache, aggregates only for the refresh owner, persists success, and serves stale on failure.

## Freshness policy

| Asset | Lifetime | Failure behavior |
| --- | --- | --- |
| PTV geometry | 90 days (Phase 18) | Preserve stale geometry |
| Route enrichment snapshot | 7 days | Preserve stale snapshot; route remains usable |
| Source ingests | Report their own stored `fetchedAt`/provenance | Coverage says stale/unknown when missing |

## Accuracy fences

- Point assets use a documented 8 km route corridor, sufficient for nearby freight services while preserving distance receipts.
- Highway segments use a tighter 2 km corridor so the AADT summary follows the planned road rather than every road in the viewport.
- FAF context defaults to LA–Long Beach zone `061`, year 2023, and is labeled regional annual context. Later catalog work may select origin zone by port.
- No source match means `coverage: unavailable`; zero is reserved for a measured, queryable empty set such as zero true Class 8 chargers within the searched corridor.

## Risks and mitigations

- **Convex read limits:** bound road probes, per-probe limits, returned detail rows, and highway bbox candidates.
- **Duplicate assets across probes:** deduplicate by stable ID and retain minimum distance.
- **BBox false positives:** exact route-distance refine after bbox fetch.
- **Misleading freight units:** encode scope and units in the snapshot contract and tests.
- **Geometry coupling:** only reference the request hash; never write enrichment fields into `routeGeometries`.

## Validation Architecture

- Pure Node tests cover sampling, bbox construction, AADT statistics, deduplication, availability semantics, and seven-day lease boundaries.
- Convex code generation verifies schema/function contracts.
- A live action run against the Phase-18 request hash proves snapshot creation; the identical second run must be an enrichment database hit.
- A subsequent Phase-18 route call must remain a geometry database hit with its original 90-day expiry.
