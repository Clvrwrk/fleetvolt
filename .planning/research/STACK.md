# Stack Research

**Domain:** Class 8 EV drayage & corridor energy modeling (physics simulation + PostGIS + map viz)
**Researched:** 2026-07-01
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Next.js** | 16.2.9 | Desktop-first web app (SSR, App Router, PWA path) | Current stable on npm (Jun 2026); best fit for map-heavy dashboards, typed API routes, and Docker self-host. Project docs reference v15 — v16 is the direct upgrade with React 19 support. | HIGH |
| **React** | 19.2.7 | UI runtime | Bundled peer of Next.js 16; stable concurrent features for synced map/chart interactions. | HIGH |
| **TypeScript** | 6.0.3 | Shared types across web + API | End-to-end type safety for scenario schemas; Node 24 has stable built-in TS stripping if desired. | HIGH |
| **Node.js** | 24.x LTS ("Krypton") | API orchestration layer | Active LTS through Apr 2028; production-safe on VPS. Avoid Node 26 (Current, not LTS until Oct 2026). | HIGH |
| **Fastify** | 5.9.0 | Node HTTP API / job orchestration | Low overhead, excellent JSON throughput, native async — ideal for simulation submit/poll endpoints without NestJS ceremony. | HIGH |
| **Python** | 3.12.x | Simulation microservice runtime | Required floor for NumPy 2.5+ and SciPy 1.18+; mature wheel support on Linux VPS. Do not use 3.11 (NumPy 2.5 dropped it). | HIGH |
| **FastAPI** | 0.138.2 | Python simulation service API | De facto standard for typed scientific microservices; Pydantic-native contracts, OpenAPI for agent/human devs, async I/O for PostGIS + elevation fetch. | HIGH |
| **Celery** | 5.6.3 | Async simulation workers | Production-proven task queue for CPU-bound physics jobs; integrates cleanly with NumPy/PostGIS worker processes. | HIGH |
| **PostgreSQL** | 16.x | Primary datastore | Stable LTS pairing with PostGIS Docker images; JSONB for simulation I/O; row-level security path for multi-tenant. | HIGH |
| **PostGIS** | 3.5.x | Spatial truth (NHFN, chargers, route buffers) | Industry standard for `ST_DWithin`, corridor overlays, GIST-indexed charger search — core to charging planner. | HIGH |
| **Redis** | 8.x (server) / redis-py 8.0.1 | Celery broker + result cache | Single infra component for job queue and hot cache (inputs_hash → results). Use separate Redis DB indexes for broker vs cache. | HIGH |
| **Valhalla** | latest stable (self-hosted) | Truck-aware routing | Native `costing: "truck"` with height/weight/axle_count/hazmat — critical for Class 8 corridor realism. OSRM lacks equivalent truck costing depth. | HIGH |
| **Mapbox GL JS** | 3.25.0 | Route + SoC gradient map viz | Best performance for multi-layer freight maps (NHFN, route polyline, charger clusters). Worth the token cost for consulting deliverables. | HIGH |
| **Docker Compose** | v2.x | VPS deployment | Matches CleverWork constraint; reproduces PostGIS + Redis + Node + Python + Valhalla locally and in prod. | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **NumPy** | 2.5.0 | Vectorized segment physics | Batch force/power/energy across route segments; core of PhysicsEngine. | HIGH |
| **SciPy** | 1.18.0 | Numeric utilities | Interpolation (elevation), optimization hooks (v1.5+ charging tradeoffs). | HIGH |
| **Pandas** | 2.2.x | Emissions/TCO lookup tables | Phase 2 WTW ton-mile and cost overlays; NREL AFDC ingest normalization. | HIGH |
| **Pydantic** | 2.13.4 | Python request/response models | Simulation input contracts, truck config validation, assumptions hashing. | HIGH |
| **SQLAlchemy** | 2.0.51 | Python ORM / query builder | PostGIS-aware data access from simulation service; Alembic migrations. | HIGH |
| **GeoAlchemy2** | 0.20.0 | PostGIS geometry types in SQLAlchemy | `Geography`/`Geometry` columns for chargers, NHFN, route buffers. | HIGH |
| **psycopg** | 3.3.4 | PostgreSQL driver | Modern successor to psycopg2; use `psycopg[binary,pool]` for worker pools. | HIGH |
| **Alembic** | 1.16.x | DB migrations | Schema versioning for PostGIS tables and simulation_runs. | MEDIUM |
| **Shapely** | 2.1.x | In-memory geometry ops | Route discretization, buffer construction before/after PostGIS queries. | HIGH |
| **GeoPandas** | 1.1.x | NHFN shapefile ingest | One-time/periodic BTS NHFN → PostGIS ETL scripts. | MEDIUM |
| **Zod** | 4.4.3 | Frontend + Node validation | Scenario form schemas; pairs with React Hook Form via `@hookform/resolvers` ≥ 5.4.0. | HIGH |
| **React Hook Form** | 7.80.0 | Scenario config forms | Low re-render form state for multi-field truck/route inputs. | HIGH |
| **Zustand** | 5.0.14 | Client scenario state | Lightweight global state for map/chart/scenario sync; URL-shareable state in Phase 3. | HIGH |
| **Tailwind CSS** | 4.3.2 | Styling | Utility-first; pairs with shadcn/ui for professional analyst UI. | HIGH |
| **shadcn/ui** | latest | Component primitives | Accessible KPI cards, sliders, tables — fast consulting-grade UI. | MEDIUM |
| **Recharts** | 3.9.1 | SoC / energy profile charts | React-native charting with brush/hover sync to map position. | HIGH |
| **react-map-gl** | 8.1.1 | Mapbox React bindings | Typed Mapbox integration in Next.js client components. | HIGH |
| **@turf/turf** | 7.3.5 | Client-side geospatial helpers | Distance along route, bbox, line slicing for map interactions. | HIGH |
| **Puppeteer** | 25.3.0 | PDF export (server-side) | Capture map screenshots + KPI layout for client deliverables; run in Node worker. | MEDIUM |
| **Playwright** | 1.61.1 | E2E testing | Config → run → export critical path validation. | HIGH |
| **pytest** | 8.x | Python unit/integration tests | Physics validation gates, spatial query regression. | HIGH |
| **BullMQ** | 5.79.2 | Node-side background jobs | **Phase 2+ only** — PDF generation, weekly NREL ingest cron. Not for physics simulation queue. | MEDIUM |
| **OR-Tools** | 9.11.x | Future route/stop optimization | Defer to v1.5+ when rule-based charging yields to solver-based tradeoffs. | MEDIUM |

