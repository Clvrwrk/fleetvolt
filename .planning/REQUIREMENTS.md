# Requirements: FleetVolt Route

**Defined:** 2026-07-01
**Core Value:** A planner or analyst can configure a realistic POLB drayage + inland corridor scenario, run physics-based simulation, see recommended charging stops with transparent assumptions, compare scenarios, and export a defensible report they trust for client or stakeholder decisions.

## v1 Requirements

### Data Foundation

- [x] **DATA-01**: System ingests NHFN freight network shapefiles into PostGIS with spatial indexes for corridor queries
- [x] **DATA-02**: System ingests NREL AFDC high-power chargers with kW, connector type, operator, and HD-accessibility metadata
- [x] **DATA-03**: System seeds truck config library with eCascadia 438 kWh and T680E 375 kWh (usable kWh, regen %, aux kW, drag coeff, charge curves)
- [x] **DATA-04**: System caches elevation profiles per corridor in PostGIS (USGS 3DEP or Open-Elevation) with bridge artifact filtering
- [x] **DATA-05**: Charger database refreshable via scripted weekly update with freshness indicator in UI

### Physics & Simulation

- [x] **PHYS-01**: User can input origin, destination, truck config, payload weight, and departure conditions to run a simulation
- [x] **PHYS-02**: Physics engine computes segment-based energy (rolling + aero + grade + aux − regen) using NumPy vectorized model
- [x] **PHYS-03**: Simulation integrates elevation profiles and demonstrates grade impact on Cajon Pass corridor
- [x] **PHYS-04**: Simulation applies weather presets (Ideal / Hot / Cold / Headwind) affecting battery thermal efficiency
- [x] **PHYS-05**: Simulation projects forward SoC profile and outputs KPIs (total kWh, Wh/mi, regen recovered, total time)
- [x] **PHYS-06**: Physics model validates against OEM ideal-case range within ±8–12% MAPE on reference test cases
- [x] **PHYS-07**: User can enable port drayage profile (stop-go, elevated aux, lower speed cap) for POLB basin segments
- [x] **PHYS-08**: User can override truck physics parameters with reset-to-OEM option and assumptions audit trail

### Routing & Corridors

- [x] **ROUT-01**: System generates Class 8 truck routes via Valhalla with height/weight/axle restrictions
- [x] **ROUT-02**: User can select POLB terminal presets and pre-configured corridor pairs (POLB → Inland Empire, Cajon Pass)
- [ ] **ROUT-03**: System prefers or validates routes against NHFN freight network where data supports
- [x] **ROUT-04**: Simulation completes single scenario in <10 seconds p95 on target VPS hardware

### Charging

- [x] **CHRG-01**: System recommends charging stops when projected SoC drops below configurable threshold (default 15–20%)
- [x] **CHRG-02**: Charger search filters by minimum power tier (350+ kW MCS-aware) and HD accessibility
- [x] **CHRG-03**: System estimates charge dwell time using piecewise SOC-dependent charge curves (not linear kWh/kW)
- [x] **CHRG-04**: System returns feasibility verdict (Feasible / Critical / Infeasible) with SoC deficit if infeasible
- [x] **CHRG-05**: System tags feasibility tier (public_hd / depot_required / infrastructure_gap) not just binary pass/fail
- [x] **CHRG-06**: Balanced multi-objective charging optimization weighs time, energy, and cost tradeoffs

### Visualization

- [x] **MAP-01**: User sees interactive map with route polyline color-coded by SoC gradient
- [x] **MAP-02**: User sees charger markers sized/colored by power level with popup details
- [x] **MAP-03**: User sees SoC/energy profile chart synced with map hover along route
- [x] **MAP-04**: User sees KPI cards (total kWh, Wh/mi, stops, dwell time, final SoC, feasibility verdict)
- [x] **MAP-05**: User sees charging plan table (location, arrival SoC, charge kWh/time, departure SoC)
- [x] **MAP-06**: User sees assumptions & limitations panel with model version and disclaimer

### Scenario Analysis

