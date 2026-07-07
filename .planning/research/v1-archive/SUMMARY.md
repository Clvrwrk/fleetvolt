# Project Research Summary

**Project:** FleetVolt Route
**Domain:** Class 8 EV drayage & corridor energy modeling (physics simulation + PostGIS + map visualization)
**Researched:** 2026-07-01
**Confidence:** HIGH

## Executive Summary

FleetVolt Route is a consulting-grade planning tool at the intersection of commercial EV route planners and corridor infrastructure analysis — purpose-built for POLB drayage and NHFN freight corridors. Industry leaders (NREL FASTSim/RouteE, PTV, TUM BETOS, CHALET) consistently partition these systems into five layers: spatial truth (PostGIS), vehicle physics (Python/NumPy), route generation (Valhalla truck routing), charging feasibility (spatial + rule engine), and presentation (Next.js map/dashboard). FleetVolt's hybrid Node + Python + PostGIS architecture aligns with this pattern and the project's VPS Docker Compose constraint.

The recommended approach is **Python-first simulation core, Node orchestration, bottom-up build order**: populate PostGIS with NHFN/chargers/truck configs → validate segment physics on Cajon Pass → wire elevation + routing → add greedy charger planner → expose via FastAPI/Celery + Fastify → build analyst UI last. v1 should ship a segment-based mesoscopic energy model (not 1 Hz simulation), rule-based charging with piecewise charge curves, transparent editable physics parameters, and consulting-grade PDF export — not black-box OEM-style outputs. Differentiators (NHFN layer, port drayage profile, infrastructure-tier feasibility framing) can follow physics validation gates.

The dominant risks are **physics credibility** (OEM range anchoring, regen over-credit, constant aux load, coarse elevation) and **infrastructure false positives** (unfiltered NREL AFDC, passenger routing profiles, linear charge times). Mitigation is front-loaded: two-tier validation (ideal OEM ±8–12% MAPE + grade-heavy full-payload cases), usable kWh/BMS reserve fields, HD-accessible charger filtering at ingest, Valhalla truck costing from Phase 1, and tiered feasibility labels (`feasible_public_hd` / `feasible_with_depot` / `requires_infrastructure`) rather than binary green/red.

## Key Findings

### Recommended Stack

Hybrid Node + Python on Docker Compose (VPS) is the correct architecture — not a monolith, not serverless. Next.js 16 + React 19 for the desktop-first analyst UI; Fastify 5.9 for thin job orchestration; Python 3.12 + FastAPI 0.138 + Celery 5.6.3 for all physics and spatial computation; PostgreSQL 16 + PostGIS 3.5 as spatial truth; Redis 8 for Celery broker and input-hash result cache; Valhalla (self-hosted) for Class 8 truck routing; Mapbox GL JS for route/SoC visualization.

**Critical queue boundary:** Node never pushes directly to Celery. Node → HTTP → FastAPI → Celery. BullMQ in Node is Phase 2+ for PDF generation only — not physics jobs.

**Core technologies:**
- **Next.js 16.2.9 + React 19.2.7** — Desktop-first map-heavy dashboard, SSR, typed API routes, PWA path
- **Fastify 5.9 + Node 24 LTS** — Low-overhead job submit/poll orchestration without NestJS ceremony
- **Python 3.12 + FastAPI 0.138 + Celery 5.6.3 + NumPy 2.5** — Segment physics, PostGIS queries, async workers; Python 3.12 required for NumPy 2.5
- **PostgreSQL 16 + PostGIS 3.5** — NHFN, chargers, elevation cache, simulation_runs, truck_configs
- **Valhalla (truck costing)** — Native height/weight/axle_count/hazmat — critical for Class 8 corridor realism
- **Mapbox GL JS 3.25 + react-map-gl 8.1** — SoC gradient maps, charger clusters, consulting deliverable polish
- **Zod 4.4 + Pydantic 2.13** — Shared validation contracts across Node and Python (OpenAPI codegen recommended)

