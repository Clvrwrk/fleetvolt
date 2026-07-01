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

- [ ] **EXPR-01**: User can export full simulation profile as CSV and JSON with charge events and input hash
- [ ] **EXPR-02**: User can export PDF report with summary KPIs, map snapshot, assumptions table, and limitations
- [ ] **EXPR-03**: Export includes physics parameter snapshot and model version for consulting audit trail

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
| EXPR-01 | Phase 4 | Pending |
| EXPR-02 | Phase 4 | Pending |
| EXPR-03 | Phase 4 | Pending |
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
*Last updated: 2026-07-01 after initial definition*