- [x] **SCEN-01**: User can run and compare 2+ scenarios side-by-side with diff on KPIs and stops
- [x] **SCEN-02**: User can adjust sensitivity sliders (payload, temperature, headwind) and see delta KPIs
- [ ] **SCEN-03**: User can view corridor charging gap analysis highlighting stretches without qualifying chargers
- [x] **SCEN-04**: Simulation results stored immutably with input hash for cache replay and comparison

### Export & Reporting

- [x] **EXPR-01**: User can export full simulation profile as CSV and JSON with charge events and input hash
- [x] **EXPR-02**: User can export PDF report with summary KPIs, map snapshot, assumptions table, and limitations
- [x] **EXPR-03**: Export includes physics parameter snapshot and model version for consulting audit trail

### Emissions & Economics

- [ ] **EMIS-01**: System computes WTW ton-mile CO₂e for CA diesel, national diesel, and EV after simulation
- [ ] **EMIS-02**: System computes energy cost per mile (EV kWh/mi × rate vs diesel gal/mi × price) with CA/national toggle
- [ ] **EMIS-03**: User can enable LCFS credit revenue toggle with configurable credit price
- [ ] **EMIS-04**: System displays rolling cumulative TCO chart (diesel vs EV) with break-even mileage
- [ ] **EMIS-05**: Emissions/TCO assumptions panel shows EPA/CARB/GREET sources and editable lookup values

### Platform & DevOps

- [x] **PLAT-01**: Local development environment runs via Docker Compose (PostGIS, Redis, Valhalla, Python sim, Next.js, Fastify)
- [x] **PLAT-02**: Node Fastify API submits simulation jobs to Python FastAPI/Celery (correct queue boundary)
- [x] **PLAT-03**: CI runs lint, typecheck, and unit tests on physics validation reference cases
- [ ] **PLAT-04**: Production deployment runs on VPS via Docker Compose with documented setup

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Fleet & Operations

- **FLEET-01**: Multi-truck fleet scheduling and MILP/ALNS optimization
- **FLEET-02**: Live OCPI charger availability polling and reservations
- **FLEET-03**: Telematics calibration integration with fleet partner data

### Mobile & Real-Time

- **MOBL-01**: Native mobile driver navigation with turn-by-turn EV guidance
- **MOBL-02**: Real-time SoC countdown and dynamic rerouting around charger outages
- **MOBL-03**: PWA offline cache for remote corridor navigation

### Alt-Fuel & Advanced

- **ALT-01**: Hydrogen fuel cell comparator module (EV baseline vs H₂ energy/time/cost)
- **ALT-02**: Full stochastic Monte Carlo simulation (N=50–100 parameter variations)
- **ALT-03**: Rail/intermodal handoff modeling with terminal dwell chains
- **ALT-04**: Depot charging scheduling and V2G orchestration
- **ALT-05**: Public API and white-label embedding for port partners

### Accounts & Collaboration

