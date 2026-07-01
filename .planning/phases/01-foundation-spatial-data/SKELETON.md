# Walking Skeleton — FleetVolt Route

**Phase:** 1
**Generated:** 2026-07-01

## Capability Proven End-to-End

A developer runs `docker compose up`, applies Alembic migrations, and sees live stack health from the Next.js stub through Fastify → FastAPI → PostGIS — proving the hybrid Node/Python monorepo and six-service Compose stack before any spatial ingest.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo | pnpm 11.9.0 + Turborepo 2.10.2 | D-01; unified CI task graph across Node and Python packages |
| Web framework | Next.js 16.2.9 App Router (standalone Docker output) | STACK.md; desktop-first analyst UI path in Phase 4 |
| API orchestration | Fastify 5.9.0 on Node 24 LTS | Thin job submit/poll layer; avoids NestJS ceremony per STACK.md |
| Simulation service | Python 3.12 + FastAPI 0.138.2 | Required for NumPy physics in Phase 2; OpenAPI source of truth (D-02) |
| Database | PostgreSQL 16 + PostGIS 3.5 (`postgis/postgis:16-3.5`) | Spatial truth for NHFN, chargers, elevation, trucks (D-03) |
| Migrations | Alembic in `services/simulator` with GeoAlchemy2 helpers | D-03; PostGIS extension bootstrap before spatial tables |
| Type contracts | OpenAPI codegen → `packages/shared-types` via openapi-typescript | D-02; FastAPI/Pydantic is canonical schema |
| Job queue placeholder | Redis 8.x (broker DB 0, cache DB 1) | Celery wiring deferred to Phase 3; container present day 1 |
| Routing engine | Valhalla self-hosted (SoCal regional extract) | D-14; truck costing profile for Class 8 corridors |
| Deployment target | Docker Compose on VPS + Caddy reverse proxy | D-15; CleverWork pattern; bind `0.0.0.0:$PORT` |
| Directory layout | `apps/web`, `services/api`, `services/simulator`, `packages/shared-types`, `data/ingest/` | D-01; matches Technical Architecture §2 |

## Stack Touched in Phase 1

- [x] Project scaffold (pnpm workspace, turbo.json, ESLint/Prettier, Ruff)
- [x] Routing — Next.js `/` health page, Fastify `/health`, FastAPI `/health` + `/v1/meta/stack`
- [x] Database — Alembic migrations create all spatial tables; FastAPI reads `SELECT 1` + table counts
- [x] UI — Next.js page fetches Fastify proxy → simulator stack status (interactive proof of wiring)
- [x] Deployment — `docker compose up` documented local full-stack run command

## Out of Scope (Deferred to Later Slices)

- Physics simulation engine and segment energy model (Phase 2)
- Charging stop recommendation and feasibility tiers (Phase 3)
- Analyst map dashboard, SoC charts, PDF export (Phase 4)
- User authentication and multi-tenancy
- Celery worker processes (Redis container only in Phase 1)
- Mapbox GL integration (Phase 4)
- National NHFN/charger ingest, US West Valhalla graph, USGS 3DEP elevation
- Real-time OCPI charger status

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2:** Physics simulation core — segment energy, Valhalla truck routes, POLB/Cajon validation
- **Phase 3:** Charging intelligence + Fastify→FastAPI/Celery job pipeline
- **Phase 4:** Analyst dashboard with map, charts, scenario comparison, exports
- **Phase 5:** NHFN corridor preference, gap analysis, WTW emissions core
- **Phase 6:** Rolling TCO chart + production VPS deployment
