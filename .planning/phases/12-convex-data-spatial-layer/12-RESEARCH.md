# Phase 12 Research — Convex Data + Spatial Layer

**Researched:** 2026-07-07 · Focus: the spatial-query decision (P12-04) + ingest feasibility.

## 1. Spatial layer: Convex Geospatial component vs hand-rolled — RECOMMENDATION

**Official component: `@convex-dev/geospatial` (Beta)** — https://www.convex.dev/components/geospatial

**Fit assessment (matches our exact needs):**
- `nearest(ctx, {point, limit, maxDistance, filter})` → **directly implements the flagship "5 closest chargers within radius" + Class-8 filter** (`filter: q => q.eq("class8", true)`). This is the `ST_DWithin`/`ST_Distance` replacement.
- `query(ctx, {shape:{type:"rectangle", rectangle}, filter})` → the `ST_Extent`/bbox corridor-region query.
- Filters (`eq`, `in`, `gte`, `lt`) applied through the index BEFORE loading docs → efficient, and lets us filter chargers by `class8_capable`/`power_kw` in the same call.
- Server-side, consistent, reactive, cached. Tested to ~1M points (we have ~2,864 CA DC-fast chargers, ~6,865 CalTrans segments — well within).

**The catch: it's Beta.** For P12-05's parity gate against PostGIS, Beta risk matters.

**RECOMMENDATION (planner to confirm):** Use the component for the **point** datasets
(chargers, truck-stop parking, geocoded carriers, ports) where `nearest()` is the exact fit.
Keep the Phase-7 **hand-rolled bbox + haversine** pattern (already in `highwaySegments.bbox`)
for **line/segment** data (highwaySegments, corridors) where "nearest point on a polyline" isn't
what the component does. This is a clean split: component=points, bbox+haversine=lines. Both
are validated against captured PostGIS output (P12-05).

**Fallback if Beta bites:** the hand-rolled bbox+haversine approach ALSO covers points (indexed
minLat/maxLat/minLng/maxLng + haversine refine) — so the component is an optimization, not a
dependency. Plan should make the spatial API an internal module so the impl can swap without
touching callers.

## 2. Ingest feasibility (verified against real files)

- **FAF5 2018-2024 actuals** (695 MB CSV, 2.6M rows): filter to `dms_orig=061` client-side during a Node ingest action (Convex action 10-min budget is ample), write aggregated OD rows. Proven extractable (zone 061 → $1.3T, 395M truck-ktons). Keep tonnage in explicit units.
- **POLB carriers** (3,151 rows xlsx): parse + **geocode** addresses (Google Geocoding key provisioned). Batch ~3k geocodes; cache lat/lon. Store corridor-city tag.
- **CalTrans Truck AADT** (6,865 segments, geojson): map to `highwaySegments` with `truckAADT` (5-axle = Class-8 proxy — keep DISTINCT from total aadt per Phase-7 PITFALLS #7). This powers the "most congested route" ranking (flagship gap #1).
- **Chargers**: LIVE from `developer.nlr.gov` (NLR_API_KEY). ~2,864 CA DC-fast. Tag `is_class8_capable = max(power_kw)>=350 AND maximum_vehicle_class in (MD,HD)`. Store connectors + provenance. Confirmed: ZERO class8-capable on POLB→SB corridor (the gap).
- **NATD truck-stop parking / alt-fuel corridors**: geojson/csv → point + line layers for charging-siting + hotspot enrichment.

## 3. Convex platform constraints (from Phase-11 research, still apply)
- Doc ~1 MB guard → thin polylines with simplify-js (Phase-7 already does this for highwaySegments).
- Query/mutation user code 1s cap → heavy ingest runs in **actions** (10-min), writing via mutations in batches.
- Action arg 5 MiB → chunk large ingests.

## 4. Migration approach
- Converge the Phase-7 `/pulse` schema + PostGIS tables into ONE `apps/web/convex/schema.ts`. Add: `chargers`, `carriers`, `corridors`, `elevationProfiles`, `truckConfigs`, `simulations` (metadata; physics still external until Phase 13). Extend existing `ports`/`highwaySegments`/`freightFlows`.
- Keep the shared `provenance` validator on all data tables.
- Parity fixtures: capture current PostGIS `chargers` nearest-query output for POLB/Cajon corridors → assert Convex spatial returns identical set within 0.1 mi.

## 5. Open items for the planner
- Confirm component-vs-handrolled split (§1) or go all hand-rolled if Beta is unacceptable for the parity gate.
- Geocoding provider + rate-limit handling for 3,151 carriers.
- Whether `simulations`/`simulation_results` fully move now or stay in Postgres until Phase 13 (physics still writes there). Recommend: metadata table in Convex now, results follow the engine in Phase 13.