- **ACCT-01**: User authentication with saved scenarios and org sharing
- **ACCT-02**: Interactive stop editing (force/remove stops with re-simulation)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time OCPI charger status | Fragmented coverage, integration cost, implies dispatch liability — static AFDC with freshness date |
| Multi-truck fleet MILP optimization | 10× scope vs single-truck; different product category — defer to v2 |
| Hydrogen comparator (v1) | EV baseline must be credible first — confirmed v2 per user decision |
| Native mobile driver navigation | Desktop-first for analysts; PWA viewer only if needed in Phase 3 |
| Per-second physics simulation | Computationally wasteful; segment model achieves target MAPE |
| Google Maps consumer EV routing | Light-duty assumptions, no freight constraints — use Valhalla truck profile |
| Legal/compliance advice (HOS, weight) | Liability exposure — energy/time estimates only with disclaimer |
| 450+ vehicle library | Maintenance burden — deep specs for 2 POLB-relevant trucks only |
| Vercel/AWS managed cloud (v1) | User chose Docker Compose on VPS per CleverWork patterns |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete |
| DATA-05 | Phase 1 | Complete |
| PLAT-01 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |
| PHYS-01 | Phase 2 | Complete |
| PHYS-02 | Phase 2 | Complete |
| PHYS-03 | Phase 2 | Complete |
| PHYS-04 | Phase 2 | Complete |
| PHYS-05 | Phase 2 | Complete |
| PHYS-06 | Phase 2 | Complete |
| PHYS-07 | Phase 2 | Complete |
| PHYS-08 | Phase 2 | Complete |
| ROUT-01 | Phase 2 | Complete |
| ROUT-02 | Phase 2 | Complete |
| ROUT-04 | Phase 2 | Complete |
| CHRG-01 | Phase 3 | Complete |
| CHRG-02 | Phase 3 | Complete |
| CHRG-03 | Phase 3 | Complete |
| CHRG-04 | Phase 3 | Complete |
| CHRG-05 | Phase 3 | Complete |
| CHRG-06 | Phase 3 | Complete |
| PLAT-02 | Phase 3 | Complete |
| MAP-01 | Phase 4 | Complete |
| MAP-02 | Phase 4 | Complete |
| MAP-03 | Phase 4 | Complete |
| MAP-04 | Phase 4 | Complete |
| MAP-05 | Phase 4 | Complete |
| MAP-06 | Phase 4 | Complete |
| SCEN-01 | Phase 4 | Complete |
| SCEN-02 | Phase 4 | Complete |
| SCEN-04 | Phase 4 | Complete |
| EXPR-01 | Phase 4 | Complete |
| EXPR-02 | Phase 4 | Complete |
| EXPR-03 | Phase 4 | Complete |
| ROUT-03 | Phase 5 | Pending |
| SCEN-03 | Phase 5 | Pending |
| EMIS-01 | Phase 5 | Pending |
| EMIS-02 | Phase 5 | Pending |
| EMIS-03 | Phase 5 | Pending |
| EMIS-04 | Phase 6 | Pending |
| EMIS-05 | Phase 6 | Pending |
| PLAT-04 | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-01*
*Last updated: 2026-07-06 — added v2.0 Freight Pulse milestone requirements below*

---

# Milestone v2.0 — Freight Pulse Network Visualizer

**Defined:** 2026-07-06
**Milestone Core Value:** A business-development user can open the `/pulse` tab, watch West-Coast freight movement pulse across real highway corridors, toggle market-sizing overlays, click hotspots to see solar-charger deployment recommendations, and — within 30 seconds — believe the opportunity is real and sellable. Built on a parallel stack (Next.js 15 / Vercel / Convex / Google Maps / WorkOS / GSAP) sharing only the existing app shell.

**Scope decision:** FULL scope — all 6 categories including differentiators. Research-flagged cuttable items (Live simulation mode, last-mile street reveal, extended hotspot taxonomy) are included but tagged **[stretch]** = demo-optional; the demo core must survive any slip.

**Demo-core (non-negotiable):** framed map + pulsing R/Y/G flows on real corridors + Class-8 truck marker + clickable solar-charger-rec hotspots + TAM/SAM/SOM readout + sources footer.

## v2.0 Requirements

### Map & Flow Engine

- [ ] **FLOW-01**: User sees an interactive Google Map (vector `mapId`, pan/zoom) framed on the West Coast with California ports in view on load
- [ ] **FLOW-02**: User sees named port anchors (POLA, POLB, Port Hueneme, Oakland, SF, San Diego) with a selector to focus/filter by port
- [ ] **FLOW-03**: User sees freight volume-flow lines drawn on real highway geometry (e.g. I-5, I-710, I-110, US-101) rather than straight arcs
- [ ] **FLOW-04**: Flow lines are color-encoded R/Y/G by congestion/utilization state and width-encoded by volume, with a visible legend/key
- [ ] **FLOW-05**: Flow lines animate with a pulsing/marching motion conveying direction and intensity
- [ ] **FLOW-06**: A leading Class-8 truck SVG marker rides along a selected flow path with correct heading
- [ ] **FLOW-07**: The map renders in the Technical Brand Geometry aesthetic (vector cloud styling so default Google styling does not leak through)

### Hotspots & Recommendations