**Avoid:** Pure JS physics, dual queue (BullMQ + Celery for same job), 1 Hz simulation loops, MongoDB, Prisma for Python spatial, FASTSim as core engine, real-time OCPI in v1, Vercel/managed cloud for v1.

### Expected Features

FleetVolt sits between PTV-style commercial route planners and NREL corridor tools (EVI-RoadTrip). Users expect physics-based segment energy, elevation integration, payload modeling, truck config library, forward SoC profiles, static charger database, rule-based charging stops, feasibility verdicts, interactive maps, weather presets, charge time estimation, assumptions disclosure, and fast (<10s p95) single-scenario runs.

**Must have (table stakes — v1 launch):**
- Physics segment energy model (elevation, payload, weather presets, regen, aux) — without this, product is a map wrapper
- Truck config library (eCascadia 438 kWh, T680E 375 kWh + editable overrides)
- POLB corridor route input (terminal presets + free O/D + truck routing)
- Forward SoC projection + feasibility verdict (Feasible / Critical / Infeasible)
- Rule-based charging stop recommendations with piecewise charge curves
- NREL AFDC charger layer with MCS/350+ kW filtering and HD accessibility
- Interactive map (route SoC gradient + charger markers) + KPI cards + SoC profile chart
- Scenario comparison (2+ runs) + sensitivity sliders (payload, temp, headwind)
- Export CSV/JSON + PDF with assumptions audit — CleverWork deliverable gate
- Port drayage profile toggle — POLB differentiation vs generic EV routing
- Assumptions log + limitations + "planning tool not dispatch" disclaimers

**Should have (differentiators — v1.x after MAPE gates):**
- Transparent editable physics parameters with audit trail — consulting credibility vs PTV/OEM black-box
- NHFN freight corridor constraint layer — route snap/preference to designated freight network
- Corridor charging gap analysis + infrastructure-tier feasibility tags
- "Feasible today" vs "requires infrastructure" framing — strategic consulting narrative
- Emissions ton-mile comparison (WTW CO₂e) + energy cost per mile — Phase 2 post-simulation modules
- Balanced multi-objective charging optimization — v1.5+ after rule-based validated
- POLB corridor presets + Cajon Pass validation gates (±8–12% MAPE)

**Defer (v2+):**
- Real-time OCPI charger availability, fleet MILP/ALNS optimization, Monte Carlo simulation
- Hydrogen comparator, telematics calibration, mobile driver navigation
- Public API / white-label, depot/yard charging simulation, PWA offline cache
- 450+ vehicle library breadth — deep specs for 2–3 POLB-relevant trucks only

### Architecture Approach

Five-layer pipeline: Presentation (Next.js) → Orchestration (Node Fastify) → Simulation Core (Python FastAPI + Celery workers) → Spatial Data (PostGIS) → Data Ingestion (offline scripts). Python owns all energy/spatial computation; Node owns auth, job lifecycle, caching, PDF queue; PostGIS owns spatial queries via GIST-indexed `ST_DWithin` — not application logic in Python loops.

**Major components:**
1. **Simulation Orchestrator** — Pipeline: route → elevation → discretize → physics → SoC → charger plan → aggregate; injectable modules for vehicle, environment, charging policy
2. **Physics Engine** — Segment-based mesoscopic road-load model (rolling + aero + grade + aux − regen); NumPy vectorized; ~500m segments, ≤200m on grades >3%
3. **Route Provider (adapter)** — Valhalla truck profile; swappable interface for testing with hardcoded POLB corridors
4. **Elevation Service** — USGS 3DEP cached in PostGIS; bilinear sampling; bridge artifact filtering
5. **Charger Planner** — PostGIS spatial search + greedy stop selection; piecewise charge curves; HD-accessible filter
6. **Results Store** — Immutable `simulation_runs` with inputs_hash for cache hits and scenario comparison
7. **Emissions/TCO Module** — Post-simulation only (Phase 2); reads aggregates, no re-route

