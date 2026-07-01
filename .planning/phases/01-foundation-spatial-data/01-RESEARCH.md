# Phase 1: Foundation & Spatial Data - Research

**Researched:** 2026-07-01
**Domain:** Monorepo scaffolding, Docker Compose, PostGIS spatial ingest, Valhalla routing baseline
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield foundation phase: no application code exists yet. Success means a developer runs `docker compose up`, applies Alembic migrations, executes reproducible ingest scripts, and validates spatial queries plus truck config seed data through pytest and CI. The locked stack from CONTEXT.md and STACK.md is prescriptive — pnpm + Turborepo for Node/Next.js, Python 3.12 + FastAPI in `services/simulator`, PostGIS 16 as spatial truth, and a six-service Compose stack (PostGIS, Redis, Valhalla, simulator stub, Fastify stub, Next.js stub) on day one.

Research confirms three high-leverage implementation patterns for this phase: (1) treat FastAPI OpenAPI as the contract source and generate TypeScript types into `packages/shared-types` via `openapi-typescript` or `@hey-api/openapi-ts` [CITED: fastapi.tiangolo.com/advanced/generate-clients/]; (2) use GeoAlchemy2 Alembic helpers plus `CREATE EXTENSION postgis` in migration env to avoid duplicate GIST index and `spatial_ref_sys` drift [CITED: geoalchemy-2.readthedocs.io/en/stable/alembic.html]; (3) build a SoCal Valhalla graph from a clipped OSM PBF (Geofabrik CA extract + osmium bbox cut including NV border for Cajon Pass) rather than shipping a full US West graph [CITED: github.com/nilsnolde/docker-valhalla, osmium-tool extract docs].

Data ingest should follow a strict ordering: PostGIS schema → NHFN clip → NREL AFDC upsert → truck seed → elevation pre-cache for two corridors. NREL ingestion should prefer the `ev-charging-units.csv` endpoint for per-connector kW fields, then apply the locked ≥350 kW + CCS/MCS heuristic for `hd_capable` [CITED: developer.nrel.gov/docs/transportation/alt-fuel-stations-v1/ev-charging-units/]. Elevation should batch-fetch Open-Elevation (or self-hosted SRTM tiles in Compose), apply GradeIT-inspired bridge spike filtering, and persist to `elevation_profiles` keyed by `corridor_key` [CITED: github.com/NREL/gradeit].

**Primary recommendation:** Scaffold monorepo + Compose + Alembic first; land spatial schema and ingest scripts before service stubs; wire CI on schema/query tests (not physics) so Phase 2 inherits a verified spatial contract.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Monorepo & Type Contracts
- **D-01:** Use **pnpm + Turborepo** monorepo layout: `apps/web`, `services/api`, `services/simulator`, `packages/shared-types`
- **D-02:** Shared schemas via **OpenAPI codegen** — FastAPI/Pydantic is source of truth; TypeScript types generated for Node/Next.js consumers
- **D-03:** Database migrations live in `services/simulator` via **Alembic** (PostGIS schema versioning)

#### Geographic & Data Scope
- **D-04:** **SoCal regional extract** for Phase 1 — CA NHFN shapefiles + NREL chargers within ~200 mi of POLB (not national ingest)
- **D-05:** Charger ingest minimum power filter: **≥350 kW** MCS-aware threshold (Class 8 corridor realism over broader DCFC coverage)
- **D-06:** HD accessibility flag via **power + connector heuristic** — ≥350 kW AND CCS/MCS connector tag = `hd_capable`; no manual curation or operator allowlist in Phase 1

#### Elevation
- **D-07:** Elevation source: **Open-Elevation API** with results cached in PostGIS (no Google Elevation dependency)
- **D-08:** Pre-cache elevation profiles for **two corridors only**: POLB → San Bernardino (drayage) and POLB → Cajon Pass (grade validation)
- **D-09:** Apply bridge artifact filtering on cached elevation profiles per Data Integration Spec

#### Truck Config Seed Data
- **D-10:** Battery modeling uses **conservative usable kWh** — ~90% of nameplate minus documented BMS reserve; store nameplate, usable, and reserve as separate fields
- **D-11:** Charge curves seeded as **piecewise OEM curves** — 3–4 SOC breakpoints from public eCascadia/T680E specs (not linear taper or constant-kW shortcuts)
- **D-12:** Seed exactly two models: **Freightliner eCascadia 438 kWh** and **Kenworth T680E 375 kWh** with full physics params (regen %, aux kW, drag coeff, C_rr, charge curves, source notes)