- [ ] **HOT-01**: User sees clickable hotspot markers on the map (AdvancedMarkerElement)
- [ ] **HOT-02**: Clicking a hotspot opens a dimension-callout popup (engineering-drawing style with leader lines) showing labeled metrics
- [ ] **HOT-03**: User sees solar-charger site-recommendation hotspots with a rationale (queue/HQ/congestion proximity) and key figures
- [ ] **HOT-04**: Hotspots are typed and visually distinct across queue/parking, congestion, trucking-HQ proximity, and solar-charger recs
- [ ] **HOT-05 [stretch]**: Zooming in or clicking a hotspot reveals last-mile street-level routes (precomputed Google Directions, cached in Convex)

### Market Sizing

- [ ] **MKT-01**: User sees a TAM/SAM/SOM readout with real dollar figures in dimension-callout styling
- [ ] **MKT-02**: User can toggle TAM/SAM/SOM overlay layers on/off over the live map
- [ ] **MKT-03**: Market-sizing figures update/display visually when overlays are toggled (numbers appear in dimension style)

### Time Controls

- [ ] **TIME-01**: User can switch between 5-year and 1-year historical time framings, re-querying the displayed flow data
- [ ] **TIME-02 [stretch]**: User can enable a "Live Simulation" mode (clearly labeled as simulated) that animates a realistic ticker of flows driven by historical + traffic data
- [ ] **TIME-03**: Changing the time filter updates the animation/flow display via reactive Convex query state

### Data & Sourcing

- [ ] **SRC-01**: Every rendered quantity carries provenance metadata (`source` enum + `year`); simulated values are marked distinctly from measured ones
- [ ] **SRC-02**: A persistent, always-visible sources footer cites the datasets (FAF5/BTS, Caltrans AADT/GIS, PeMS, FHWA, FMCSA, port stats) and states that flow animation is illustrative
- [ ] **SRC-03**: Curated freight datasets (ports, highway segments, flows by period, hotspots, market sizing) are ingested into Convex with no live external pipeline required for the demo
- [ ] **SRC-04**: "Live" mode and simulated flows are labeled so no viewer mistakes them for real-time GPS tracking

### Shell / Chrome

- [ ] **SHELL-01**: A new `/pulse` route exists in the app shell with a navigation tab, inside the existing WorkOS auth boundary
- [ ] **SHELL-02**: The surface uses a TechnicalFrame/SkeuomorphicCard container and an animated blueprint-grid background (rendered off the GL canvas)
- [ ] **SHELL-03**: All labels/metrics use JetBrains Mono with the CAD/blueprint treatment per the design MD
- [ ] **SHELL-04**: The layout is responsive for a laptop/large-display demo
- [ ] **SHELL-05**: Accessibility basics are met (keyboard-focusable controls, ≥4.5:1 contrast on callouts, alt/aria labels on legend and controls)
- [ ] **SHELL-06**: A control panel hosts the port selector, time filter, and overlay toggles in the Technical Brand Geometry style

### Data Intelligence

- [ ] **DINT-01**: Every ingested/fetched record carries a `provenance` object `{source, fetchedAt, usefulnessScore, matchMethod}` persisted in Convex
- [ ] **DINT-02**: The flow engine computes pulse intensity/color/truck-speed from a static-base × dynamic-congestion blend (`pulse_intensity = static_volume × (1 + congestion_factor)`), with the formula and its inputs recorded per segment
- [ ] **DINT-03**: A 0–10 usefulness rubric (volume relevance, geospatial joinability, freshness, truck-specific granularity) is applied to each dataset at ingest and stored, replacing any hardcoded assumed score
- [ ] **DINT-04**: A "Data Quality Inspector" drawer (collapsed by default, skeuomorphic technical style) shows a raw sample, column audit (coverage %/nulls/date range), usefulness score, and provenance for the active layers
- [ ] **DINT-05**: User can switch matching mode: "Static Only" / "Hybrid" / "Live Priority"
- [ ] **DINT-06**: On API/fetch failure the surface falls back to the last cached static data and displays an orange "Simulated" badge (never a silent stale render)
- [ ] **DINT-07 [stretch]**: Live signals (Google Traffic, Caltrans PeMS, 511.org events) feed the dynamic congestion tint when credentials/approvals are available

## v2.0 Out of Scope