### Development Tools

| Tool | Purpose | Notes | Confidence |
|------|---------|-------|------------|
| **pnpm** | Monorepo package manager | Fast, disk-efficient for `apps/web`, `services/api`, `services/simulator`, `packages/shared`. | HIGH |
| **Turborepo** | Monorepo task orchestration | Parallel lint/test/build across Node + Python CI steps. | MEDIUM |
| **uv** or **pip-tools** | Python dependency locking | Reproducible sim service builds in Docker; pin NumPy/SciPy ABI-sensitive stack. | HIGH |
| **Ruff** | Python lint/format | Fast replacement for flake8+isort; standard in 2026 Python DX. | HIGH |
| **ESLint + Prettier** | TS/JS lint/format | Next.js 16 defaults; enforce Zod schema consistency. | HIGH |
| **Caddy 2.x** | VPS reverse proxy + TLS | Simple auto-HTTPS for Docker Compose on single VPS; bind `0.0.0.0:$PORT` per Render/VPS rules. | HIGH |
| **Sentry** | Error/performance monitoring | Physics edge cases and spatial query failures need production stack traces. | MEDIUM |

## Installation

```bash
# ── Monorepo root ──
pnpm init
pnpm add -D turbo typescript eslint prettier

# ── apps/web (Next.js frontend) ──
pnpm add next@16.2.9 react@19.2.7 react-dom@19.2.7
pnpm add mapbox-gl@3.25.0 react-map-gl@8.1.1 @turf/turf@7.3.5
pnpm add recharts@3.9.1 zustand@5.0.14 zod@4.4.3
pnpm add react-hook-form@7.80.0 @hookform/resolvers@5.4.0
pnpm add -D tailwindcss@4.3.2 @types/node @types/react

# ── services/api (Node orchestration) ──
pnpm add fastify@5.9.0 bullmq@5.79.2 ioredis@5.6.1 zod@4.4.3
pnpm add -D tsx @types/node

# ── services/simulator (Python) ──
pip install "fastapi[standard]==0.138.2" "uvicorn[standard]>=0.34.0"
pip install "celery[redis]==5.6.3" "redis==8.0.1"
pip install "numpy==2.5.0" "scipy==1.18.0" "pandas>=2.2,<3"
pip install "pydantic==2.13.4" "sqlalchemy==2.0.51" "geoalchemy2==0.20.0"
pip install "psycopg[binary,pool]==3.3.4" "shapely>=2.1" "geopandas>=1.1"
pip install "httpx>=0.28" "python-dotenv>=1.0"
pip install -r requirements-dev.txt  # pytest, ruff, alembic

# ── Dev dependencies (web) ──
pnpm add -D playwright@1.61.1 puppeteer@25.3.0
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Next.js 16** | Next.js 15 | Only if a blocking dependency hasn't shipped v16 support yet; otherwise start on 16. |
| **Fastify** | NestJS | NestJS if you need DI/modules at scale (v2+ multi-tenant SaaS); overkill for v1 orchestration. |
| **Custom segment physics (NumPy)** | NREL FASTSim 3.x | FASTSim for drive-cycle validation benchmarks or cross-checking OEM claims — not as primary engine (different time-resolution model; less control over port drayage aux profiles). |
| **Valhalla (self-hosted)** | OSRM | OSRM if team already operates OSRM fleet-wide; Valhalla wins on truck costing parameters. |
| **Valhalla (self-hosted)** | Mapbox Directions API | Mapbox Directions for Phase 0 spike only; per-request cost and weaker truck-parameter control at scale. |
| **Mapbox GL JS** | Leaflet + OpenStreetMap tiles | Leaflet if Mapbox token budget is zero; accept lower layer performance and manual SoC gradient work. |
| **Celery + Redis** | BullMQ bridged to Python | BullMQ-bridge adds cross-language complexity; keep Celery inside Python service, HTTP boundary at FastAPI. |
| **GeoAlchemy2 + SQLAlchemy** | Raw psycopg SQL | Raw SQL for hot-path spatial queries if ORM overhead measured; start with GeoAlchemy2 for maintainability. |
| **Puppeteer PDF** | @react-pdf/renderer | react-pdf for text-heavy reports without map screenshots; Puppeteer when map capture fidelity matters. |
| **PostgreSQL 16 + PostGIS 3.5** | PostgreSQL 17 + PostGIS 3.5 | PG 17 fine on greenfield; PG 16 has broader Docker/PostGIS image maturity today (`postgis/postgis:16-3.5`). |

## What NOT to Use

| Avoid | Why | Use Instead | Confidence |
|-------|-----|-------------|------------|
| **Pure JavaScript physics engine** | Numeric precision, vectorization, and validation tooling are inferior; project constraint explicitly requires Python for scientific computing. | NumPy segment model in Python FastAPI service | HIGH |
| **NestJS for v1 API** | Heavy module/DI ceremony for a thin orchestration layer (submit job, poll status, fetch results). | Fastify 5.9 | HIGH |
| **MongoDB / document-first DB** | NHFN linework, charger proximity, and corridor buffers are inherently spatial-relational; PostGIS is the domain standard. | PostgreSQL 16 + PostGIS 3.5 | HIGH |
| **Prisma as primary Python spatial ORM** | Prisma's PostGIS story is Node-centric; Python simulation service needs GeoAlchemy2/SQLAlchemy native geometry types. | SQLAlchemy 2.0 + GeoAlchemy2 0.20 | HIGH |
| **Dual queue (BullMQ + Celery) for same simulation job** | Two workers can pick up the same job; visibility timeout and retry semantics diverge across languages. | Node → HTTP → FastAPI → Celery (single queue boundary) | HIGH |
| **FASTSim embedded as core engine** | Drive-cycle time-step model fights FleetVolt's segment/event architecture and port-drayage aux customization; harder to expose transparent assumptions per segment. | Custom PhysicsEngine inspired by FASTSim validation patterns | MEDIUM |
| **Google Maps Platform as primary** | Cost at corridor scale; project constraint prefers open elevation/routing. | Valhalla + Open-Elevation (self-hosted) + Mapbox GL for viz only | HIGH |
| **Real-time OCPI integrations (v1)** | Fragmented auth, rate limits, not needed for planning/feasibility MVP. | Static NREL AFDC with freshness timestamp | HIGH |
| **TensorFlow / PyTorch** | No ML inference in v1; physics is deterministic segment model. | NumPy + SciPy | HIGH |
| **Vercel + managed AWS for v1** | Project constraint: Docker Compose on VPS (CleverWork pattern). | Docker Compose + Caddy on VPS | HIGH |
| **1 Hz time-step simulation loop** | US corridor at 1 Hz = hundreds of thousands of steps; violates p95 <10s target. | Segment-based discretization (~500 m or grade/speed breakpoints) | HIGH |
| **Node 26 (Current) in production** | Not LTS until Oct 2026; unnecessary risk on VPS. | Node 24 LTS | HIGH |
| **NumPy 2.5 on Python 3.11** | NumPy 2.5 dropped 3.11 support. | Python 3.12 + NumPy 2.5 | HIGH |

## Stack Patterns by Variant

**If Mapbox token budget is tight:**
- Use **Leaflet 1.9.x + react-leaflet + OpenStreetMap tiles** for base map
- Implement SoC gradient via **canvas overlay** or **deck.gl** PathLayer
- Because consulting deliverable polish matters less than internal validation

**If simulation queue is dev-only (Phase 0 spike):**
- Use **FastAPI BackgroundTasks** temporarily
- Because zero Redis dependency speeds first physics prototype
- **Must** replace with Celery before validation gate — BackgroundTasks won't survive worker restarts or provide retry/backpressure

**If elevation API costs spike:**
- Self-host **Open-Elevation** or pre-cache **SRTM/COP30** rasters for POLB priority corridors in PostGIS raster tables
- Because Cajon Pass validation requires repeatable grade profiles without per-request fees

**If PDF export load is heavy:**
- Add **BullMQ worker in Node** (separate queue from Celery) for Puppeteer rendering
- Because map screenshot generation is I/O-bound and shouldn't block Fastify API threads

**If v1.5 adds charging optimization:**
- Introduce **OR-Tools 9.x** or **PuLP** inside Python service only
- Because solvers belong next to physics output arrays, not in Node

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 16.2.9 | React 19.2.7 | Required peer pairing on npm (verified Jun 2026). |
| NumPy 2.5.0 | Python 3.12–3.14 | NumPy 2.5 dropped Python 3.11; pin Python 3.12 in Docker. |
| SciPy 1.18.0 | NumPy ≥ 2.0, Python 3.12–3.14 | Install as pinned pair in same requirements lockfile. |
| GeoAlchemy2 0.20.0 | SQLAlchemy 2.0.51 | 0.20 adds SQLAlchemy 2.1 compat; stay on 2.0.x stable unless testing 2.1 beta. |
| Celery 5.6.3 | Redis 7.x–8.x, redis-py 8.0.1 | Set `visibility_timeout` > max simulation duration (recommend 600s for v1). |
| Zod 4.4.3 | @hookform/resolvers ≥ 5.4.0 | Resolvers < 5.x throw runtime errors with Zod 4 (verified community reports). |
| Mapbox GL JS 3.25.0 | react-map-gl 8.1.1 | Mapbox 3.25 changed ESM exports — use documented import paths. |
| PostGIS 3.5.x | PostgreSQL 12–18 | Docker image `postgis/postgis:16-3.5` tested combo for VPS deploy. |
| FastAPI 0.138.2 | Pydantic 2.13.4 | FastAPI `[standard]` bundle pulls compatible Starlette/Uvicorn. |

## Reference Architecture (Hybrid Node + Python)

```
Browser (Next.js 16)
    │ REST / SSE
    ▼