#### Docker Compose & Infrastructure
- **D-13:** **Full 6-service stack on day 1**: PostGIS, Redis, Valhalla, Python sim service (FastAPI stub), Fastify API stub, Next.js stub
- **D-14:** Valhalla graph extract: **SoCal regional** (CA + NV border for Cajon Pass routes) — not US West or hardcoded polylines
- **D-15:** VPS deployment target remains Docker Compose with Caddy reverse proxy per STACK.md research; bind `0.0.0.0:$PORT`

#### Data Freshness & Provenance
- **D-16:** Every ingested dataset carries `source`, `ingested_at`, and freshness metadata visible to downstream consumers
- **D-17:** NREL AFDC charger refresh: weekly scripted upsert (DATA-05); NHFN: one-time + manual annual re-ingest

### Claude's Discretion
- Exact Turborepo task graph and CI pipeline structure (lint/typecheck/test targets per package)
- Open-Elevation rate limiting and batch fetch strategy for corridor pre-cache
- Specific Alembic migration ordering and index tuning beyond schemas in Data Integration Spec
- Next.js stub scope (health page only vs minimal map placeholder centered on POLB)
- pytest reference test case structure for Phase 1 validation framework (ideal-case stub before physics exists)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

National NHFN/charger ingest, manual HD site curation, US West Valhalla extract, and USGS 3DEP elevation were considered but explicitly not chosen for Phase 1. Expand geographic scope in a future phase if SoCal proves insufficient.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | NHFN shapefiles → PostGIS with spatial indexes | BTS NTAD download + GeoPandas/`ogr2ogr` ingest; GIST on `geography(LINESTRING)`; SoCal bbox clip per D-04 |
| DATA-02 | NREL AFDC high-power chargers with HD metadata | `ev-charging-units.csv` API + ≥350 kW filter + CCS/MCS `hd_capable` heuristic; provenance columns per D-16 |
| DATA-03 | Seed eCascadia 438 kWh + T680E 375 kWh truck configs | JSONB schema with nameplate/usable/reserve + piecewise charge curves per D-10–D-12 |
| DATA-04 | Cached elevation profiles with bridge filtering | Valhalla route sampling → Open-Elevation batch → GradeIT-style spike filter → `elevation_profiles` cache |
| DATA-05 | Weekly charger refresh with freshness indicator | Idempotent upsert script + `ingested_at`/`last_updated`; CI cron or documented VPS cron stub |
| PLAT-01 | Docker Compose local stack (6 services) | Compose baseline from STACK.md; health endpoints; bind `0.0.0.0:$PORT` per D-13/D-15 |
| PLAT-03 | CI lint, typecheck, unit tests | Turborepo pipeline + pytest spatial/schema tests + Ruff/ESLint; GitHub Actions recommended |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Monorepo scaffolding & CI | Build/CI (root) | — | Cross-cutting; Turborepo orchestrates Node packages; Python invoked via package.json scripts |
| PostGIS schema & migrations | Database / Storage | Python sim service | Alembic lives in simulator; DB is spatial truth |
| NHFN / charger / elevation ingest | Data Ingestion (Python scripts) | Database | Batch ETL writes PostGIS; not runtime API responsibility in Phase 1 |
| Truck config seed data | Database / Storage | Python sim service | Seeded via Alembic data migration or idempotent seed script |
| OpenAPI type contracts | Python sim service | packages/shared-types | FastAPI generates OpenAPI; TS types consumed by api/web |
| Valhalla SoCal graph | External routing service (container) | Data prep scripts | Self-hosted Valhalla; OSM extract build is infra task |
| Service health stubs | API + Frontend | Docker Compose | Fastify/Next/FastAPI `/health` only — no business logic |
| Weekly charger refresh | Data Ingestion / Cron | CI or VPS | Script + scheduler; freshness metadata surfaced to future UI |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **pnpm** | 11.9.0 | Monorepo package manager | Locked D-01; efficient workspaces [VERIFIED: npm registry] |
| **Turborepo (`turbo`)** | 2.10.2 | Task graph, CI caching | Locked D-01 [VERIFIED: npm registry] |
| **Next.js** | 16.2.9 | Web stub | STACK.md; App Router + standalone Docker output [VERIFIED: npm registry] |
| **Fastify** | 5.9.0 | API orchestration stub | STACK.md [VERIFIED: npm registry] |
| **Node.js** | 24.x LTS | Runtime for web/api | STACK.md production target |
| **Python** | 3.12.x | Simulator + ingest | NumPy 2.5+ floor per STACK.md |
| **FastAPI** | 0.138.2 | OpenAPI source of truth | D-02 [VERIFIED: PyPI] |
| **PostgreSQL + PostGIS** | 16 + 3.5 | Spatial truth | `postgis/postgis:16-3.5` image [CITED: hub.docker.com/r/postgis/postgis] |
| **Redis** | 8.x | Broker/cache placeholder | STACK.md Compose baseline |
| **Valhalla (docker-valhalla)** | latest stable | Truck routing graph | D-14; `costing: truck` [CITED: valhalla.github.io] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Alembic** | 1.16.x (pin; 1.18.5 available) | DB migrations | D-03; use GeoAlchemy2 helpers [VERIFIED: PyPI] |
| **SQLAlchemy** | 2.0.51 | ORM | PostGIS models in simulator [VERIFIED: PyPI] |
| **GeoAlchemy2** | 0.20.0 | Geography columns | NHFN/chargers geometry [VERIFIED: PyPI] |
| **psycopg** | 3.3.4 | PostgreSQL driver | Async pools in FastAPI [VERIFIED: PyPI] |
| **GeoPandas** | 1.1.4 | NHFN shapefile ingest | Prefer over raw ogr for attribute mapping [VERIFIED: PyPI] |
| **Shapely** | 2.1.x | Bbox clip, corridor buffers | SoCal regional filter |
| **Pandas** | 2.2.x | AFDC normalization | Charger CSV/API parsing |
| **httpx** | ≥0.28 | Open-Elevation + NREL HTTP | Batch elevation/charger fetch |
| **openapi-typescript** | 7.13.0 | TS codegen from OpenAPI | D-02 alternative to @hey-api [VERIFIED: npm registry] |
| **pytest** | 8.x (STACK) / 9.1.1 (latest) | Python tests | Pin 8.x in Phase 1 for STACK alignment [VERIFIED: PyPI] |
| **Ruff** | 0.15.20 | Python lint/format | STACK.md dev tooling [VERIFIED: PyPI] |
| **ESLint + Prettier** | latest (Next 16 defaults) | TS lint/format | PLAT-03 |
| **ogr2ogr (GDAL)** | system | Optional NHFN fast path | When GeoPandas overhead unnecessary |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Open-Elevation API | Self-hosted Open-Elevation container | Public API rate-limited (~1 req/sec/IP); self-host adds Compose service + SRTM volume (~GB级 for SoCal only) |
| GeoPandas ingest | `ogr2ogr -append` | ogr2ogr faster for bulk linework; GeoPandas better for attribute transforms + bbox clip in one script |
| openapi-typescript | @hey-api/openapi-ts | FastAPI docs recommend Hey API for richer client; openapi-typescript lighter for types-only package |
| Geofabrik CA PBF | Full US West PBF | CA-only ~900MB vs multi-GB; fits VPS disk budget |

