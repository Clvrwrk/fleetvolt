---
milestone: v3.0
milestone_name: Full Platform Migration
created: 2026-07-07
supersedes_decisions:
  - "[v2.0] Freight Pulse uses parallel stack for /pulse only"
  - "[v2.0] Freight Pulse is a new parallel surface, not a rewrite"
  - "[v2.0] Existing sim app stays on Docker/PostGIS/Valhalla untouched"
phase_numbering: continue   # phases 11-14 (7-10 reserved for v2.0 Freight Pulse)
---

# Milestone v3.0 — Full Platform Migration

## Goal

Re-platform the **entire** FleetVolt application onto a single modern stack:
**Google Maps + Google Directions/Routes API + Convex + Vercel**. Retire the
Docker Compose stack (PostGIS, Redis, Valhalla, Fastify API, Python simulator,
Celery worker) completely. One deploy target, one backend platform, no
self-hosted infrastructure.

## Why (supersession note)

v2.0 explicitly scoped Convex/Google Maps as a **parallel stack for `/pulse`
only**, leaving the shipped v1 sim app (Phases 1–4) on Docker/PostGIS/Valhalla
"untouched, not a rewrite." **v3.0 reverses that decision on Chris's direction:**
the whole app moves to the modern stack. Freight Pulse and the physics
simulator converge onto one platform.

## Locked Decisions (from scoping session 2026-07-07)

| # | Decision | Rationale |
|---|----------|-----------|
| M-01 | **Routing: Google Directions/Routes API** replaces Valhalla entirely | Removes a whole self-hosted Docker service; Chris has paid Google console |
| M-02 | **Physics engine: full rewrite** — port 3,454 LOC Python → Convex TypeScript **actions** | True single-platform; verified Convex actions allow 10-min execution (fits batch sim) |
| M-03 | **Convex = full backend** (data + spatial + compute), not just viz | Chris chose full rewrite over "Convex as data layer + external Python service" |
| M-04 | **Hosting: Vercel**; decommission Docker Compose | Web + Convex native to Vercel; no VPS |
| M-05 | Referrer allowlist already configured in Google Cloud Console | Unblocks live-tile visual verification |

## Verified Platform Constraints (Convex docs, 2026-07-07)

- Query/mutation **user code capped at 1 second** → physics sim CANNOT live in a query/mutation.
- **Action execution limit: 10 minutes** → physics sim runs as a Convex **action** (batch compute). ✅ viable.
- Node action argument size: **5 MiB** → route geometry payloads must be chunked if large.
- Code size / deployment: 32 MiB. Function return value: 16 MiB.
- **No native geospatial / PostGIS** → `ST_DWithin`, `ST_Distance`, `ST_MakePoint`,
  `ST_Extent` must be reimplemented in TS (bbox pre-filter + haversine). Consider Convex
  geospatial component if it meets parity.

## Current Backend Surface (verified inventory, must be migrated)

- `services/simulator` (Python, **3,454 LOC**, 36 files): physics_engine, soc_integrator,
  charging_planner, feasibility, orchestrator, route_provider (Valhalla client),
  segment_builder, speed_resolver, elevation_service, port_drayage, kpi_aggregator, +10 route modules.
- `services/api` (Fastify/TS): simulations orchestration, exports (CSV/JSON/PDF), inputs_hash, PG client.
- `apps/web` (Next.js): **8 files** touch Mapbox/react-map-gl; 8 route pages. Convex partially present (ports, userFilters, schema — from Phase 7).
- Infra: docker-compose.yml — 7 services (postgres/PostGIS, redis, valhalla, simulator, sim-worker, api, web).

## Phase Decomposition (4 phases, sequenced by risk & dependency)

### Phase 11 — Google Maps App-Wide + Routing Migration
**Scope:** Replace Mapbox/`react-map-gl` in all 8 web files with Google Maps.
Replace Valhalla routing in `route_provider` with Google Directions/Routes API.
Retire the `valhalla` Docker service.
**Risk:** Medium — bounded (8 files + 1 route adapter), reversible.
**Depends on:** Nothing (do first).
**Verify gate:** Phase-4 `scenario-run` Playwright UAT stays green; route geometry parity spot-check.

### Phase 12 — Convex Data + Spatial Layer
**Scope:** Port PostGIS tables → Convex schema (corridors, chargers, trucks, elevation, simulations).
Reimplement spatial queries (`ST_DWithin`/`ST_Distance` → bbox + haversine, or Convex geo component)
for nearest-charger / corridor-region lookups. Migrate seed/ingest.
**Risk:** Medium-High — spatial parity is the tricky part.
**Depends on:** Phase 11 (routing settled).
**Verify gate:** Charger/corridor query parity tests vs current Postgres output.

### Phase 13 — Physics Engine → Convex Actions (the rewrite)
**Scope:** Port 3,454 LOC Python (physics_engine, soc_integrator, charging_planner, feasibility,
segment_builder, speed_resolver, orchestrator, kpi_aggregator) → Convex TS **actions**.
Retire Celery/sim-worker + Redis. Wire exports (CSV/JSON/PDF) into Convex/Vercel.
**Risk:** ⚠️ HIGHEST — numeric-fidelity rewrite of the core product.
**Depends on:** Phase 12 (physics reads spatial data).
**Verify gate:** **Numeric parity** vs Python on POLB drayage + Cajon Pass validation cases
(energy kWh, SoC curve, charging stops, feasibility tier) within agreed tolerance.

### Phase 14 — Vercel Deploy + Decommission Docker
**Scope:** Deploy web + Convex to Vercel; production env/secrets; wire `fleetvolt.network`;
decommission docker-compose stack; update README/AGENTS/Makefile; final smoke.
**Risk:** Medium.
**Depends on:** Phases 11–13 (nothing left needing Docker).
**Verify gate:** Live Vercel preview loads; all 8 routes work; end-to-end scenario run + export on prod stack.

## Sequencing Rationale

11 first (bounded, reversible). 12 before 13 (physics reads spatial data). 13 isolated
so parity failures surface cleanly, not tangled with infra. 14 last, once nothing depends on Docker.

## Open Questions for Planning (Phase 13)

- **Numeric parity tolerance** for the physics rewrite (exact float match unrealistic — propose ±0.5% on energy/SoC, exact on tier/stop count). Confirm at plan time.
- Convex geospatial component vs hand-rolled haversine — decide in Phase 12 research.
- Elevation data: keep cached profiles as Convex documents vs re-fetch — decide in Phase 12.
