# Convex — FleetVolt Freight Pulse (`/pulse`)

Real-time data layer for the Freight Pulse visualization surface (Phase 7+). Separate,
parallel stack from the v1 simulation backend (Docker/PostGIS/Valhalla/FastAPI) — Convex
serves only the `/pulse` surface.

## Bootstrap

```
cd apps/web
npx convex dev        # interactive first run: logs in, creates/links the deployment,
                      # writes NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOYMENT into .env.local,
                      # and generates convex/_generated (typed api + dataModel).
```

Keep `npx convex dev` running alongside `pnpm dev` during development so schema/function
changes regenerate `convex/_generated`. For CI / non-interactive codegen use a deploy key:

```
CONVEX_DEPLOY_KEY="<deploy-key>" npx convex codegen
```

Dev deployment: `sensible-oriole-832`.

## Auth model (Phase 7)

**Unauthenticated by design (D-06).** WorkOS auth is deferred to Phase 10. This deployment
uses a plain `ConvexReactClient` + `ConvexProvider` — NOT `ConvexProviderWithAuth`. No Convex
function calls `ctx.auth`.

`userFilters` rows are keyed by an **anonymous localStorage UUID** (`filterKey`), not a user id
(D-07). In Phase 10 the key is rekeyed to the WorkOS subject id when auth lands.

## Schema (`schema.ts`)

**16 tables (Phase 12 converged data + spatial layer).** The six Phase-7 `/pulse`
tables are preserved byte-compatibly; Phase 12 added ten converged tables.

Phase-7 (`/pulse`): `ports`, `highwaySegments`, `freightFlows`, `hotspots`,
`marketSizing`, `userFilters`.

Phase-12 POINT tables (geo-anchored, `location:{lat,lng}` — back the 12-02
geospatial `nearest()` + haversine fallback): `chargers`, `carriers`, `parking`,
`pois`.

Phase-12 LINE / reference / rollup tables (line data keeps `bbox` +
simplify-js `path`, Convex ~1MB doc guard): `corridors`, `nhfnSegments`,
`elevationProfiles`, `truckConfigs`, `simulations`, `geoRegions`.

### Phase 12 convergence (P12-01)

The two FleetVolt data models were **converged into this ONE Convex schema**
(additively — no Phase-7 table shape changed). The PostGIS simulator tables
(`chargers`, `elevation_profiles`, `nhfn_network`, `simulation_runs`,
`truck_configs`) and the aspirational Supabase field shapes
(`is_mcs_capable`/`isClass8Capable`, `corridors.path`+`distance_miles`,
`simulations.inputs_hash`) were merged in. **Supabase-only constructs
(`organization_id`, `created_by`/`auth.users` FKs, RLS) are DROPPED** —
auth/multi-tenancy is deferred to WorkOS (Phase 7 D-06/D-07, P12-03).

The shared `provenance` validator was extended once to **13 sources** (added
`AFDC`, `OSM`, `Census`, `NATD`) plus two OPTIONAL fields — `method`
(`measured|modeled|geocoded|extracted|estimate`) and `inputs:string[]` — so a
modeled hotspot score can honestly record `method:"modeled"` + its proxy inputs
(P12-12) without weakening the required-field rules.

**`simulations` is metadata-only (RESEARCH §5):** it carries `inputsHash`,
`status`, physics/charger versions, and corridor/truck refs, but has **NO
outputs/results field**. Simulation RESULTS stay single-sourced in Postgres
until the physics engine ports to Convex in **Phase 13**.

Every ingested/data record carries a shared **`provenance`** object
`{ source, fetchedAt, usefulnessScore, matchMethod }` (validator in
`lib/provenance.ts`, DINT-01 / SRC-01, P12-02). `usefulnessScore` is a rubric
OUTPUT computed at ingest (DINT-03, `data-review-gate` skill) — never a
hardcoded catalog assumption. Simulated/estimated values carry
`source: "SIMULATED" | "ESTIMATE"` and must render distinctly from measured data
(SRC-04). `userFilters` is the only provenance-exempt table (view state).

## Files

- `lib/provenance.ts` — shared provenance validator (reused across all data tables); 13 sources + optional method/inputs
- `lib/provenance.test.ts` — provenance-contract unit test (`node --test`)
- `schema.ts` — 16-table converged schema + indexes
- `ports.ts` — `list`, `getByCode` queries (no auth)
- `userFilters.ts` — `get` (by anonymous filterKey), `upsert` (no auth)
- `_generated/` — Convex codegen output (do not edit by hand)

## Production Deployment

The dev deployment is `sensible-oriole-832` (NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOYMENT
in `.env.local`). A **separate** production deployment must be created — the dev URL is
NOT the prod URL.

### Steps

1. **Create the prod deployment:** Run `npx convex deploy` from `apps/web`. This pushes
   schema + functions to a production Convex URL (e.g. `https://fleetvolt-<hash>.convex.cloud`).
   Record the prod URL returned.

2. **Set the prod deploy key:** The `CONVEX_DEPLOY_KEY` env var (from Convex dashboard →
   Settings → Deploy Keys) is needed for CI/CD pushes. Set it in the Vercel dashboard
   (server-side only — not browser-visible).

3. **Set NEXT_PUBLIC_CONVEX_URL (prod):** In the Vercel dashboard, set this to the
   **production** Convex URL from step 1 — NOT the dev `sensible-oriole-832` URL.

4. **Data migration:** Data from the dev deployment is **NOT auto-migrated**. Phase 12 data
   (chargers, corridors, carriers, hotspots, geoRegions, etc.) must be re-ingested or
   exported from dev and imported to prod. Run the ingest scripts against the prod
   deployment after creating it.

> ⚠️ **Manual gate:** `npx convex deploy` and data ingest to prod are human steps.
> The dev deployment holds all current data; verify prod has data before going live.