**Installation (Phase 1 bootstrap):**

```bash
# Root
pnpm init
pnpm add -D turbo typescript eslint prettier
# Pin in package.json: "packageManager": "pnpm@11.9.0"

# Python (services/simulator)
pip install "fastapi[standard]==0.138.2" "alembic>=1.16,<1.17" \
  "sqlalchemy==2.0.51" "geoalchemy2==0.20.0" "psycopg[binary,pool]==3.3.4" \
  "geopandas>=1.1" "shapely>=2.1" "pandas>=2.2,<3" "httpx>=0.28" \
  "pytest>=8,<9" "ruff>=0.15"
```

## Package Legitimacy Audit

> Seam `package-legitimacy check` returned incomplete registry metadata in sandbox (all SUS). Manual npm/PyPI verification performed below.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| turbo | npm | mature | very high | github.com/vercel/turborepo | OK | Approved |
| pnpm | npm | mature | very high | github.com/pnpm/pnpm | OK | Approved |
| openapi-typescript | npm | mature | high | github.com/drwpow/openapi-typescript | OK | Approved |
| fastapi | PyPI | mature | very high | github.com/tiangolo/fastapi | OK | Approved |
| alembic | PyPI | mature | very high | github.com/sqlalchemy/alembic | OK | Approved |
| geoalchemy2 | PyPI | mature | high | github.com/geoalchemy/geoalchemy2 | OK | Approved |
| geopandas | PyPI | mature | very high | github.com/geopandas/geopandas | OK | Approved |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none after manual verification

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart TB
  subgraph dev["Developer / CI"]
    ING["data/ingest/*.py"]
    CI["GitHub Actions: lint / typecheck / pytest"]
  end

  subgraph compose["Docker Compose"]
    WEB["apps/web Next.js stub :3000"]
    API["services/api Fastify stub :4000"]
    SIM["services/simulator FastAPI stub :8000"]
    PG[("PostGIS :5432")]
    RD["Redis :6379"]
    VAL["Valhalla :8002"]
  end

  subgraph external["External (batch)"]
    BTS["BTS NHFN shapefile"]
    NREL["NREL AFDC API"]
    OE["Open-Elevation API"]
    OSM["Geofabrik CA OSM PBF"]
  end

  ING -->|"NHFN/chargers/elevation/trucks"| PG
  CI --> ING
  CI --> SIM
  OSM --> VAL
  BTS --> ING
  NREL --> ING
  OE --> ING
  SIM --> PG
  API --> SIM
  WEB --> API
  SIM -.->|"future route geom"| VAL
