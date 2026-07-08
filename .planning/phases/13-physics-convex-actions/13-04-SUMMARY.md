---
phase: 13-physics-convex-actions
plan: 04
subsystem: infrastructure
tags: [celery, redis, retire, docker-compose, convex-action]
---

# Plan 13-04 Summary — Retire Celery/Redis/sim-worker

## Status: COMPLETE

### Changes
- **docker-compose.yml**: removed `sim-worker` (Celery worker) + `redis` services (6→4 services: api, postgres, simulator, web). Removed `CELERY_BROKER_URL` from simulator env. Kept `SIMULATOR_URL` for Fastify proxy routes still in use (meta/stack, trucks, corridors, chargers, routing).
- **services/api/src/simulations.ts**: POST/GET routes return `410 Gone` with `Deprecation: true` header pointing to Convex `physics.simulate` action.
- **services/api/src/app.ts**: simulation routes commented out; type-only `SimulationsDeps` import.
- **ConvexClientProvider**: exported module-scope `convex` client for `api-client` reuse.
- **api-client**: rewired to call Convex simulate action via the shared client.

### Commits
- `8ca03fd` feat(13-04): retire Celery/Redis/sim-worker

### Deviation
Kept `SIMULATOR_URL` in `api` service env — the Fastify proxy routes (meta/stack, trucks, corridors, chargers, routing, validation) still need it. Full simulator retirement is Phase 14 (Vercel deploy + Docker teardown).