**Key patterns:** Adapter pattern for external services, input-hash result caching, async job pipeline with observable stages, PostGIS as spatial query engine (not app logic).

### Critical Pitfalls

1. **OEM range validation without matching hidden assumptions** — Two-tier validation: ideal OEM ±8–12% MAPE AND grade-heavy full-payload drayage with conservative bounds; surface OEM assumption deltas in every report
2. **Nominal battery kWh instead of usable energy** — Store `usable_kwh`, `min_soc_operating` (10–15%), `max_soc_charge_target` (80–95%); never project SoC below operating reserve
3. **Constant aux kW ignoring BTMS/HVAC** — Scenario-based aux profiles (`aux_kw_port_idle`, `aux_kw_drayage_moving`, `aux_kw_highway`) + temperature-dependent BTMS multiplier; cold/hot scenarios must change Wh/mi ≥15%
4. **Overestimated regen on long descents** — Cap regen power; disable above SOC threshold; apply regen probability factor; validate Cajon Pass asymmetric outbound/return energy
5. **Unfiltered NREL AFDC as truck-ready truth** — HD accessibility filter at ingest (≥150 kW + pull-through heuristics + manual POLB corridor curation); show `data_as_of` timestamp; separate "technically reachable" from "operationally usable for Class 8"
6. **Passenger routing profiles** — Valhalla truck costing (weight, height, length) from Phase 1; never defer to car profile for POLB validation corridors
7. **Linear charge time (`kWh ÷ kW`)** — Piecewise charge curves per truck model with CC taper; use `min(station_kW, truck_max_accept_kW, BMS_limit(SOC))`

## Implications for Roadmap

Based on research, suggested phase structure follows bottom-up dependency order: spatial truth → physics validation → charging → API → UI → extensions.

### Phase 1: Foundation & Spatial Data
**Rationale:** PostGIS schema and ingestion are prerequisites for everything; truck config schema and HD-filtered charger ingest prevent false feasibility from day one
**Delivers:** Docker Compose (PostGIS, Redis, Valhalla), PostGIS schema (nhfn, chargers, truck_configs, elevation_profiles, simulation_runs), NHFN + NREL AFDC ingest with HD filter, truck config seed (eCascadia, T680E with usable_kwh/reserves), elevation pipeline (3DEP cache for POLB corridors), two-tier validation framework design
**Addresses:** Truck config library, NREL charger database, assumptions schema
**Avoids:** Pitfalls 2 (usable kWh), 5 (elevation quality), 7 (AFDC HD filter), 8 (NHFN data ready), 12 (battery weight penalty in config)

### Phase 2: Simulation Core (Python-first, no UI)
**Rationale:** Physics credibility is the product; must validate before any UI investment
**Delivers:** Physics Engine (segment road-load, port_phase segment type, regen caps, aux profiles), Elevation Service (cache lookup + fetch), Route Provider (Valhalla truck adapter), Simulation Orchestrator (wire pipeline, JSON output), Cajon Pass validation suite (ideal OEM + grade-heavy cases)
**Addresses:** Physics segment energy model, elevation integration, payload modeling, port drayage profile, forward SoC projection
**Avoids:** Pitfalls 1 (OEM validation), 3 (constant aux), 4 (regen overestimate), 8 (passenger routing), 9 (port stop-go), 10 (static payload — support outbound/return)

### Phase 3: Charging & Spatial Intelligence
**Rationale:** Charging logic depends on validated physics SoC profile and filtered charger database
**Delivers:** Charger Planner (PostGIS ST_DWithin + greedy selection + piecewise charge curves), full pipeline with charge-stop re-simulation, input-hash caching in Redis, feasibility verdict (Feasible/Critical/Infeasible), multi-tier feasibility labels
**Addresses:** Rule-based charging stops, feasibility verdict, charge time estimation, corridor gap analysis (v1.x), infrastructure-tier tags
**Avoids:** Pitfalls 6 (linear charge time), 11 (infrastructure reality framing), performance traps (unindexed spatial queries, no caching)

