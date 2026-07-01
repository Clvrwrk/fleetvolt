# Phase 1: Foundation & Spatial Data - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers a runnable Docker Compose local stack with PostGIS as spatial truth, ingested SoCal-scoped NHFN and NREL charger data (HD-filtered), seeded truck configs for eCascadia 438 kWh and T680E 375 kWh, pre-cached elevation profiles for two validation corridors, and CI basics. No physics simulation, no charging logic, no analyst UI beyond stubs — those belong in Phases 2–4.

Success means a developer can `docker compose up`, query spatial data in PostGIS, load truck configs, and run validation ingest scripts reproducibly.
</domain>

<decisions>
## Implementation Decisions

### Monorepo & Type Contracts
- **D-01:** Use **pnpm + Turborepo** monorepo layout: `apps/web`, `services/api`, `services/simulator`, `packages/shared-types`
- **D-02:** Shared schemas via **OpenAPI codegen** — FastAPI/Pydantic is source of truth; TypeScript types generated for Node/Next.js consumers
- **D-03:** Database migrations live in `services/simulator` via **Alembic** (PostGIS schema versioning)

### Geographic & Data Scope
- **D-04:** **SoCal regional extract** for Phase 1 — CA NHFN shapefiles + NREL chargers within ~200 mi of POLB (not national ingest)
- **D-05:** Charger ingest minimum power filter: **≥350 kW** MCS-aware threshold (Class 8 corridor realism over broader DCFC coverage)
- **D-06:** HD accessibility flag via **power + connector heuristic** — ≥350 kW AND CCS/MCS connector tag = `hd_capable`; no manual curation or operator allowlist in Phase 1

### Elevation
- **D-07:** Elevation source: **Open-Elevation API** with results cached in PostGIS (no Google Elevation dependency)
- **D-08:** Pre-cache elevation profiles for **two corridors only**: POLB → San Bernardino (drayage) and POLB → Cajon Pass (grade validation)
- **D-09:** Apply bridge artifact filtering on cached elevation profiles per Data Integration Spec

### Truck Config Seed Data
- **D-10:** Battery modeling uses **conservative usable kWh** — ~90% of nameplate minus documented BMS reserve; store nameplate, usable, and reserve as separate fields
- **D-11:** Charge curves seeded as **piecewise OEM curves** — 3–4 SOC breakpoints from public eCascadia/T680E specs (not linear taper or constant-kW shortcuts)
- **D-12:** Seed exactly two models: **Freightliner eCascadia 438 kWh** and **Kenworth T680E 375 kWh** with full physics params (regen %, aux kW, drag coeff, C_rr, charge curves, source notes)

### Docker Compose & Infrastructure
- **D-13:** **Full 6-service stack on day 1**: PostGIS, Redis, Valhalla, Python sim service (FastAPI stub), Fastify API stub, Next.js stub
- **D-14:** Valhalla graph extract: **SoCal regional** (CA + NV border for Cajon Pass routes) — not US West or hardcoded polylines
- **D-15:** VPS deployment target remains Docker Compose with Caddy reverse proxy per STACK.md research; bind `0.0.0.0:$PORT`

### Data Freshness & Provenance
- **D-16:** Every ingested dataset carries `source`, `ingested_at`, and freshness metadata visible to downstream consumers
- **D-17:** NREL AFDC charger refresh: weekly scripted upsert (DATA-05); NHFN: one-time + manual annual re-ingest

### Claude's Discretion
- Exact Turborepo task graph and CI pipeline structure (lint/typecheck/test targets per package)
- Open-Elevation rate limiting and batch fetch strategy for corridor pre-cache
- Specific Alembic migration ordering and index tuning beyond schemas in Data Integration Spec
- Next.js stub scope (health page only vs minimal map placeholder centered on POLB)
- pytest reference test case structure for Phase 1 validation framework (ideal-case stub before physics exists)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product & Requirements
- `00_PRD_FleetVolt_Route_v2.md` — MVP scope, MoSCoW requirements, validation gates, open questions
- `.planning/PROJECT.md` — Core value, constraints, key decisions (POLB + Cajon corridors, truck models, VPS deploy)
- `.planning/REQUIREMENTS.md` — Phase 1 requirements: DATA-01–05, PLAT-01, PLAT-03
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, requirement mapping

### Architecture & Data
- `01_Technical_Architecture_FleetVolt.md` — Hybrid Node/Python split, PostGIS schema, component boundaries, Docker layout
- `03_Data_Integration_Spec.md` — NHFN/charger/elevation schemas, ingest approach, refresh strategy, limitations
- `02_Development_Roadmap_Phases.md` — Phase 0 deliverables, validation framework, gate criteria

### Research (stack & pitfalls)
- `.planning/research/STACK.md` — Prescriptive versions: pnpm, Turborepo, PostGIS 16, Valhalla truck costing, OpenAPI codegen
- `.planning/research/ARCHITECTURE.md` — Build order: PostGIS → physics → routing → charging → API → frontend
- `.planning/research/PITFALLS.md` — Usable kWh vs nameplate, AFDC HD filtering, elevation fidelity, OEM validation traps
- `.planning/research/SUMMARY.md` — Synthesized implications for phase structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. Only planning docs and research artifacts exist.

### Established Patterns
- No application code yet. Monorepo structure and schemas defined in decisions above.
- Existing CleverWork VPS/Docker patterns referenced in PROJECT.md — align Compose file structure with user's established conventions where possible.

### Integration Points
- Phase 1 stubs establish service boundaries for Phase 2+:
  - `services/simulator` → FastAPI `/health`, future `/simulate`
  - `services/api` → Fastify job submit/poll stub
  - `apps/web` → Next.js health/map placeholder
- PostGIS tables (`nhfn_network`, `chargers`, `elevation_cache`, `truck_configs`) are the integration contract for all downstream phases.

</code_context>

<specifics>
## Specific Ideas

- Follow Data Integration Spec SQL sketches for `nhfn_network`, `chargers`, `elevation_cache`, `truck_configs` table definitions
- Ingest scripts should be reproducible in `data/ingest/` (or equivalent under monorepo) with versioned outputs
- Validation framework in Phase 1 sets up reference test cases (ideal flat + Cajon grade) even if physics engine is stub — scripts assert schema/query correctness and truck config loadability
- Mapbox token decision deferred to Phase 4; Phase 1 Next.js stub does not require Mapbox

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

National NHFN/charger ingest, manual HD site curation, US West Valhalla extract, and USGS 3DEP elevation were considered but explicitly not chosen for Phase 1. Expand geographic scope in a future phase if SoCal proves insufficient.

</deferred>

---

*Phase: 1-Foundation & Spatial Data*
*Context gathered: 2026-07-01*
