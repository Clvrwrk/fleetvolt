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

Six tables: `ports`, `highwaySegments`, `freightFlows`, `hotspots`, `marketSizing`, `userFilters`.

Every ingested/data record carries a shared **`provenance`** object
`{ source, fetchedAt, usefulnessScore, matchMethod }` (validator in `lib/provenance.ts`,
DINT-01 / SRC-01). `usefulnessScore` is a rubric OUTPUT computed at ingest (DINT-03,
`data-review-gate` skill) — never a hardcoded catalog assumption. Simulated/estimated values
carry `source: "SIMULATED" | "ESTIMATE"` and must render distinctly from measured data (SRC-04).

## Files

- `lib/provenance.ts` — shared provenance validator (reused across all data tables)
- `schema.ts` — 6-table schema + indexes
- `ports.ts` — `list`, `getByCode` queries (no auth)
- `userFilters.ts` — `get` (by anonymous filterKey), `upsert` (no auth)
- `_generated/` — Convex codegen output (do not edit by hand)