### Phase 4: API & Job Infrastructure
**Rationale:** Frontend needs stable job submit/poll contract; queue boundary must be correct before UI
**Delivers:** Python FastAPI endpoints + Celery worker, Node Fastify orchestrator (submit/poll/results), shared Pydantic/Zod schemas via OpenAPI, observable job stages (routing/elevation/physics/charging)
**Uses:** Fastify 5.9, Celery 5.6.3, Redis 8 (broker db 0, cache db 1)
**Implements:** Orchestration layer, async job pipeline pattern

### Phase 5: Frontend & Analyst UX
**Rationale:** UI last — map/chart sync depends on stable API and validated outputs
**Delivers:** Scenario config form + truck selector, Mapbox map (route SoC gradient, charger markers, NHFN overlay when ready), results dashboard (KPI cards, SoC chart, charge table), scenario comparison (2+ runs), sensitivity sliders, export CSV/JSON + PDF with assumptions audit, assumptions panel + disclaimers
**Addresses:** All P1 table-stakes UX features, consulting deliverable gate
**Avoids:** UX pitfalls (single boolean feasibility, hidden assumptions, no data freshness indicator)

### Phase 6: Extensions & Validation Hardening
**Rationale:** Post-MAPE-gate features that add consulting value without physics risk
**Delivers:** NHFN snap/preference layer, corridor gap analysis view, emissions ton-mile module, energy cost per mile, balanced multi-objective charging (v1.5), interactive stop editing, saved scenarios + auth, PDF via BullMQ/Puppeteer worker
**Addresses:** P2 differentiators, Phase 2–3 PRD items

### Phase Ordering Rationale

- **PostGIS before physics:** Charger search, NHFN overlay, and elevation cache all require spatial schema; ingestion is offline and parallelizable
- **Physics before charging:** SoC profile is input to spatial charger queries; validating physics on Cajon Pass prevents building UI on wrong numbers
- **API before UI:** Pydantic schemas define the contract; map UI spike can use mocks once schemas exist, but production UI waits for validated pipeline
- **Consulting features after credibility:** PDF export and scenario comparison are worthless if physics fails MAPE gates; emissions/TCO deliberately decoupled as post-simulation modules
- **Pitfall prevention is front-loaded:** HD charger filter, usable kWh schema, truck routing profile, and elevation cache are Phase 0–1 gates — not retrofits

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Simulation Core):** OEM charge curve parameters for eCascadia/T680E — sparse public data; may need piecewise approximation from OEM docs + NREL studies
- **Phase 2 (Physics):** BTMS/aux temperature multipliers — NREL/Volvo VNR telematics studies provide bounds but POLB-specific quantification is MEDIUM confidence
- **Phase 3 (Charging):** MCS effective power negotiation (BMS limits vs station nameplate) — needs truck-specific curve research per model
- **Phase 6 (NHFN):** Route snap/preference algorithm — BTS NHFN topology + Valhalla costing integration needs spike

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Docker Compose + PostGIS schema — well-documented, `postgis/postgis:16-3.5` tested combo
- **Phase 4 (API):** Fastify + FastAPI + Celery job pipeline — established microservice pattern
- **Phase 5 (Frontend):** Next.js + Mapbox + Recharts + Zustand — standard dashboard stack; shadcn/ui for analyst UI

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Version-verified against npm/PyPI/GitHub releases (Jun 2026); aligns with PRD constraints and CleverWork VPS pattern |
| Features | MEDIUM | Cross-checked vendor docs, NREL tools, academic drayage research; no hands-on competitor product evaluation |
| Architecture | MEDIUM-HIGH | Cross-verified against NREL/PTV/BETOS/CHALET patterns + FleetVolt project specs; build order well-supported |
| Pitfalls | HIGH (physics/infra); MEDIUM (POLB ops) | Physics and infrastructure pitfalls backed by NREL, Caltrans, San Pedro Bay studies; POLB-specific quantification less certain |

