# Phase 12: Convex Data + Spatial Layer - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning
**Source:** v3.0 migration scope + data inventory + flagship-query acceptance test (Chris, 2026-07-07)

<domain>
## Phase Boundary

Phase 12 moves ALL persistent data + spatial query logic onto Convex, and ingests the
verified raw/live data sources so the app can answer the **flagship query** end-to-end.
This is the data foundation; the physics ENGINE port is Phase 13, Vercel deploy is Phase 14.

**North-star acceptance test (THE reason this phase exists):**
The system must be able to answer, from Convex data + spatial queries (physics still calls the
existing engine until Phase 13):
> "For a full truck leaving POLB on the most congested freight route: where is the Class-8
> charger gap, which trucking companies to target, the 5 closest charge ports + config, the
> detour cost of each, and the environmental benefit of EV Class-8."

This was PROVEN answerable via live computation (see `.planning/research/FLAGSHIP-QUERY-VERIFIED.md`).
Phase 12's job is to make every input to that query live in Convex with spatial queries.

**In scope:**
- Convex schema for the persistent/reference data (chargers, corridors, elevation, simulations, trucks, freight flows, carriers, truck-volume segments).
- Reimplement PostGIS spatial queries (`ST_DWithin`/`ST_Distance`/`ST_MakePoint`/`ST_Extent`) as Convex TS (bbox pre-filter + haversine, or the Convex geospatial component — decide in research).
- Ingest the priority data sources from the benefit matrix (freight-out-of-port first).
- Parity tests vs current Postgres output.

**Not in scope (later phases):**
- Physics engine port (Phase 13 — physics keeps calling the Python sim via API this phase).
- Vercel deploy / Docker teardown (Phase 14).
- Auth/multi-tenancy (WorkOS deferred; Convex queries run unauth per Phase 7 D-06/D-07).
</domain>

<decisions>
## Implementation Decisions

### Data model — CONVERGE the two existing schemas
- **P12-01:** Two data models exist and must converge: (a) the **PostGIS simulator tables** (`chargers`, `elevation_profiles`, `nhfn_network`, `simulation_runs`, `truck_configs`, `data_freshness`) and (b) the **Phase-7 Convex `/pulse` schema** (`ports`, `highwaySegments`, `freightFlows`, `hotspots`, `marketSizing`, `userFilters`). Phase 12 unifies them into ONE Convex schema — do not maintain two.
- **P12-02:** Every DATA record keeps the Phase-7 `provenance` validator `{source, fetchedAt, usefulnessScore, matchMethod}` (DINT-01/SRC-01). Extend it, don't drop it.
- **P12-03:** Reference the aspirational Supabase schema (`data/raw/Database Design/FleetVolt_Database_Schema.md`) for field shapes (chargers.is_mcs_capable, corridors.geometry, simulation inputs_hash caching) but drop Supabase-specific constructs (RLS, auth.users FKs, organization multi-tenancy) — those are deferred with auth.

### Spatial queries — no PostGIS on Convex
- **P12-04:** Convex has NO native geo. Reimplement the spatial queries the app uses: nearest-charger (`ST_DWithin`/`ST_Distance`), corridor-region/bbox (`ST_Extent`), point construction. Approach: **bbox pre-filter via indexed min/max lat/lng fields + haversine refine** (the Phase-7 `highwaySegments.bbox` pattern already does this). Research must evaluate the official Convex **geospatial component** vs hand-rolled and pick one with a parity justification.
- **P12-05:** Parity gate — nearest-charger + corridor queries must return the SAME results as the current PostGIS output on captured fixtures (tolerance: identical set membership within the query radius; distance within 0.1 mi).