```

### Recommended Project Structure

```
/
├── apps/web/                    # Next.js 16 stub (/health, optional POLB placeholder)
├── services/api/                # Fastify stub (/health)
├── services/simulator/          # FastAPI + Alembic + ingest helpers
│   ├── alembic/
│   ├── app/
│   └── pyproject.toml / requirements.txt
├── packages/shared-types/       # Generated from simulator OpenAPI
├── data/
│   ├── ingest/                  # nhfn.py, chargers.py, elevation.py, seed_trucks.py
│   ├── raw/                     # gitignored downloads (shapefiles, pbf)
│   └── corridors/               # corridor_key definitions (WKT/bbox JSON)
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── .github/workflows/ci.yml
```

### Pattern 1: Turborepo Mixed Node + Python

**What:** Each Python service includes a minimal `package.json` so Turborepo discovers lint/test scripts.

**When to use:** Any phase needing unified `turbo run test` in CI.

**Example:**

```json
// services/simulator/package.json
{
  "name": "@fleetvolt/simulator",
  "scripts": {
    "lint": "ruff check . && ruff format --check .",
    "test": "pytest -q",
    "openapi:export": "python scripts/export_openapi.py"
  }
}
```

```json
// turbo.json (root)
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "lint": { "dependsOn": ["^lint"] },
    "typecheck": { "dependsOn": ["^typecheck"] },
    "test": { "dependsOn": ["^build"], "outputs": [] },
    "codegen": { "dependsOn": ["openapi:export"], "cache": true }
  }
}
```

[CITED: turbo.build repo docs; vercel/turborepo discussion #194 on multi-language package.json pattern]

### Pattern 2: Alembic + PostGIS Bootstrap

**What:** Enable PostGIS extension before migrations; use GeoAlchemy2 alembic_helpers to ignore `spatial_ref_sys` and avoid duplicate GIST indexes.

**When to use:** All spatial table migrations in Phase 1.

**Example:**

```python
# alembic/env.py (excerpt)
from sqlalchemy import text
from geoalchemy2 import alembic_helpers

def run_migrations_online():
    with connectable.connect() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        connection.commit()
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=alembic_helpers.include_object,
            process_revision_directives=alembic_helpers.writer,
            render_item=alembic_helpers.render_item,
        )
        with context.begin_transaction():
            context.run_migrations()
```

[CITED: geoalchemy-2.readthedocs.io/en/stable/alembic.html]

### Pattern 3: OpenAPI → shared-types Codegen

**What:** Export `/openapi.json` from running FastAPI stub; generate TS types into `packages/shared-types`.

**When to use:** After first Pydantic models land (health + data metadata responses).

**Example:**

```bash
# packages/shared-types/package.json script
openapi-typescript ../../services/simulator/openapi.json -o ./src/schema.d.ts
```

[CITED: fastapi.tiangolo.com/advanced/generate-clients/]

### Pattern 4: SoCal Valhalla Extract (VPS-safe)

**What:** Download `california-latest.osm.pbf` from Geofabrik; clip to SoCal+NV bbox with osmium; mount into `ghcr.io/gis-ops/docker-valhalla/valhalla` `/custom_files`.

**Recommended bbox (approx, D-04/D-14):** `-121.0,32.5,-114.0,37.0` (covers POLB, Inland Empire, Cajon, southern NV)

```bash
osmium extract -b -121.0,32.5,-114.0,37.0 california-latest.osm.pbf -o socal.osm.pbf
# Place socal.osm.pbf in valhalla/custom_files/; set tile_urls or volume mount; first start builds tiles (30–90 min)
```

[CITED: github.com/nilsnolde/docker-valhalla; osmium extract man page]

### Pattern 5: NREL AFDC Ingest with HD Heuristic

**What:** Pull EV charging units CSV; filter `EV CCS Power Output (kW) >= 350` OR MCS (`J3271`) connectors; set `hd_capable = power >= 350 AND connector IN ('CCS','MCS')`.

**Endpoint:** `GET https://developer.nrel.gov/api/alt-fuel-stations/v1/ev-charging-units.csv?api_key=KEY&fuel_type=ELEC&ev_charging_level=dc_fast`