**Overall confidence:** HIGH

### Gaps to Address

- **OEM charge curve data:** eCascadia/T680E piecewise curves may need approximation during Phase 3 planning — validate against OEM technical docs and flag uncertainty in exports
- **POLB terminal dwell times:** Port-specific queue/dwell assumptions need CleverWork domain input during Phase 2 — default to conservative high aux + configurable dwell minutes
- **NHFN route preference algorithm:** Snap vs bias vs hard constraint — spike during Phase 6 planning; v1 can ship route-first without NHFN snap
- **Next.js version in project docs:** PRD references v15; stack research recommends v16 — confirm upgrade path during Phase 1 setup (v16 is direct upgrade with React 19)
- **Exact MAPE targets per corridor:** Cajon Pass ±8–12% is research recommendation; validate against available OEM/pilot data during Phase 2 calibration

## Sources

### Primary (HIGH confidence)
- [next@16.2.9 on npm](https://www.npmjs.com/package/next) — version verified 2026-06-10
- [FastAPI release notes](https://fastapi.tiangolo.com/release-notes/) — v0.138.2
- [Fastify v5.9.0 release](https://github.com/fastify/fastify/releases/tag/v5.9.0)
- [Node.js release schedule](https://github.com/nodejs/Release) — Node 24 Active LTS
- [PostGIS 3.5 release notes](https://postgis.net/docs/manual-3.5/en/release_notes.html)
- [NumPy 2.5.0 / SciPy 1.18.0 releases](https://github.com/numpy/numpy/releases) — Python 3.12+ requirement
- [Valhalla truck costing API](https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/)
- [NREL FASTSim](https://natlabrockies.github.io/fastsim/) — reference architecture for HDV energy modeling
- [NREL RouteE](https://www.nrel.gov/transportation/route-energy-prediction-model) — segment-based energy pattern
- [PTV EV Truck Route Planner](https://www.ptvlogistics.com/en-us/products/ptv-ev-truck-route-planner) — competitor feature baseline
- [NREL EVI-X / EVI-RoadTrip](https://www.nrel.gov/transportation/evi-x) — corridor gap analysis reference
- [Caltrans BEHDT Drayage Routing (CA23-Task3369)](https://dot.ca.gov/-/media/dot-media/programs/research-innovation-system-information/documents/final-reports/ca23-task3369-v2.pdf) — POLB domain requirements
- FleetVolt `PROJECT.md`, `00_PRD_FleetVolt_Route_v2.md`, `01_Technical_Architecture_FleetVolt.md` — internal constraints

### Secondary (MEDIUM confidence)
- [TUM BETOS Framework](https://github.com/TUMFTM/BETOS_Framework) — modular BET simulation structure
- [Amazon CHALET](https://github.com/amzn/chalet-charging-location-for-electric-trucks) — graph-based corridor charging
- [ChargEval / EVI-DSS PostGIS patterns](https://evi-dss.readthedocs.io/en/latest/database.html) — spatial query architecture
- [Moovex EVRP documentation](https://www.moovex.ai/docs/evrp) — charge curves, gradient/temperature modeling
- [Atlas EV Hub MD/HD charging analysis](https://www.cleantrucking.com/infrastructure/charging-infastructure/article/15817068/electric-freight-dashboard-for-ev-trucks-updated) — AFDC filtering limitations
- San Pedro Bay Ports ZE Drayage Feasibility Assessment, 2024 — rated vs real range shortfall
- NACFE Run on Less Mountains, 2026 — BEV terrain efficiency variation

### Tertiary (needs validation during implementation)
- Exact BTMS aux multipliers for eCascadia/T680E at POLB-adjacent temperature ranges — extrapolated from Volvo VNR/NREL studies
- POLB terminal-specific dwell/queue times — requires CleverWork operational input
- MCS effective delivered power curves — sparse OEM public data for 2026

---
*Research completed: 2026-07-01*
*Ready for roadmap: yes*
