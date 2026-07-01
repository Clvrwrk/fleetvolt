# FleetVolt Route v2 — Documentation Set

[![CI](https://github.com/cleverwork/fleetvolt/actions/workflows/ci.yml/badge.svg)](https://github.com/cleverwork/fleetvolt/actions/workflows/ci.yml)

**Purpose**: Revised, realistic, and buildable documentation for the Class 8 EV drayage & corridor energy modeling platform.  
**Based on**: Original PRD teardown + strategic alignment with POLB / zero-emission freight work.  
**Date**: June 17, 2026

## Documents in This Set

| # | Document | Description | Primary Audience |
|---|----------|-------------|------------------|
| 00 | [PRD_FleetVolt_Route_v2.md](./00_PRD_FleetVolt_Route_v2.md) | Full revised Product Requirements Document with MoSCoW, personas, success metrics, risks, and clear MVP scope. | Product, stakeholders, engineering leads |
| 01 | [Technical_Architecture_FleetVolt.md](./01_Technical_Architecture_FleetVolt.md) | Hybrid Node + Python architecture, data flows, component design, tech choices with rationale. | Engineering, architects, AI agents implementing |
| 02 | [Development_Roadmap_Phases.md](./02_Development_Roadmap_Phases.md) | Phased plan (0-3) with gates, deliverables, validation strategy, and realistic timelines. | Project management, engineering, resource planning |
| 03 | [Data_Integration_Spec.md](./03_Data_Integration_Spec.md) | Detailed source-by-source integration plan, schemas, refresh, limitations, and Phase 0 execution order. | Data engineers, Phase 0 team, validation |

## Quick Start for Building

1. Review **PRD v2** first (especially Sections 4-8: Scope, Requirements, Assumptions/Open Questions).
2. Align on **Open Questions** in PRD (priority corridors, truck models, optimization objective, etc.).
3. Execute **Phase 0** using the Data Spec + Roadmap (data ingest, validation framework, scaffolding).
4. Use Technical Architecture as the implementation blueprint (especially Python simulation service design).
5. Iterate at each gate with domain input (port/drayage/energy expertise).

## Key Improvements vs Original PRD

- Realistic scoping & MVP definition (narrow & deep first).
- Physics validation gates before heavy UI investment.
- Hybrid tech stack (Python for scientific core) to avoid numeric limitations.
- Explicit infrastructure reality (sparse MCS in 2026) surfaced in model & UI.
- Comprehensive risks, success metrics, and non-functional requirements.
- Actionable data pipeline + phased roadmap with clear DoD criteria.
- Designed for your existing agent/VPS patterns and consulting use cases.

## Local development stack (Phase 1)

From the repository root:

```bash
docker compose up --build
```

Verify the simulation service:

```bash
curl http://localhost:8000/v1/meta/stack
```

Open the stack status page at http://localhost:3000.

See [apps/web/README.md](./apps/web/README.md) for web-specific notes.

### Runtime verification

Verify the two behaviors below before treating Phase 1 foundation as runtime-proven. These steps confirm PLAT-01 (local stack) and PLAT-03 (CI pipeline).

#### 1. Full stack smoke (PLAT-01)

**Prerequisite:** Valhalla needs SoCal tiles. If `data/valhalla/custom_files/socal.osm.pbf` is missing, run `make valhalla-pbf` first (requires osmium-tool and network). First Valhalla tile build can take 30–90 minutes.

```bash
docker compose up --build
# or: docker compose up --build -d && docker compose logs -f
```

Confirm all six services reach running/healthy state (`postgres`, `redis`, `valhalla`, `simulator`, `api`, `web`):

```bash
docker compose ps
curl http://localhost:8000/v1/meta/stack   # expect 200 with postgres_version and table_counts
curl http://localhost:4000/v1/meta/stack   # Fastify proxy returns same metadata
```

Open http://localhost:3000 — the stack status page should render service badges and non-error PostGIS table counts.

#### 2. CI pipeline (PLAT-03)

Push to `main` or open a PR, then confirm the [GitHub Actions CI workflow](https://github.com/cleverwork/fleetvolt/actions/workflows/ci.yml) completes green:

- Ruff lint
- `turbo lint` / `turbo typecheck`
- OpenAPI codegen drift check
- `pytest -m "not integration"`
- `turbo test`

Use the [Actions tab](https://github.com/cleverwork/fleetvolt/actions) to inspect the latest `lint-typecheck-test` job on `main`.

### CI and local verification

GitHub Actions runs lint, typecheck, pytest, and OpenAPI drift checks on every push to `main`. Without Docker/PostGIS locally, DB-backed tests skip gracefully; the unit test `test_filter_bridge_spikes_removes_synthetic_drop` always runs.

With Compose PostGIS available:

```bash
export DATABASE_URL=postgresql+psycopg://fleetvolt:fleetvolt@localhost:5432/fleetvolt_test
cd services/simulator && alembic upgrade head
python -m data.ingest.elevation --precompute --fixture
pytest tests/test_elevation_cache.py -q
pnpm turbo run lint typecheck test
```

## Next Actions

- Schedule alignment session on Open Questions & priority corridors.
- Kick off Phase 0 data work (NHFN + Chargers ingest scripts).
- Decide on initial validation corridors and truck configs to seed.
- (Optional) Use your multi-agent system to assist with ingest scripts, test case generation, or initial physics prototype in Python.

This set is ready for handoff to engineering, AI agents, or client review. All documents are living — update at phase gates. 

**Contact / Owner**: CleverWork FleetVolt Initiative.