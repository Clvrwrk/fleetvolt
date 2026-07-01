# Roadmap: FleetVolt Route

## Overview

FleetVolt Route ships as six vertical MVP phases: spatial foundation → physics-validated POLB/Cajon simulation → charging intelligence with job pipeline → analyst dashboard with exports → corridor intelligence and emissions economics → full TCO chart and production deployment. Each phase delivers an end-to-end increment testable without waiting for later phases. Priority corridors are POLB drayage and Cajon Pass; truck library is eCascadia 438 kWh and T680E 375 kWh; deployment target is Docker Compose on VPS.

## Phases

- [x] **Phase 1: Foundation & Spatial Data** - Docker Compose stack, PostGIS spatial truth, NHFN/chargers/trucks/elevation for POLB corridors (completed 2026-07-01)
- [ ] **Phase 2: Physics Simulation Core** - Segment physics, Valhalla truck routing, POLB/Cajon validation without charging UI
- [ ] **Phase 3: Charging & Job Pipeline** - Rule-based charging stops, feasibility tiers, Fastify→FastAPI/Celery orchestration
- [ ] **Phase 4: Analyst Dashboard & Export** - Interactive map, SoC charts, scenario comparison, CSV/JSON/PDF reports
- [ ] **Phase 5: Corridor Intelligence & Emissions** - NHFN route preference, gap analysis, WTW emissions and energy cost core
- [ ] **Phase 6: TCO Analysis & Production** - Rolling cumulative TCO chart, assumptions panel, VPS production deployment

## Phase Details

### Phase 1: Foundation & Spatial Data

**Goal**: Developers have a runnable local stack with queryable spatial data and seeded truck configs for POLB corridor work
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, PLAT-01, PLAT-03
**Success Criteria** (what must be TRUE):

  1. Developer can start the full local stack via Docker Compose (PostGIS, Redis, Valhalla, Python sim service, Next.js, Fastify)
  2. NHFN freight network shapefiles are queryable in PostGIS with spatial indexes for corridor regions
  3. NREL AFDC high-power chargers are ingested with kW, connector, operator, and HD-accessibility metadata plus a freshness indicator
  4. eCascadia 438 kWh and T680E 375 kWh truck configs are seeded with usable kWh, regen %, aux kW, drag coeff, and charge curves
  5. Cached elevation profiles for POLB/Cajon corridors are available in PostGIS with bridge artifact filtering