Post-filter geographically: stations within ~200 mi of POLB (33.754, -118.216) using Shapely buffer or PostGIS `ST_DWithin` after load.

[CITED: developer.nrel.gov/docs/transportation/alt-fuel-stations-v1/ev-charging-units/; afdc.energy.gov data dictionary for J3271 MCS]

### Pattern 6: Elevation Batch + Bridge Filter

**What:** Sample route polyline at 100–250 m; batch POST to Open-Elevation `/api/v1/lookup`; apply spike filter before persist.

**Bridge filter (GradeIT-inspired, D-09):** For each point `i`, if `elev[i] < elev[i-1] - threshold_ft` over horizontal distance `< 200m`, replace with linear interpolation between neighbors (virtual bridge deck).

**Rate limit:** Public API ~1 req/sec/IP [CITED: github.com/Jorl17/open-elevation/issues/3] — use batches of ≤100 locations per request, 1.2s sleep between batches, or self-host Open-Elevation service in Compose for CI/dev.

[CITED: github.com/NREL/gradeit; open-elevation.com host-your-own docs]

### Anti-Patterns to Avoid

- **National NHFN/charger ingest in Phase 1:** Violates D-04; slows iteration and obscures SoCal validation.
- **Autogenerate Alembic without geoalchemy2 helpers:** Duplicate GIST indexes fail migrations.
- **Using nameplate kWh in seed data:** PITFALLS.md Pitfall 2; breaks downstream SoC credibility.
- **Skipping `hd_capable` filter:** AFDC LD sites inflate feasibility (PITFALLS.md Pitfall 7).
- **Full US Valhalla graph on VPS:** Disk/RAM blow-up; use SoCal extract per D-14.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PostGIS migrations | Raw SQL-only versioning | Alembic + GeoAlchemy2 helpers | Extension bootstrap, spatial_ref_sys noise, reproducible upgrades |
| TS API types | Manual duplicate interfaces | openapi-typescript from FastAPI | Drift breaks api/web contracts (D-02) |
| Valhalla tile build | Custom routing graph compiler | docker-valhalla + osmium extract | Battle-tested truck costing; OSM updates via PBF swap |
| Elevation DEM hosting (Phase 1) | Full 3DEP raster pipeline | Open-Elevation + corridor cache | Matches D-07; 3DEP deferred |
| Monorepo task runner | Custom shell orchestration | Turborepo + pnpm filters | Cacheable CI, standard layout |
| Charger power parsing | Scraping station web pages | NREL ev-charging-units API | Authoritative connector-level kW fields |

**Key insight:** Phase 1 value is the **spatial contract** (queryable, provenanced, tested). Custom infra here creates debt that Phase 2 physics cannot compensate for.

## Common Pitfalls

### Pitfall 1: Valhalla First Start Timeout

**What goes wrong:** Compose healthchecks fail while tiles build for 60+ minutes.

**Why:** SoCal extract still multi-GB; tile build is CPU-heavy.

**How to avoid:** Document one-time build; disable dependent service health gates until Valhalla `/status` OK; persist `custom_files/` volume on VPS.

**Warning signs:** `valhalla` container restart loop; route stub tests skipped silently.

### Pitfall 2: NHFN CUFC Missing from GIS

**What goes wrong:** Urban freight corridors near POLB absent from `nhfn_network`.

**Why:** BTS notes CUFC centerline miles not included in GIS layer [CITED: rosap.ntl.bts.gov/view/dot/88270].

**How to avoid:** Document coverage gap in seed metadata; rely on Valhalla truck routes for drayage legs in Phase 2; do not block Phase 1 on CUFC completeness.

### Pitfall 3: AFDC Station vs Port Granularity

**What goes wrong:** Max kW taken from station header, not CCS port row.

**Why:** Multi-connector sites list mixed Level 2 + DCFC.

**How to avoid:** Use `ev-charging-units.csv` not bulk station CSV; upsert on stable `station_id` + connector type.

### Pitfall 4: Elevation Bridge Spikes on I-15/I-10

**What goes wrong:** Grade profiles show 50+ ft drops at overpasses; invalidates Cajon validation prep.

**Why:** SRTM bare-earth model [CITED: NREL GradeIT docs].

