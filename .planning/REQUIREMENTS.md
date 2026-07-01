# Requirements: FleetVolt Route

**Defined:** 2026-07-01
**Core Value:** A planner or analyst can configure a realistic POLB drayage + inland corridor scenario, run physics-based simulation, see recommended charging stops with transparent assumptions, compare scenarios, and export a defensible report they trust for client or stakeholder decisions.

## v1 Requirements

### Data Foundation

- [ ] **DATA-01**: System ingests NHFN freight network shapefiles into PostGIS with spatial indexes for corridor queries
- [ ] **DATA-02**: System ingests NREL AFDC high-power chargers with kW, connector type, operator, and HD-accessibility metadata
- [x] **DATA-03**: System seeds truck config library with eCascadia 438 kWh and T680E 375 kWh (usable kWh, regen %, aux kW, drag coeff, charge curves)
- [ ] **DATA-04**: System caches elevation profiles per corridor in PostGIS (USGS 3DEP or Open-Elevation) with bridge artifact filtering
- [ ] **DATA-05**: Charger database refreshable via scripted weekly update with freshness indicator in UI

### Physics & Simulation

- [ ] **PHYS-01**: User can input origin, destination, truck config, payload weight, and departure conditions to run a simulation
- [ ] **PHYS-02**: Physics engine computes segment-based energy (rolling + aero + grade + aux − regen) using NumPy vectorized model
- [ ] **PHYS-03**: Simulation integrates elevation profiles and demonstrates grade impact on Cajon Pass corridor
- [ ] **PHYS-04**: Simulation applies weather presets (Ideal / Hot / Cold / Headwind) affecting battery thermal efficiency
- [ ] **PHYS-05**: Simulation projects forward SoC profile and outputs KPIs (total kWh, Wh/mi, regen recovered, total time)
- [ ] **PHYS-06**: Physics model validates against OEM ideal-case range within ±8–12% MAPE on reference test cases
- [ ] **PHYS-07**: User can enable port drayage profile (stop-go, elevated aux, lower speed cap) for POLB basin segments
- [ ] **PHYS-08**: User can override truck physics parameters with reset-to-OEM option and assumptions audit trail

### Routing & Corridors

- [ ] **ROUT-01**: System generates Class 8 truck routes via Valhalla with height/weight/axle restrictions
- [ ] **ROUT-02**: User can select POLB terminal presets and pre-configured corridor pairs (POLB → Inland Empire, Cajon Pass)
- [ ] **ROUT-03**: System prefers or validates routes against NHFN freight network where data supports
- [ ] **ROUT-04**: Simulation completes single scenario in <10 seconds p95 on target VPS hardware

### Charging

- [ ] **CHRG-01**: System recommends charging stops when projected SoC drops below configurable threshold (default 15–20%)
- [ ] **CHRG-02**: Charger search filters by minimum power tier (350+ kW MCS-aware) and HD accessibility
- [ ] **CHRG-03**: System estimates charge dwell time using piecewise SOC-dependent charge curves (not linear kWh/kW)
- [ ] **CHRG-04**: System returns feasibility verdict (Feasible / Critical / Infeasible) with SoC deficit if infeasible
- [ ] **CHRG-05**: System tags feasibility tier (public_hd / depot_required / infrastructure_gap) not just binary pass/fail
- [ ] **CHRG-06**: Balanced multi-objective charging optimization weighs time, energy, and cost tradeoffs

### Visualization

- [ ] **MAP-01**: User sees interactive map with route polyline color-coded by SoC gradient
- [ ] **MAP-02**: User sees charger markers sized/colored by power level with popup details
- [ ] **MAP-03**: User sees SoC/energy profile chart synced with map hover along route
- [ ] **MAP-04**: User sees KPI cards (total kWh, Wh/mi, stops, dwell time, final SoC, feasibility verdict)
- [ ] **MAP-05**: User sees charging plan table (location, arrival SoC, charge kWh/time, departure SoC)
- [ ] **MAP-06**: User sees assumptions & limitations panel with model version and disclaimer

### Scenario Analysis

- [ ] **SCEN-01**: User can run and compare 2+ scenarios side-by-side with diff on KPIs and stops
- [ ] **SCEN-02**: User can adjust sensitivity sliders (payload, temperature, headwind) and see delta KPIs
- [ ] **SCEN-03**: User can view corridor charging gap analysis highlighting stretches without qualifying chargers
- [ ] **SCEN-04**: Simulation results stored immutably with input hash for cache replay and comparison

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
- [ ] **PLAT-02**: Node Fastify API submits simulation jobs to Python FastAPI/Celery (correct queue boundary)
- [ ] **PLAT-03**: CI runs lint, typecheck, and unit tests on physics validation reference cases
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
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Pending |
| DATA-05 | Phase 1 | Pending |
| PLAT-01 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Pending |
| PHYS-01 | Phase 2 | Pending |
| PHYS-02 | Phase 2 | Pending |
| PHYS-03 | Phase 2 | Pending |
| PHYS-04 | Phase 2 | Pending |
| PHYS-05 | Phase 2 | Pending |
| PHYS-06 | Phase 2 | Pending |
| PHYS-07 | Phase 2 | Pending |
| PHYS-08 | Phase 2 | Pending |
| ROUT-01 | Phase 2 | Pending |
| ROUT-02 | Phase 2 | Pending |
| ROUT-04 | Phase 2 | Pending |
| CHRG-01 | Phase 3 | Pending |
| CHRG-02 | Phase 3 | Pending |
| CHRG-03 | Phase 3 | Pending |
| CHRG-04 | Phase 3 | Pending |
| CHRG-05 | Phase 3 | Pending |
| CHRG-06 | Phase 3 | Pending |
| PLAT-02 | Phase 3 | Pending |
| MAP-01 | Phase 4 | Pending |
| MAP-02 | Phase 4 | Pending |
| MAP-03 | Phase 4 | Pending |
| MAP-04 | Phase 4 | Pending |
| MAP-05 | Phase 4 | Pending |
| MAP-06 | Phase 4 | Pending |
| SCEN-01 | Phase 4 | Pending |
| SCEN-02 | Phase 4 | Pending |
| SCEN-04 | Phase 4 | Pending |
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