| Feature | Reason |
|---------|--------|
| Live external freight-data ingestion (AIS, BTS live, carrier TMS) | Days of fragile integration; use curated/precomputed data for the demo |
| Editable assumption sliders / what-if market modeling | State/validation rabbit hole; BD only needs to show numbers Friday |
| Nationwide / global coverage | Scope is CA-first West Coast; more geography = more curation, no demo payoff |
| User accounts, saved scenarios, PDF/PPT export | No persistence needed for a live demo; fast-follow if the deal advances |
| Full WCAG AA conformance / screen-reader parity | Keep basics only; formal audit out of scope for a 5-day internal demo |
| Mobile-phone-optimized layout | Demo runs on laptop/large display |
| Deep multi-level nested drill-down overlays | Single TAM/SAM/SOM level is enough; recursion is scope creep |
| Standalone backend service/DB for /pulse | Convex + precomputed data covers the demo; no PostGIS/Valhalla dependency |
| Audited historical-accuracy guarantees | Data is representative/illustrative and labeled; precision claims add liability with no demo benefit |
| Live per-render Directions API calls | Paid legacy SKU + quota risk mid-demo; precompute and cache instead |

## v2.0 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FLOW-01 | Phase 7 | Pending |
| FLOW-02 | Phase 7 | Pending |
| FLOW-07 | Phase 7 | Pending |
| SRC-01 | Phase 7 | Pending |
| SRC-02 | Phase 7 | Pending |
| SRC-03 | Phase 7 | Pending |
| SRC-04 | Phase 7 | Pending |
| SHELL-01 | Phase 7 | Pending |
| SHELL-02 | Phase 7 | Pending |
| SHELL-03 | Phase 7 | Pending |
| SHELL-04 | Phase 7 | Pending |
| SHELL-06 | Phase 7 | Pending |
| FLOW-03 | Phase 8 | Pending |
| FLOW-04 | Phase 8 | Pending |
| FLOW-05 | Phase 8 | Pending |
| FLOW-06 | Phase 8 | Pending |
| HOT-01 | Phase 9 | Pending |
| HOT-02 | Phase 9 | Pending |
| HOT-03 | Phase 9 | Pending |
| HOT-04 | Phase 9 | Pending |
| MKT-01 | Phase 9 | Pending |
| MKT-02 | Phase 9 | Pending |
| MKT-03 | Phase 9 | Pending |
| TIME-01 | Phase 10 | Pending |
| TIME-02 [stretch] | Phase 10 | Pending |
| TIME-03 | Phase 10 | Pending |
| HOT-05 [stretch] | Phase 10 | Pending |
| SHELL-05 | Phase 10 | Pending |
| DINT-01 | Phase 7 | Pending |
| DINT-03 | Phase 7 | Pending |
| DINT-02 | Phase 8 | Pending |
| DINT-04 | Phase 9 | Pending |
| DINT-05 | Phase 9 | Pending |
| DINT-06 | Phase 10 | Pending |
| DINT-07 [stretch] | Phase 10 | Pending |

**Coverage:**

- v2.0 requirements: 35 total (FLOW ×7, HOT ×5, MKT ×3, TIME ×3, SRC ×4, SHELL ×6, DINT ×7)
- Mapped to phases: 35 (Phase 7 ×14, Phase 8 ×5, Phase 9 ×9, Phase 10 ×7) ✓
- Stretch/demo-optional: HOT-05, TIME-02, DINT-07

---
*v2.0 requirements defined: 2026-07-06*

---

## v3.0 Full Platform Migration — Phase 12 Requirements

Net-new requirements for the Convex Data + Spatial Layer. **Prefix `CVX-*` is deliberately distinct** from the completed Phase-1 `DATA-01..05` (Data Foundation) and Phase-9 `HOT-01..05` (/pulse hotspots) families to avoid traceability collisions. `SPATIAL-*`, `INGEST-*`, `REPORT-*`, `FLAGSHIP-*` are new families introduced this milestone.

