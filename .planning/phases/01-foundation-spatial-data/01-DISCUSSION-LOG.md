# Phase 1: Foundation & Spatial Data - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 1-Foundation & Spatial Data
**Areas discussed:** Monorepo layout, Geographic scope, HD charger filtering, Elevation caching, Truck config fidelity, Docker Compose scope

---

## Monorepo Layout

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm + Turborepo | apps/web, services/api, services/simulator, packages/shared-types | ✓ |
| pnpm flat | web/, api/, simulator/, shared/ without turbo | |
| Single repo flat | src/web, src/api, src/simulator minimal tooling | |

**User's choice:** pnpm + Turborepo monorepo layout
**Notes:** Aligns with STACK.md research recommendation.

## Shared Type Contracts

| Option | Description | Selected |
|--------|-------------|----------|
| OpenAPI codegen | FastAPI generates TS types for Node/Next | ✓ |
| Parallel Zod + Pydantic | Manually synced schemas | |
| Pydantic only Phase 1 | Add Zod when frontend needs it | |

**User's choice:** OpenAPI codegen from FastAPI/Pydantic

## Geographic Scope

| Option | Description | Selected |
|--------|-------------|----------|
| SoCal regional | CA NHFN + chargers within ~200mi of POLB | ✓ |
| National | Full US NHFN + all DCFC | |
| Corridor-only | POLB bounding box only | |

**User's choice:** SoCal regional extract for Phase 1 speed

## Charger Power Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| ≥150 kW | Broader coverage, more false positives | |
| ≥350 kW | MCS-aware Class 8 realism | ✓ |
| Tiered ingest | Ingest ≥50 kW, tag tiers for later filtering | |

**User's choice:** ≥350 kW minimum for ingest filter

## HD Accessibility Metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Power + connector heuristic | ≥350 kW + CCS/MCS = HD-capable | ✓ |
| Manual curation | Hand-flag POLB/Inland Empire sites | |
| Operator allowlist | Forum Mobility, EV Realty, Tesla Semi, etc. | |

**User's choice:** Power + connector heuristic

## Elevation Source

| Option | Description | Selected |
|--------|-------------|----------|
| Open-Elevation + PostGIS cache | Free, no Google dependency | ✓ |
| USGS 3DEP raster | Higher fidelity, more ingest work | |
| Hybrid | 3DEP for Cajon, Open-Elevation elsewhere | |

**User's choice:** Open-Elevation with PostGIS cache

## Elevation Pre-cache Corridors

| Option | Description | Selected |
|--------|-------------|----------|
| Two corridors | POLB→San Bernardino + POLB→Cajon Pass | ✓ |
| SoCal bounding box | Entire regional box | |
| On-demand only | Cache at first simulation request | |

**User's choice:** Pre-cache two validation corridors

## Truck Usable kWh

| Option | Description | Selected |
|--------|-------------|----------|
| Conservative usable | 90% nameplate minus BMS reserve | ✓ |
| OEM marketing | Published nameplate directly | |
| Store both | Nameplate + usable + reserve fields | |

**User's choice:** Conservative usable kWh (also store separate fields per pitfalls research)

## Charge Curves

| Option | Description | Selected |
|--------|-------------|----------|
| Piecewise OEM | 3-4 SOC breakpoints from public specs | ✓ |
| Linear taper above 80% | Simpler, less accurate | |
| Constant kW until 80% | Defer to Phase 3 | |

**User's choice:** Piecewise OEM charge curves

## Docker Compose Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full 6-service stack day 1 | PostGIS, Redis, Valhalla, Python, Fastify, Next.js stub | ✓ |
| Data-first incremental | PostGIS + ingest only | |
| Valhalla stub | Hardcoded polylines until extract ready | |

**User's choice:** Full stack on day 1

## Valhalla Extract

| Option | Description | Selected |
|--------|-------------|----------|
| SoCal regional | CA + NV border for Cajon Pass | ✓ |
| US West | CA through AZ/NV, larger RAM | |
| Stub Phase 1 | Pre-computed polylines only | |

**User's choice:** SoCal regional Valhalla extract

## Claude's Discretion

CI pipeline structure, Open-Elevation batch strategy, Alembic index tuning, Next.js stub scope, pytest reference test structure.

## Deferred Ideas

National ingest, manual HD curation, US West Valhalla extract, USGS 3DEP — considered but deferred beyond Phase 1 geographic scope.
