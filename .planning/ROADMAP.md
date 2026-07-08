# Roadmap: FleetVolt Route

## Overview

FleetVolt Route ships as six vertical MVP phases: spatial foundation → physics-validated POLB/Cajon simulation → charging intelligence with job pipeline → analyst dashboard with exports → corridor intelligence and emissions economics → full TCO chart and production deployment. Each phase delivers an end-to-end increment testable without waiting for later phases. Priority corridors are POLB drayage and Cajon Pass; truck library is eCascadia 438 kWh and T680E 375 kWh; deployment target is Docker Compose on VPS.

## Phases

- [x] **Phase 1: Foundation & Spatial Data** - Docker Compose stack, PostGIS spatial truth, NHFN/chargers/trucks/elevation for POLB corridors (completed 2026-07-01)
- [x] **Phase 2: Physics Simulation Core** - Segment physics, Valhalla truck routing, POLB/Cajon validation without charging UI (completed 2026-07-01)
- [x] **Phase 3: Charging & Job Pipeline** - Rule-based charging stops, feasibility tiers, Fastify→FastAPI/Celery orchestration (completed 2026-07-01)
- [x] **Phase 4: Analyst Dashboard & Export** - Interactive map, SoC charts, scenario comparison, CSV/JSON/PDF reports (completed 2026-07-01)
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

**Plans**: 5/5 plans complete

Plans:

**Wave 1**