| ID | Requirement | Phase | Plan | Status |
|----|-------------|-------|------|--------|
| CVX-SCHEMA-01 | Converged Convex schema unifying Phase-7 /pulse tables + PostGIS simulator tables; provenance on all data tables; simulations metadata-only (results deferred to Phase 13) | 12 | 12-01 | Pending |
| SPATIAL-00 | Swappable spatial module abstraction (component vs hand-rolled) | 12 | 12-01/02 | Pending |
| SPATIAL-01 | `@convex-dev/geospatial` nearest() for point data (chargers/carriers/parking/ports) | 12 | 12-02 | Pending |
| SPATIAL-02 | Hand-rolled bbox+haversine for line/segment data; PostGIS parity gate (set membership + 0.1mi) | 12 | 12-02 | Pending |
| SPATIAL-03 | Live end-to-end nearest-charger parity on ingested data | 12 | 12-04 | Pending |
| SPATIAL-04 | Corridor-region query (bbox) for CalTrans segments | 12 | 12-06 | Pending |
| INGEST-01 | FAF5 metadata + CFS↔FAF crosswalk lookup tables | 12 | 12-03 | Pending |
| INGEST-02 | FAF5 2018-2024 actuals filtered to zone 061 outbound (explicit ktons units) | 12 | 12-03 | Pending |
| INGEST-03 | Live AFDC charger ingest via developer.nlr.gov | 12 | 12-04 | Pending |
| INGEST-04 | POLB carrier registry ingest + geocode + corridor-city tag | 12 | 12-05 | Pending |
| INGEST-05 | CalTrans Truck AADT (5-axle truckAADT DISTINCT from aadt) → highwaySegments | 12 | 12-06 | Pending |
| INGEST-06 | NATD truck-stop parking (capacity) ingest | 12 | 12-07 | Pending |
| INGEST-07 | OSM POI extraction (convenience/fuel/rest-area/hgv-parking) → pois | 12 | 12-07 | Pending |
| CVX-CHARGER-01 | Class-8 charger tag (max power_kw ≥350 AND max_vehicle_class MD/HD); re-satisfies DATA-02/DATA-05 on Convex + nrel→nlr dead-domain fix | 12 | 12-04 | Pending |
| CVX-CARRIER-01 | Geocoded carrier density queryable by corridor city | 12 | 12-05 | Pending |
| CVX-HOTSPOT-01 | Modeled hotspot score from proxies; labeled "modeled" (never "observed"); provenance{method:"modeled",inputs} | 12 | 12-08 | Pending |
| CVX-HOTSPOT-02 | US→State→County geo aggregation (Census FIPS) | 12 | 12-08 | Pending |
| REPORT-01 | Per-hotspot report query (carriers/parking/pois/chargers+class8gap/score+inputs/freightContext) — backs flagship + Phase-15 | 12 | 12-08 | Pending |
| FLAGSHIP-01 | North-star flagship query answerable from Convex (charger gap, 5 closest+config, carrier targeting, congested-route ranking, FAF context); detour/CO₂ deferred to Phase 13 | 12 | 12-08 | Pending |

*v3.0 Phase-12 requirements registered: 2026-07-07*

---

## v3.1 Persistent Route Intelligence — Phase 19 Requirements

| ID | Requirement | Phase | Plan | Status |
|----|-------------|-------|------|--------|
| ROUTE-INTEL-01 | Persist one independently freshened enrichment snapshot per directional route request hash without modifying cached geometry | 19 | 19-01 | Complete |
| ROUTE-INTEL-02 | Match Caltrans 5-axle truck AADT and route labels to the actual persisted road polyline within a documented corridor tolerance | 19 | 19-01 | Complete |
| ROUTE-INTEL-03 | Attach AFDC chargers, honest Class 8 gap, NATD parking, OSM truck amenities, carriers, and FleetVolt fleet yards by road-polyline proximity | 19 | 19-01 | Complete |
| ROUTE-INTEL-04 | Attach FAF annual freight context with explicit regional scope and units; never present it as road-segment or daily measured traffic | 19 | 19-01 | Complete |
| ROUTE-INTEL-05 | Return provenance, coverage, unavailable reasons, freshness, access/refresh counters, and cache receipts for every enrichment snapshot | 19 | 19-01 | Complete |

*v3.1 Phase-19 requirements registered: 2026-07-11*