**How to avoid:** Mandatory bridge filter in `precompute_elevation.py`; pytest asserts max single-segment grade delta < 12% after filter.

### Pitfall 5: Node Version Drift (22 vs 24)

**What goes wrong:** Local dev on Node 22; Docker uses 24 — native module mismatch.

**How to avoid:** Pin `engines.node` >=24 in root package.json; use `node:24-alpine` in all Dockerfiles per STACK.md.

### Pitfall 6: pytest Without DB Fixture

**What goes wrong:** Spatial tests pass locally against wrong DB or skip silently.

**How to avoid:** `conftest.py` with Compose Postgres URL; CI service container `postgis/postgis:16-3.5`.

## Code Examples

### Alembic Initial PostGIS Tables (excerpt)

```python
# alembic/versions/001_spatial_core.py
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geography

def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table(
        "nhfn_network",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("geom", Geography(geometry_type="LINESTRING", srid=4326), nullable=False),
        sa.Column("phfs_flag", sa.Boolean()),
        sa.Column("corridor_type", sa.Text()),
        sa.Column("state", sa.Text()),
        sa.Column("attributes", sa.dialects.postgresql.JSONB()),
        sa.Column("source", sa.Text()),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.execute("CREATE INDEX nhfn_network_geom_idx ON nhfn_network USING GIST (geom)")
```

[CITED: 03_Data_Integration_Spec.md schema sketch; GeoAlchemy2 Alembic docs]

### Charger HD Heuristic (ingest)

```python
HD_CONNECTORS = {"J1772COMBO", "J3271", "CCS", "MCS"}

def hd_capable(row: dict) -> bool:
    power = float(row.get("ev_ccs_power_kw") or 0)
    connectors = set(row.get("connector_types") or [])
    return power >= 350 and bool(connectors & HD_CONNECTORS)
```

[CITED: afdc.energy.gov alt_fuel_stations_format; D-05/D-06]

### Open-Elevation Batch Fetch

```python
async def fetch_elevations(points: list[tuple[float, float]], client: httpx.AsyncClient):
    payload = {"locations": [{"latitude": lat, "longitude": lon} for lat, lon in points]}
    r = await client.post(f"{OPEN_ELEVATION_URL}/api/v1/lookup", json=payload, timeout=60)
    r.raise_for_status()
    return [p["elevation"] for p in r.json()["results"]]
```

[CITED: open-elevation.com API docs]

### Bridge Spike Filter

```python
def filter_bridge_spikes(profile: list[dict], max_drop_ft: float = 40, window_m: float = 200):
    out = profile.copy()
    for i in range(1, len(out) - 1):
        dist = out[i]["dist_m"] - out[i - 1]["dist_m"]
        drop = (out[i - 1]["elev_m"] - out[i]["elev_m"]) * 3.28084
        if dist < window_m and drop > max_drop_ft:
            out[i]["elev_m"] = (out[i - 1]["elev_m"] + out[i + 1]["elev_m"]) / 2
    return out
```

[CITED: NREL GradeIT bridge handling pattern; PITFALLS.md Pitfall 5]

### Docker Compose Service Skeleton

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.5
    environment:
      POSTGRES_USER: fleetvolt
      POSTGRES_PASSWORD: fleetvolt
      POSTGRES_DB: fleetvolt
    ports: ["5432:5432"]
  valhalla:
    image: ghcr.io/gis-ops/docker-valhalla/valhalla:latest
    volumes: ["./data/valhalla/custom_files:/custom_files"]
    ports: ["8002:8002"]
  simulator:
    build: ./services/simulator
    environment:
      DATABASE_URL: postgresql+psycopg://fleetvolt:fleetvolt@postgres:5432/fleetvolt
    ports: ["8000:8000"]
    depends_on: [postgres]