Node.js 24 + Fastify 5.9          ← auth, job lifecycle, cache, PDF queue (BullMQ, Phase 2)
    │ HTTP (internal)
    ▼
Python 3.12 + FastAPI 0.138       ← /simulate, /health, enqueue
    │ Celery 5.6.3
    ▼
Celery Workers (NumPy physics)    ← segment energy, charger planner, elevation
    │ psycopg 3 + GeoAlchemy2
    ▼
PostgreSQL 16 + PostGIS 3.5       ← NHFN, chargers, elevation_cache, simulation_runs
    ▲
Valhalla (truck routing)          ← route geometry + speed limits
Redis 8                           ← Celery broker (db 0) + result cache (db 1)
```

**Queue boundary rule:** Node never pushes directly to Celery. Node calls FastAPI; FastAPI owns task serialization, retry policy, and worker concurrency.

## Docker Compose Service Baseline

| Service | Image / Build | Port | Notes |
|---------|---------------|------|-------|
| `web` | `node:24-alpine` → Next.js standalone | 3000 | `output: 'standalone'` for slim production image |
| `api` | `node:24-alpine` → Fastify | 4000 | Bind `0.0.0.0:4000` |
| `simulator` | `python:3.12-slim` → FastAPI | 8000 | Multi-stage; pin NumPy/SciPy wheels |
| `sim-worker` | same as simulator | — | `celery -A app.worker worker -c 2` |
| `postgres` | `postgis/postgis:16-3.5` | 5432 | Init PostGIS extension on first run |
| `redis` | `redis:8-alpine` | 6379 | Persist AOF for job durability |
| `valhalla` | `ghcr.io/gis-ops/docker-valhalla/valhalla` | 8002 | Pre-built NA extract; truck costing enabled |
| `caddy` | `caddy:2-alpine` | 443 | TLS termination, reverse proxy |

## Sources

- [next@16.2.9 on npm](https://www.npmjs.com/package/next) — version verified 2026-06-10 (HIGH)
- [FastAPI release notes](https://fastapi.tiangolo.com/release-notes/) — v0.138.2 2026-06-29 (HIGH)
- [Fastify v5.9.0 release](https://github.com/fastify/fastify/releases/tag/v5.9.0) — 2026-06-28 (HIGH)
- [Node.js release schedule](https://github.com/nodejs/Release) — Node 24 Active LTS (HIGH)
- [PostGIS 3.5 release notes](https://postgis.net/docs/manual-3.5/en/release_notes.html) — PG 12–18 support (HIGH)
- [postgis/postgis Docker Hub](https://hub.docker.com/r/postgis/postgis) — `16-3.5` tag (HIGH)
- [NumPy 2.5.0 release](https://github.com/numpy/numpy/releases) — Python 3.12+ requirement (HIGH)
- [SciPy 1.18.0 release](https://github.com/scipy/scipy/releases) — NumPy 2.0+ requirement (HIGH)
- [Celery 5.6.3 docs](https://docs.celeryq.dev/en/stable/changelog.html) — stable release 2026-03-26 (HIGH)
- [Valhalla truck costing API](https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/) — truck profile parameters (HIGH)
- [Mapbox GL JS npm](https://www.npmjs.com/package/mapbox-gl) — v3.25.0 2026-06-17 (HIGH)
- [GeoAlchemy2 0.20.0 changelog](https://geoalchemy-2.readthedocs.io/en/stable/changelog.html) — SQLAlchemy 2.x compat (HIGH)
- [Zod 4 release notes](https://zod.dev/v4) — stable; `@hookform/resolvers` ≥ 5.4 required (HIGH)
- [NREL FASTSim](https://www.nlr.gov/transportation/fastsim) — reference architecture for HDV energy modeling, not primary engine (MEDIUM)
- FleetVolt PRD v2 + Technical Architecture — hybrid stack constraint, segment physics, VPS deploy (HIGH)

---
*Stack research for: Class 8 EV drayage & corridor energy modeling*
*Researched: 2026-07-01*