- [x] 02-01-PLAN.md — Physics engine core, SoC integration, 10-mile segmentation, OEM reference fixtures (PHYS-02, PHYS-03, PHYS-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Valhalla route + trace_attributes speeds, cache-first elevation, speed overlay (ROUT-01, PHYS-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Sync POST /v1/simulate vertical slice, corridors + terminal catalog, Fastify proxy (PHYS-01, PHYS-05, ROUT-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — Weather presets, port geo-fence, overrides audit trail (PHYS-04, PHYS-07, PHYS-08)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-05-PLAN.md — Validation endpoint, MAPE CI gate, fixture perf smoke, OpenAPI codegen (PHYS-06, ROUT-04)

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

**Plans**: 5 plans

Plans:

**Wave 1**

- [x] 03-01-PLAN.md — Charge curve + greedy HD planner wired into sync simulate (CHRG-01, CHRG-02, CHRG-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Feasibility verdict, infrastructure tiers, segment annotations (CHRG-04, CHRG-05, CHRG-06 doc)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — simulation_runs migration, inputs_hash, Celery worker, internal enqueue (PLAT-02 backend)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-04-PLAN.md — Fastify async job API, cache hit, poll (PLAT-02)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03-05-PLAN.md — Integration gate, OpenAPI codegen, model_assumptions charging section (CHRG-06, PLAT-02)

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

**Plans**: 8/8 plans complete

Plans:

**Wave 0**

- [x] 04-00-PLAN.md — API poll audit metadata + routing proxy (SCEN-04)
- [x] 04-07-PLAN.md — Web deps, brand tokens, /status relocation, lib test scaffolds (SCEN-04)

**Wave 1** *(blocked on Wave 0 completion — Plans 00 + 07)*

- [x] 04-01-PLAN.md — Scenario form, async submit/poll, basic results panel (SCEN-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Mapbox SoC-gradient route and charger markers (MAP-01, MAP-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03-PLAN.md — Recharts SoC profile and map-chart hover sync (MAP-03)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-04-PLAN.md — KPI cards, charging table, assumptions panel (MAP-04, MAP-05, MAP-06)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 04-05-PLAN.md — Comparison tray and sensitivity re-run (SCEN-01, SCEN-02)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 04-06-PLAN.md — CSV/JSON client export and Fastify PDF route (EXPR-01, EXPR-02, EXPR-03)

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
| 2. Physics Simulation Core | 5/5 | Complete   | 2026-07-01 |
| 3. Charging & Job Pipeline | 5/5 | Complete    | 2026-07-01 |
| 4. Analyst Dashboard & Export | 8/8 | Complete   | 2026-07-01 |
| 5. Corridor Intelligence & Emissions | 0/TBD | Deferred (v2.0 in progress) | - |
| 6. TCO Analysis & Production | 0/TBD | Deferred (v2.0 in progress) | - |

---

# Roadmap: Milestone v2.0 — Freight Pulse Network Visualizer

## Overview

Freight Pulse ships as four vertical phases (7–10) delivering a new `/pulse` visualization tab on a parallel stack (Next.js 15 / Vercel / Convex / Google Maps / WorkOS / GSAP) that shares only the existing FleetVolt app shell. Order is demo-protective: foundation + provenance data contract + map (Phase 7) → the pulsing flow engine that is the demo's heartbeat (Phase 8) → clickable hotspots + market sizing (Phase 9) → time controls, Live-mode, and polish (Phase 10). Phases continue numbering from the v1 roadmap; v1 Phases 5–6 remain deferred. Demo target: Friday July 11, 2026. The non-negotiable demo core (framed map + pulsing R/Y/G flows on real corridors + truck marker + clickable solar-charger-rec hotspots + TAM/SAM/SOM readout + sources footer) is front-loaded across Phases 7–9 so a schedule slip drops only the `[stretch]` items (Live mode, last-mile reveal), not the core.

## Phases

- [ ] **Phase 7: Foundation — Shell, Data Contract & Map Base** - `/pulse` route + CAD shell, Convex schema + provenance-first ingestion, sources footer, vector Google Map with West-Coast framing and port anchors
- [ ] **Phase 8: Flow Engine — Pulsing Volume Flows + Truck** - flows on real highway geometry, R/Y/G + width encoding + legend, pulsing animation, leading Class-8 truck marker
- [ ] **Phase 9: Interaction — Hotspots, Callouts & Market Sizing** - clickable typed hotspots, dimension-callout popups, solar-charger site recs, TAM/SAM/SOM overlay toggles + figures
- [ ] **Phase 10: Time, Live Mode & Demo Polish** - 5yr/1yr filter + reactive re-query, [stretch] Live Simulation mode, [stretch] last-mile street routes, accessibility basics, demo hardening

## Phase Details

### Phase 7: Foundation — Shell, Data Contract & Map Base

**Goal**: A BD user can open an authenticated `/pulse` tab and see a West-Coast-framed vector Google Map with port anchors, the Technical Brand Geometry shell, and a persistent sources footer — with all data provenance-tagged in Convex.
**Mode:** mvp
**Depends on**: Nothing new (shares existing app shell; parallel to v1 backend)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-06, SRC-01, SRC-02, SRC-03, SRC-04, FLOW-01, FLOW-02, FLOW-07, DINT-01, DINT-03
**Success Criteria** (what must be TRUE):

  1. `/pulse` route exists with a nav tab inside the existing WorkOS auth boundary, wrapped in TechnicalFrame/SkeuomorphicCard + animated blueprint grid, JetBrains Mono typography, responsive on a laptop
  2. Convex schema (ports, highwaySegments, freightFlows, hotspots, marketSizing, userFilters) is defined and seeded for ≥1 corridor, every quantity carrying `source` + `year` provenance and simulated-vs-measured labeling
  3. A vector Google Map (mapId, cloud CAD styling so default styling does not leak) loads framed on the West Coast with named port anchors and a port selector
  4. A persistent sources footer cites datasets and states the flow animation is illustrative
  5. No live external data pipeline is required — data is precomputed/curated in Convex

**Plans**: TBD
**UI hint**: yes

### Phase 8: Flow Engine — Pulsing Volume Flows + Truck

**Goal**: A BD user watches freight pulse across real West-Coast highway corridors with a Class-8 truck riding the flow — the demo's "wow" moment.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: FLOW-03, FLOW-04, FLOW-05, FLOW-06, DINT-02
**Success Criteria** (what must be TRUE):

  1. Volume-flow lines follow real highway geometry (I-5, I-710, I-110, US-101, etc.), not straight arcs
  2. Flows are color-encoded R/Y/G by congestion state and width-encoded by volume, with a visible legend/key
  3. Flows animate with a pulsing/marching motion conveying direction and intensity, performant on a demo laptop (no React in the frame loop)
  4. A leading Class-8 truck SVG marker rides a selected flow path with correct heading
  5. Flow-rendering approach (native Polyline+GSAP vs deck.gl) resolved via a short spike at plan time

**Plans**: TBD
**UI hint**: yes

### Phase 9: Interaction — Hotspots, Callouts & Market Sizing

**Goal**: A BD user clicks hotspots to see solar-charger deployment recommendations and toggles TAM/SAM/SOM overlays to prove market size — the sales narrative.
**Mode:** mvp
**Depends on**: Phase 8
**Requirements**: HOT-01, HOT-02, HOT-03, HOT-04, MKT-01, MKT-02, MKT-03, DINT-04, DINT-05
**Success Criteria** (what must be TRUE):

  1. Clickable AdvancedMarkerElement hotspots render, typed and visually distinct across queue/parking, congestion, trucking-HQ proximity, and solar-charger recs
  2. Clicking a hotspot opens a dimension-callout popup (engineering-drawing leader lines) with labeled metrics
  3. Solar-charger site-recommendation hotspots show a rationale (proximity scoring) and key figures
  4. A TAM/SAM/SOM readout displays real dollar figures in dimension-callout styling
  5. User can toggle TAM/SAM/SOM overlay layers on/off over the map, with figures appearing in dimension style

**Plans**: TBD
**UI hint**: yes

### Phase 10: Time, Live Mode & Demo Polish

**Goal**: A BD user can reframe the data across time, optionally watch a labeled Live Simulation, and experience a hardened, accessible demo.
**Mode:** mvp
**Depends on**: Phase 9
**Requirements**: TIME-01, TIME-02, TIME-03, HOT-05, SHELL-05, DINT-06, DINT-07
**Success Criteria** (what must be TRUE):

  1. User can switch 5yr/1yr time framings; changing the filter re-queries flow data via reactive Convex state
  2. [stretch] A clearly-labeled "Live Simulation" mode animates a realistic flow ticker (never implying real-time GPS)
  3. [stretch] Zoom/hotspot-click reveals last-mile street-level routes from precomputed, Convex-cached Directions (zero live Directions calls)
  4. Accessibility basics met (keyboard-focusable controls, ≥4.5:1 callout contrast, alt/aria on legend + controls)
  5. Demo hardened: Sentry WebGL context-loss handling, brand-fidelity check vs the design MD, responsive on the demo display

**Plans**: TBD
**UI hint**: yes

## v2.0 Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Foundation — Shell, Data Contract & Map Base | 0/TBD | Not started | - |
| 8. Flow Engine — Pulsing Volume Flows + Truck | 0/TBD | Not started | - |
| 9. Interaction — Hotspots, Callouts & Market Sizing | 0/TBD | Not started | - |
| 10. Time, Live Mode & Demo Polish | 0/TBD | Not started | - |

**Coverage:** 35/35 v2.0 requirements mapped (Phase 7 ×14, Phase 8 ×5, Phase 9 ×9, Phase 10 ×7). Stretch: HOT-05, TIME-02, DINT-07.

---

# Milestone v3.0 — Full Platform Migration

## Overview

Re-platform the **entire** FleetVolt app onto one modern stack: Google Maps +
Google Directions/Routes API + Convex + Vercel. Retire the Docker Compose stack
(PostGIS, Redis, Valhalla, Fastify API, Python simulator, Celery) completely.
This supersedes the v2.0 "parallel stack for /pulse only / sim app untouched"
decisions. See `.planning/MILESTONE-CONTEXT.md` for full scoping + locked decisions.

## Phases

- [ ] **Phase 11: Google Maps App-Wide + Routing Migration** - Mapbox/react-map-gl → Google Maps (all 8 web files); Valhalla → Google Directions/Routes API; retire valhalla service
- [ ] **Phase 12: Convex Data + Spatial Layer** - PostGIS tables → Convex schema; ST_DWithin/ST_Distance → bbox+haversine (or Convex geo component); seed/ingest migration
- [ ] **Phase 13: Physics Engine → Convex Actions** - port 3,454 LOC Python physics/SoC/charging/feasibility → Convex TS actions; retire Celery/sim-worker/Redis; exports into Convex/Vercel
- [ ] **Phase 14: Vercel Deploy + Decommission Docker** - deploy web+Convex to Vercel; prod env/secrets; wire fleetvolt.network; tear down docker-compose; final smoke

## Phase Details

### Phase 11: Google Maps App-Wide + Routing Migration

**Goal**: The whole app renders on Google Maps and routes via Google Directions/Routes API; Valhalla is gone.
**Mode:** mvp
**Depends on**: Nothing (first phase of v3.0)
**Success Criteria** (what must be TRUE):

  1. All 8 web files using Mapbox/react-map-gl render on Google Maps with no visual regression
  2. `route_provider` returns Class-8 truck route geometry from Google Directions/Routes API (POLB→San Bernardino parity)
  3. The `valhalla` Docker service is removed and the stack still boots
  4. Phase-4 `scenario-run` Playwright UAT stays green

**Plans**: TBD

### Phase 12: Convex Data + Spatial Layer

**Goal**: All persistent data (corridors, chargers, trucks, elevation, simulations) lives in Convex with spatial parity.
**Mode:** mvp
**Depends on**: Phase 11
**Success Criteria** (what must be TRUE):

  1. PostGIS tables are represented as Convex schema with equivalent seed/ingest
  2. Nearest-charger and corridor-region queries return parity results vs current PostGIS (`ST_DWithin`/`ST_Distance`)
  3. Elevation profiles available from Convex for POLB/Cajon corridors
  4. Parity tests pass against captured Postgres output
  5. **North-star acceptance test:** the flagship query is answerable from Convex data + spatial queries (charger gap, 5 closest + config, carrier targeting, congested-route ranking, FAF freight context). See `.planning/research/FLAGSHIP-QUERY-VERIFIED.md`.
  6. **Hotspot data + spatial model:** modeled truck parking/dwelling hotspot score (proxies: NATD parking capacity + CalTrans 5-axle AADT + FAF flow density + carrier concentration), US→State→County aggregation, OSM POI extraction (convenience/fuel/amenities), and a per-hotspot report query returning carriers/parking/POIs/chargers/score+inputs/freight-context. (UI + LLM brief = Phase 15.)

**Plans**: TBD

### Phase 13: Physics Engine → Convex Actions

**Goal**: The physics simulation runs entirely as Convex actions with numeric parity to the Python engine; Celery/sim-worker retired.
**Mode:** mvp
**Depends on**: Phase 12
**Success Criteria** (what must be TRUE):

  1. Physics/SoC/charging/feasibility logic runs as Convex TS actions within the 10-min action budget
  2. POLB drayage + Cajon Pass validation cases match Python output within agreed tolerance (energy/SoC ±0.5%, exact on tier/stop count)
  3. Celery worker, sim-worker, and Redis are removed from the stack
  4. CSV/JSON/PDF exports produced via Convex/Vercel path

**Plans**: 5/5 planned

Plans:

**Wave 1**

- [ ] 13-01-PLAN.md — Port Python physics core to Convex TS (constants, types, segment builder, physics engine, SoC integrator, KPIs, weather, speed resolver, overrides, inputs hash)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 13-02-PLAN.md — Convex action wrapper + charging planner + feasibility + orchestrator (the simulate action)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 13-03-PLAN.md — Parity validation: Python vs Convex TS (±0.5% energy/SoC, exact tier/stop count)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 13-04-PLAN.md — Retire Celery/Redis/sim-worker from docker-compose
- [ ] 13-05-PLAN.md — CSV/JSON/PDF exports via Convex/Vercel path

### Phase 14: Vercel Deploy + Decommission Docker

**Goal**: The full app is live on Vercel + Convex at fleetvolt.network with the Docker stack decommissioned.
**Mode:** mvp
**Depends on**: Phases 11–13
**Success Criteria** (what must be TRUE):

  1. Web + Convex deploy to Vercel with production env/secrets; `fleetvolt.network` serves the app
  2. All 8 routes load and function on the production stack
  3. End-to-end scenario run + export works on Vercel/Convex (no Docker)
  4. docker-compose.yml and self-hosted services are decommissioned; README/AGENTS/Makefile updated

**Carried-over obligations from Phase 11 (deferred here):**
  5. **Verify MAP-01/02/03 visually on the deployed app** — SoC-gradient polyline, power-scaled charger markers + popups, hover→chart sync (deferred from Phase 11 because the docker-compose web container can't render end-to-end).
  6. **Fix the web build/proxy** — the current `apps/web/Dockerfile` rewrite is half-finished (omits copying `apps/web/convex/`) and `API_URL` bakes to `localhost:4000` at build time instead of resolving to the API host. Vercel deploy must resolve the API base correctly (no ECONNREFUSED).

**Plans**: TBD

### Phase 15: Hotspot Explorer — Drill-Down UI + Executive Sales Brief

**Goal**: A US→State→County map explorer that pinpoints modeled truck parking/dwelling hotspots; clicking one opens a report (what's there / what's missing / carriers / parking / POIs / chargers) plus an LLM-generated executive sales brief on why the hotspot exists and how favorable it is for the mobile-energy product.
**Mode:** mvp
**Depends on**: Phase 12 (hotspot data+spatial model, report query), Phase 14 (deployed), AI-SPEC (this phase is AI-integration — generate `15-AI-SPEC.md`)
**Success Criteria** (what must be TRUE):

  1. Map view drills US → State → County; modeled hotspots render as clickable pins sized/colored by score (labeled "modeled", not observed)
  2. Clicking a hotspot opens a report populated from the Phase-12 report query: trucking companies, parking areas + capacity, POIs (convenience/fuel/amenities), chargers + Class-8 gap, score + proxy inputs, freight context
  3. "What's missing" surfaces derived gaps (e.g. high score + zero Class-8 charging = mobile-energy opportunity)
  4. An **executive sales brief** is generated per hotspot — why it exists + how friendly to pursue with the mobile-energy product — GROUNDED in the real report data (no fabricated numbers; every claim traces to a data field)
  5. AI-SPEC governs the brief: prompt, grounding contract, guardrails against hallucinated figures, and a "modeled/estimated vs measured" disclosure

**Plans**: TBD

## v3.0 Progress

**Execution Order:**
Phases execute in numeric order: 11 → 12 → 13 → 14 → 15

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 11. Google Maps App-Wide + Routing | DONE | ✅ code verified (visual check deferred to 14) | 2026-07-07 |
| 12. Convex Data + Spatial Layer | 0/TBD | Scoped | - |
| 13. Physics Engine → Convex Actions | 5/5 planned | Planned | - |
| 14. Vercel Deploy + Decommission Docker | 0/TBD | Not started | - |
| 15. Hotspot Explorer (UI + AI sales brief) | 0/TBD | Scoped (new, 2026-07-07) | - |

**Note:** Requirements (REQ-IDs) to be defined at `/gsd-plan-phase` time per phase. This roadmap is the scoping output of the 2026-07-07 migration discussion + the 2026-07-07 hotspot-feature addition (Phase 15).