```

[CITED: STACK.md Docker baseline; Render bind 0.0.0.0:$PORT rule via service CMD]

## Recommended Task Ordering

1. **Monorepo skeleton** — pnpm workspace, turbo.json, package.json scripts, `.gitignore` for `data/raw/`
2. **Docker Compose** — PostGIS + Redis + health-only stubs (sim/api/web)
3. **Alembic bootstrap** — PostGIS extension, core tables (`nhfn_network`, `chargers`, `elevation_profiles`, `truck_configs`, `data_freshness` metadata)
4. **NHFN ingest** — download BTS layer, clip SoCal, load + GIST verify (DATA-01)
5. **Truck seed** — eCascadia + T680E JSONB with usable kWh + charge curves (DATA-03)
6. **NREL ingest + weekly upsert script** — HD heuristic + provenance (DATA-02, DATA-05)
7. **Valhalla SoCal extract** — osmium clip + tile build (parallelizable with 4–6)
8. **Elevation pre-cache** — two corridor scripts + bridge filter (DATA-04)
9. **OpenAPI export + shared-types codegen** (D-02)
10. **pytest spatial suite + GitHub Actions** (PLAT-03)
11. **Documentation** — ingest README, corridor keys, freshness query examples

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual TS types | OpenAPI codegen from FastAPI | FastAPI 0.9+ pattern; Hey API 2024+ | D-02 enforceable in CI |
| Flask + psycopg2 spatial | FastAPI + psycopg3 + GeoAlchemy2 | psycopg3 stable 2023+ | Async-ready simulator |
| Full national Valhalla | Regional osmium extracts | docker-valhalla maturity | VPS-feasible Phase 1 |
| Google Elevation | Open-Elevation / Open Topo Data | Cost + licensing | Matches D-07 |

**Deprecated/outdated:**
- Prisma for Python PostGIS ORM — use GeoAlchemy2 (STACK.md anti-pattern)
- NHFN national ingest for MVP — superseded by D-04 SoCal scope

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SoCal bbox `-121,32.5,-114,37` sufficient for POLB drayage + Cajon + NV border | Valhalla pattern | Routes clip at edge; expand bbox |
| A2 | Public Open-Elevation stable at 1 req/sec for one-time corridor cache | Elevation | Slow ingest; self-host fallback |
| A3 | `ev-charging-units.csv` exposes per-connector kW for ≥350 filter | NREL ingest | Under-count HD chargers; switch endpoint |
| A4 | pytest 8.x pin despite 9.x on PyPI | Validation | Minor; align with STACK in Phase 2 |
| A5 | CUFC gaps acceptable for Phase 1 per BTS GIS limitation | NHFN | Urban bias missing until manual layer |

## Open Questions

1. **NREL API key provisioning**
   - What we know: Free key from developer.nrel.gov required for production ingest volume
   - What's unclear: Org already has CleverWork shared key?
   - Recommendation: Env var `NREL_API_KEY`; document signup in ingest README

2. **Open-Elevation: public API vs Compose sidecar**
   - What we know: Public rate limits; self-host needs SRTM tiles for SoCal subset only (~1–3 GB)
   - Recommendation: Public API for first corridor cache; add optional `open-elevation` Compose service if CI flakiness observed

3. **Next.js stub scope (Claude's discretion)**
   - Recommendation: Health page + static POLB lat/lon text; defer Mapbox to Phase 4 per CONTEXT

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Compose stack | ✓ | 29.5.2 | — |
| Node.js | web/api build | ✓ (host) | v22.23.0 | Use 24 in Docker; upgrade host to 24 LTS |
| pnpm | Monorepo | ✗ | — | `corepack enable && corepack prepare pnpm@11.9.0` |
| Python | simulator/ingest | ✓ | 3.14.5 | **Pin 3.12 in Docker** (NumPy/SciPy ABI per STACK) |
| PostgreSQL/PostGIS | Spatial data | ✗ (local) | — | Provided by Compose service |
| Redis | Compose | ✗ (local) | — | Provided by Compose service |
| ogr2ogr/GDAL | NHFN ingest | ✗ | — | GeoPandas-only path or `brew install gdal` |
| osmium-tool | Valhalla clip | ✗ | — | Pre-cut PBF committed to LFS or build script in CI |
| NREL API key | Charger ingest | ? | — | Manual CSV download from afdc.energy.gov |

**Missing dependencies with no fallback:**
- Docker (blocks PLAT-01 entirely)

**Missing dependencies with fallback:**
- osmium-tool → download pre-clipped `socal.osm.pbf` artifact
- ogr2ogr → GeoPandas `read_file` + `to_postgis`
- pnpm → npm workspaces possible but violates D-01

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x + Ruff (Python); Vitest or `tsc --noEmit` (Node, Wave 0) |
| Config file | `services/simulator/pytest.ini` (Wave 0); `turbo.json` tasks |
| Quick run command | `turbo run test --filter=@fleetvolt/simulator` |
| Full suite command | `turbo run lint typecheck test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | NHFN rows in SoCal bbox; GIST index used | integration | `pytest tests/test_nhfn_ingest.py::test_socal_coverage -x` | ❌ Wave 0 |
| DATA-02 | Chargers ≥350 kW; hd_capable heuristic | unit | `pytest tests/test_charger_filter.py::test_hd_heuristic -x` | ❌ Wave 0 |
| DATA-03 | Two truck configs load; usable < nameplate | unit | `pytest tests/test_truck_configs.py::test_usable_kwh_bounds -x` | ❌ Wave 0 |
| DATA-04 | Two corridor profiles cached; no bridge spikes | integration | `pytest tests/test_elevation_cache.py::test_cajon_no_spikes -x` | ❌ Wave 0 |
| DATA-05 | Upsert idempotent; freshness row updated | unit | `pytest tests/test_charger_refresh.py::test_upsert_idempotent -x` | ❌ Wave 0 |
| PLAT-01 | Compose services reach /health | smoke | `pytest tests/test_compose_health.py -x` (or `docker compose ps`) | ❌ Wave 0 |
| PLAT-03 | CI pipeline runs lint+test | CI | `.github/workflows/ci.yml` on push | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pytest tests/ -q --tb=no -x` (simulator)
- **Per wave merge:** `turbo run lint typecheck test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `services/simulator/tests/conftest.py` — PostGIS fixture, DATABASE_URL from env
- [ ] `services/simulator/pytest.ini` — markers for `integration` vs `unit`
- [ ] `services/simulator/tests/test_spatial_queries.py` — ST_DWithin charger smoke query
- [ ] `.github/workflows/ci.yml` — postgis service container + pnpm cache
- [ ] `packages/shared-types` codegen check in CI — fail if OpenAPI drift
- [ ] Framework install: root `pnpm install`; simulator `uv pip install -r requirements.txt`

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Phase 1 stubs only |
| V3 Session Management | no | Deferred |
| V4 Access Control | no | Single-tenant dev |
| V5 Input Validation | yes | Pydantic models on FastAPI; Zod when forms added |
| V6 Cryptography | no | No secrets in repo; `.env.example` only |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection in ingest scripts | Tampering | SQLAlchemy parameterized inserts; no f-string SQL |
| Secrets in git (NREL key) | Information disclosure | `.env` gitignored; CI secrets store |
| Supply-chain npm/PyPI packages | Spoofing | Pin lockfiles; package legitimacy gate |
| Over-broad Compose ports exposed on VPS | Information disclosure | Bind localhost in dev; Caddy TLS in prod |