### Ingestion — freight-out-of-port first (per benefit matrix)
- **P12-06:** Ingest in the matrix priority order: (1) FAF5 metadata + crosswalk lookups, (2) FAF5 2018-2024 actuals filtered to `dms_orig=061` (LA-Long Beach port zone) + mode/commodity, (3) POLB carrier registry (3,151 rows — geocode addresses to lat/lon), (4) CalTrans Truck AADT by axle (5-axle=Class-8) as highwaySegments, (5) chargers LIVE from AFDC/developer.nlr.gov, (6) NATD truck-stop parking + alt-fuel corridors, (7) FAF state summaries.
- **P12-07:** Chargers are LIVE-fetched from AFDC (developer.nlr.gov + NLR_API_KEY), NOT from the raw `nrel/chargers_sample.csv` (that's a 6-row fixture). Filter/tag: `max(power_kw)>=350 AND maximum_vehicle_class in (MD,HD)` → `is_class8_capable`. Store full connector detail + provenance `{source:AFDC, fetchedAt, date_last_confirmed}`.
- **P12-08:** Update the DEAD `developer.nrel.gov` references (Phase-1 charger ingest code) to `developer.nlr.gov` (NREL retired the old domain 2026-05-29).
- **P12-09:** Carrier registry needs a GEOCODE step (addresses → lat/lon). Use Google Geocoding (key already provisioned) or a batch geocoder; store lat/lon + corridor-city tag for the outreach-targeting map layer.

### Flagship-query capabilities the schema must support
- **P12-10:** The schema + queries must support each flagship sub-answer: (a) rank corridors by truck congestion (CalTrans 5-axle AADT joined to segments) — the "most congested route" that is currently hardcoded; (b) nearest-N chargers to a route with Class-8 filter → the "gap" + "5 closest + config"; (c) carrier density by corridor city → "companies to target"; (d) charger detour distance (route dest→charger, via the routing layer) → "detour cost"; (e) freight tonnage/value by OD (FAF zone 061 outbound) → volume context; environmental calc stays in the physics/results layer (Phase 13).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The acceptance test + data intelligence
- `.planning/research/FLAGSHIP-QUERY-VERIFIED.md` — the north-star query, computed live, with each sub-answer mapped to its source + gaps
- `.planning/research/DATA-INVENTORY.md` — every raw artifact described
- `.planning/research/BENEFIT-MATRIX.md` — scored sources + priority ingest order
- `.planning/research/DATA-SOURCES-VERIFICATION.md` — live API keys (AFDC/NLR, Census), NREL→NLR domain migration

### Existing data models to converge (P12-01)
- `apps/web/convex/schema.ts` — Phase-7 Convex schema (ports/highwaySegments/freightFlows/hotspots/marketSizing/userFilters + provenance)
- `apps/web/convex/lib/provenance.ts` — the shared provenance validator (keep)
- `apps/web/convex/ports.ts`, `apps/web/convex/seed/` — existing Convex query + seed patterns to mirror
- `data/raw/Database Design/FleetVolt_Database_Schema.md` — aspirational field shapes (drop RLS/multi-tenancy)
- PostGIS tables (live in docker `postgres`): chargers, elevation_profiles, nhfn_network, simulation_runs, truck_configs, data_freshness

### Raw data (priority ingest)
- `data/raw/FAF/FAF5.7.1_2018-2024/FAF5.7.1_2018-2024.csv` (+ `FAF5_metadata.xlsx`, `CFS-area-code-FAF5-zone-id.xlsx`) — freight OD flows, zone 061=port
- `data/raw/POLB/POLB-Status-Update-07-01-26.xlsx` — 3,151 drayage carriers (geocode)
- `data/raw/CalTrans/Truck_Volumes_AADT.geojson` + `Truck__Average_Daily_Traffic.csv` — 5-axle truck AADT segments
- `data/raw/NATD/NTAD_Truck_Stop_Parking_*.geojson`, `NTAD_Alternative_Fuel_Corridors_*.csv`
- Chargers: LIVE from `https://developer.nlr.gov/api/alt-fuel-stations/v1.json` (NLR_API_KEY)
</canonical_refs>

<specifics>
## Specific Ideas
- The "most congested route" was hardcoded in the flagship computation — Phase 12 must make it a real query: join CalTrans 5-axle AADT to route segments and rank. This is flagship gap #1.
- Charger detour with 0 in-corridor HD chargers should surface the GAP as a siting opportunity (feeds the solar-charger-rec feature) rather than routing to a useless LD charger.
- Keep FAF tonnage in explicit units (the Phase-7 schema already comments "FAF annual tonnage (explicit unit)" — never conflate FAF vs PeMS).
</specifics>

<deferred>
## Deferred Ideas
- Physics engine → Convex actions (Phase 13). This phase, physics still calls the existing Python sim via API.
- Auth/multi-tenancy/RLS/organizations (deferred with WorkOS).
- Vercel deploy + Docker teardown (Phase 14).
- Live PeMS/511 real-time congestion (stretch; SoCal 511 not available, N. CA only).
- Reclaiming the ~13 GB redundant raw data (housekeeping, not a phase task).
</deferred>

---

*Phase: 12-convex-data-spatial-layer*
*Context gathered: 2026-07-07 — flagship query as north-star acceptance test*