**Plans**: 9/9 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking skeleton: monorepo, six-service Compose, Alembic PostGIS schema, health chain

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — NHFN SoCal ingest and spatial stats API (DATA-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Truck config seeds eCascadia/T680E and list API (DATA-03)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — NREL ≥350 kW charger ingest, weekly refresh, spatial query (DATA-02, DATA-05)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-05-PLAN.md — Valhalla SoCal extract and truck route API (PLAT-01)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-06-PLAN.md — Elevation cache, OpenAPI codegen, GitHub Actions CI (DATA-04, PLAT-03)

**Gap closure** *(from 01-VERIFICATION.md — gaps_found)*

**Wave 1** *(gap closure)*

- [x] 01-07-PLAN.md — Build SoCal OSM PBF locally, Makefile/verify tooling, Valhalla tile-build checkpoint (PLAT-01, D-14)

**Wave 2** *(gap closure; blocked on 01-07)*

- [x] 01-08-PLAN.md — Prove POLB→San Bernardino truck route via integration test + verify script (PLAT-01)

**Wave 3** *(gap closure; blocked on 01-07, 01-08)*

- [x] 01-09-PLAN.md — Full stack runtime smoke + GitHub Actions CI green checkpoints (PLAT-01, PLAT-03)

### Phase 2: Physics Simulation Core

**Goal**: A planner can run a physics-grounded POLB drayage + Cajon Pass simulation and receive credible energy/SoC results without charging recommendations
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PHYS-01, PHYS-02, PHYS-03, PHYS-04, PHYS-05, PHYS-06, PHYS-07, PHYS-08, ROUT-01, ROUT-02, ROUT-04
**Success Criteria** (what must be TRUE):

  1. User can input origin, destination, truck config, payload, departure conditions, and port drayage profile to run a simulation
  2. Simulation returns segment energy, forward SoC profile, and KPIs (total kWh, Wh/mi, regen recovered, total time) with visible Cajon Pass grade impact
  3. Weather presets (Ideal / Hot / Cold / Headwind) measurably affect energy consumption
  4. Physics validation passes ±8–12% MAPE on OEM reference test cases
  5. Class 8 truck routes generate via Valhalla with height/weight/axle restrictions; POLB terminal presets and corridor pairs are selectable; single scenario completes in <10s p95

**Plans**: 1/5 plans executed

Plans:

**Wave 1**

- [x] 02-01-PLAN.md — Physics engine core, SoC integration, 10-mile segmentation, OEM reference fixtures (PHYS-02, PHYS-03, PHYS-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02-PLAN.md — Valhalla route + trace_attributes speeds, cache-first elevation, speed overlay (ROUT-01, PHYS-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 02-03-PLAN.md — Sync POST /v1/simulate vertical slice, corridors + terminal catalog, Fastify proxy (PHYS-01, PHYS-05, ROUT-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 02-04-PLAN.md — Weather presets, port geo-fence, overrides audit trail (PHYS-04, PHYS-07, PHYS-08)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 02-05-PLAN.md — Validation endpoint, MAPE CI gate, fixture perf smoke, OpenAPI codegen (PHYS-06, ROUT-04)

### Phase 3: Charging & Job Pipeline

**Goal**: A planner receives a complete simulation with recommended charging stops, feasibility verdict, and infrastructure-tier framing via the API job pipeline
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: CHRG-01, CHRG-02, CHRG-03, CHRG-04, CHRG-05, CHRG-06, PLAT-02
**Success Criteria** (what must be TRUE):

  1. System recommends charging stops when projected SoC drops below configurable threshold using piecewise SOC-dependent charge curves
  2. Charger search filters by minimum 350+ kW MCS-aware power tier and HD accessibility
  3. User receives feasibility verdict (Feasible / Critical / Infeasible) with infrastructure-tier tags (public_hd / depot_required / infrastructure_gap)
  4. Balanced multi-objective optimization weighs time, energy, and cost tradeoffs across stop recommendations
  5. Node Fastify API submits simulation jobs to Python FastAPI/Celery and returns complete results through the correct queue boundary

**Plans**: TBD

### Phase 4: Analyst Dashboard & Export

**Goal**: A fleet analyst can configure, visualize, compare, and export defensible POLB corridor scenarios from the desktop web UI
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, SCEN-01, SCEN-02, SCEN-04, EXPR-01, EXPR-02, EXPR-03
**Success Criteria** (what must be TRUE):

  1. User sees interactive map with SoC-gradient route polyline, charger markers, and synced SoC/energy profile chart on hover
  2. User sees KPI cards, charging plan table, and assumptions & limitations panel with model version and disclaimer
  3. User can run and compare 2+ scenarios side-by-side with sensitivity sliders (payload, temperature, headwind) showing delta KPIs
  4. Simulation results are stored immutably with input hash for cache replay and comparison
  5. User can export full simulation profile as CSV/JSON and PDF report with map snapshot, assumptions table, physics parameter snapshot, and model version

**Plans**: TBD
**UI hint**: yes

### Phase 5: Corridor Intelligence & Emissions

**Goal**: A consultant can assess NHFN-aligned corridor feasibility, charging gaps, and post-simulation emissions/economics core for client narratives
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: ROUT-03, SCEN-03, EMIS-01, EMIS-02, EMIS-03
**Success Criteria** (what must be TRUE):

  1. Routes prefer or validate against NHFN freight network where data supports
  2. User sees corridor charging gap analysis highlighting stretches without qualifying chargers
  3. Post-simulation WTW ton-mile CO₂e compares CA diesel, national diesel, and EV
  4. User sees energy cost per mile with CA/national toggle and optional LCFS credit revenue toggle with configurable credit price

**Plans**: TBD
**UI hint**: yes

### Phase 6: TCO Analysis & Production

**Goal**: A consultant can present rolling TCO break-even analysis with transparent assumptions and deploy FleetVolt Route on production VPS
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: EMIS-04, EMIS-05, PLAT-04
**Success Criteria** (what must be TRUE):

  1. User sees rolling cumulative TCO chart (diesel vs EV) with break-even mileage
  2. Emissions/TCO assumptions panel shows EPA/CARB/GREET sources with editable lookup values
  3. Production deployment runs on VPS via Docker Compose with documented setup

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Spatial Data | 9/9 | Complete   | 2026-07-01 |
| 2. Physics Simulation Core | 1/5 | In Progress|  |
| 3. Charging & Job Pipeline | 0/TBD | Not started | - |
| 4. Analyst Dashboard & Export | 0/TBD | Not started | - |
| 5. Corridor Intelligence & Emissions | 0/TBD | Not started | - |
| 6. TCO Analysis & Production | 0/TBD | Not started | - |