## Project Constraints (from AGENTS.md / workspace rules)

- Hybrid Node + Python required; no pure-JS physics (Phase 1 sets boundary, not physics yet)
- Docker Compose on VPS; bind `0.0.0.0:$PORT` (Render/VPS rule)
- GSD workflow: planning artifacts drive execution
- Phase 1 scope: no physics simulation, charging logic, or analyst UI beyond stubs

## Sources

### Primary (HIGH confidence)

- `.planning/phases/01-foundation-spatial-data/01-CONTEXT.md` — locked decisions
- `.planning/research/STACK.md` — version pins
- `03_Data_Integration_Spec.md` — table schemas, ingest order
- `.planning/research/PITFALLS.md` — usable kWh, AFDC HD, elevation traps
- [FastAPI SDK generation](https://fastapi.tiangolo.com/advanced/generate-clients/) — OpenAPI codegen
- [GeoAlchemy2 Alembic helpers](https://geoalchemy-2.readthedocs.io/en/stable/alembic.html) — PostGIS migrations
- [NREL AFDC ev-charging-units API](https://developer.nrel.gov/docs/transportation/alt-fuel-stations-v1/ev-charging-units/) — connector kW fields
- [NREL GradeIT](https://github.com/NREL/gradeit) — bridge filtering rationale
- [docker-valhalla README](https://github.com/gis-ops/docker-valhalla) — regional PBF workflow
- npm/PyPI registry queries — version verification (2026-07-01)

### Secondary (MEDIUM confidence)

- [BTS NHFN dataset](https://geodata.bts.gov/datasets/usdot::national-highway-freight-network-nhfn/about) — download source
- [Open-Elevation rate limits](https://github.com/Jorl17/open-elevation/issues/3) — batch strategy
- Turborepo multi-language monorepo patterns — GitHub discussion #194

### Tertiary (LOW confidence — validate at execution)

- Exact SoCal bbox coordinates — ASSUMED A1; tune after first Valhalla route QA

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — STACK.md + registry verification + locked CONTEXT
- Architecture: HIGH — aligns with Technical Architecture + Data Integration Spec
- Pitfalls: HIGH — PITFALLS.md cross-verified with NREL/BTS docs

**Research date:** 2026-07-01
**Valid until:** 2026-07-31 (stable infra); re-verify Valhalla/docker-valhalla tags at execution
