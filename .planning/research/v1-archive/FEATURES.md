# Feature Research

**Domain:** Class 8 EV drayage & corridor energy modeling (POLB-focused freight planning)
**Researched:** 2026-07-01
**Confidence:** MEDIUM (cross-checked vendor docs, NREL tools, academic drayage research; no hands-on product evaluation)

## Feature Landscape

Products in this space cluster into four archetypes, each with a different feature emphasis:

| Archetype | Examples | Primary features |
|-----------|----------|------------------|
| **Commercial EV route planners** | PTV EV Truck Route Planner, Pathfinder, AmpTrans eFleetPlan, Moovex EVRP | Route + energy + charging stops + vehicle library + scenario comparison |
| **OEM/telematics portals** | Detroit Connect eRange (eCascadia), Kenworth/PACCAR connected services | Trip range prediction, what-if scenarios, depot CMS — black-box, single-OEM |
| **Infrastructure/network planners** | NREL EVI-RoadTrip, HEVII, EPRI eRoadMAP, EC Electric Freight Dashboard | Corridor gap analysis, grid load, fleet-wide charger placement — not single-trip dispatch |
| **Depot/yard simulators** | ChargeSim eYardPlanner/eDepotPlanner | Yard layout, shift schedules, depot charger sizing — not over-the-road corridor |

FleetVolt Route sits at the intersection of commercial route planners and consulting-grade corridor tools, with POLB drayage and NHFN freight constraints as the wedge.

---

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unusable for freight EV planning.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Origin–destination route input** | Every competitor starts with O/D; planners think in lanes, not abstract energy curves | LOW | Must support lat/lon, address search, and POLB terminal presets. Truck routing profile (weight, height, hazmat exclusions) is freight table stakes, not optional. |
| **Physics-based segment energy model** | Spreadsheets fail on grades; OEM range claims are ideal-condition only. PTV, HERE, Moovex all expose consumption models | HIGH | Rolling resistance, aero, grade (potential/kinetic), aux load, regen efficiency. Segment-based (not 1-second loop) is acceptable if validated. |
| **Elevation/topography integration** | Cajon Pass and Tehachapi are make-or-break for POLB corridors; grade without elevation data is worthless | MEDIUM | Open-Elevation or cached corridor profiles. Must visibly show elevation impact in results. |
| **Payload / weight input** | Class 8 range swings 30–50% empty vs loaded; PTV, HERE, Moovex, Detroit eRange all model load | LOW | GCW or % payload; affects rolling resistance and regen. Default to realistic drayage loads (40k–80k lb). |
| **Truck configuration library** | Users won't hand-enter 20 parameters every run; PTV offers 450+ twins, OEM portals ship pre-configured models | MEDIUM | Seed eCascadia 438 kWh + T680E 375 kWh with public specs. Allow param overrides with "reset to OEM." |
| **Forward SoC / energy profile** | Planners need to see battery drain over distance/time, not just endpoint range | MEDIUM | Time-series or distance-series SoC array; sync with map hover. KPI cards: total kWh, Wh/mi, net vs regen. |
| **Charger database (static)** | Route feasibility depends on where MCS/DCFC exists; NREL AFDC is industry standard | MEDIUM | PostGIS point layer with kW, connector type (CCS/MCS), operator. Weekly refresh with freshness indicator. |
| **Rule-based charging stop recommendations** | "Where do I charge?" is the core JTBD for dispatch planners | HIGH | Trigger at configurable min SoC (15–20%); search qualifying chargers near route; estimate dwell from power-limited charge curve with taper. |
| **Feasibility verdict** | Binary answer to "can this truck make this move?" — PTV colors routes green/red; Pathfinder flags profitable lanes | LOW | Explicit: Feasible / Critical (low arrival SoC) / Infeasible + kWh or SoC deficit at destination. |
| **Interactive map visualization** | Spatial context is non-negotiable for corridor and port work | MEDIUM | Route polyline with SoC color gradient; charger markers sized by kW; popups for stop details. |
| **Weather / temperature adjustment** | Cold and headwind materially affect HD EV range; all major tools model this | MEDIUM | v1: preset scenarios (Ideal / Hot / Cold / Headwind). Live weather pull is P2. |
| **Charge time estimation** | Dwell time drives dispatch feasibility; linear "kWh ÷ kW" is misleading | MEDIUM | SOC-dependent charge curves per truck model; note taper above 80% SoC. |
| **Configurable min arrival SoC** | Range anxiety buffer; Moovex defaults 10–20%, PTV allows custom thresholds | LOW | Departure SoC, min en-route SoC, target post-charge SoC. |
| **Assumptions & limitations disclosure** | Freight EV modeling is estimate-only; liability and credibility require transparency | LOW | In-UI panel + export footer: model version, param snapshot, known error sources, "planning tool not dispatch" disclaimer. |
| **Results export (CSV/JSON minimum)** | Analysts extend outputs in Excel/Python for client work | LOW | Full segment profile + charge events + input hash. PDF is expected for consulting deliverables (P1 for CleverWork use case). |
| **Single-scenario run in <10s** | Interactive what-if requires fast feedback; PRD targets p95 <10s | MEDIUM | Queue/cache heavy jobs; segment resolution tradeoff documented. |

---

### Differentiators (Competitive Advantage)

Features that set FleetVolt apart. Not universally expected, but high value for POLB drayage + corridor consulting.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Transparent, editable physics parameters** | PTV/OEM tools are black-box; consultants need to defend assumptions to clients and regulators | MEDIUM | Expose drag coeff, regen %, aux kW, drive efficiency with tooltips citing sources. Audit trail in exports. |
| **NHFN freight corridor constraint layer** | Generic EV routing ignores designated freight network; BTS NHFN shapefiles are a POLB/hinterland differentiator | HIGH | Route snap/preference to NHFN; flag when route deviates from freight network. No consumer tool does this well. |
| **Port drayage operational profile** | Stop-go, terminal dwell aux, lower average speed in POLB basin — absent from PTV/HERE/Moovex | MEDIUM | Configurable "port phase" segment modifier: aux kW uplift, speed cap, idle time penalty. Critical for POLB validation. |
| **"Feasible today" vs "requires infrastructure" framing** | 2026 MCS sparse; tools that silently show infeasible routes as failures miss the consulting narrative | LOW | Tag results: Public-charging-feasible / Depot-charging-required / Infrastructure-gap-blocked. Surfaces strategic ask, not just NO. |
| **Corridor charging gap analysis** | NREL EVI-RoadTrip does this at network scale; no polished single-route tool exposes gaps for analysts | MEDIUM | Highlight route stretches >X miles without qualifying kW charger under current payload/SoC assumptions. |
| **Scenario comparison (2+ side-by-side)** | Fleet transition work is inherently comparative (truck A vs B, summer vs winter, 40k vs 80k lb) | MEDIUM | Diff view on KPIs, energy, stops, feasibility. PTV supports vehicle swap; few tools do structured multi-scenario diff. |
| **Sensitivity sliders (payload, temp, headwind)** | Quick uncertainty exploration without full Monte Carlo; answers "how fragile is this lane?" | LOW | Single-parameter sweeps with delta KPIs. Validates consulting narrative without stochastic complexity. |
| **POLB corridor presets & validation gates** | Reduces time-to-insight for CleverWork's core engagements; Cajon Pass reference case is a credibility anchor | MEDIUM | Pre-seeded O/D pairs (POLB terminal → San Bernardino, Cajon grade route); validation against OEM claims ±8–12% MAPE. |
| **MCS-aware charger filtering (350+ kW)** | Class 8 corridor dwell economics depend on megawatt charging availability, not generic "DCFC" | LOW | Filter/annotate by power tier; distinguish depot-only vs public MCS vs CCS-only sites. |
| **Exportable PDF report with assumptions audit** | Client deliverable in <30 min is Core Value; spreadsheets + screenshots don't scale for consulting | MEDIUM | Summary KPIs, map snapshot, assumptions table, limitations, version hash. |
| **Emissions ton-mile comparison (WTW CO₂e)** | Policy/RFP work requires diesel baseline vs EV; EPA/CARB/GREET-aligned lookup tables | MEDIUM | Phase 2: CA diesel vs national diesel vs EV grid mix. Post-simulation module, low physics risk. |
| **Energy cost per mile + LCFS toggle** | TCO conversations are table stakes for fleet transition advisory in California | MEDIUM | Phase 2–3: $/mi energy, optional LCFS credit revenue, rolling cumulative TCO chart. |
| **Balanced multi-objective charging optimization** | PTV optimizes charging time; dispatchers also care about energy and cost tradeoffs | HIGH | v1.5+: fastest / lowest-energy / lowest-cost / balanced weighting. v1 rule-based is acceptable if labeled. |
| **Interactive stop editing (force/remove stops)** | Planners override algorithm when they know a depot stop is planned | MEDIUM | Phase 3: re-simulate from edited stop. Differentiates from pure API black-box. |
| **Consulting-oriented UX (glossary, example scenarios, tooltips)** | Adoption risk if output feels academic; co-design with analysts per PRD risk register | LOW | Example: "POLB → Inland Empire, 40k lb, summer" one-click demo scenario. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for a narrow, credible v1.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time OCPI charger availability / reservations** | Dispatch wants "can I charge there *right now*?" | Fragmented OCPI coverage, stale data, integration cost, implies operational dispatch liability | Static NREL AFDC with freshness date + "planning assumption" label; defer live status to v2+ |
| **Multi-truck fleet MILP/ALNS optimization** | "Optimize my whole fleet" is seductive for port engagements | 10× scope vs single-truck sim; needs telematics, scheduling, HOS — different product | Single-truck simulation with scenario comparison; fleet module v2+ after physics validated |
| **Full stochastic Monte Carlo simulation** | Uncertainty quantification sounds rigorous | Computationally expensive, hard to explain to dispatch users, masks physics calibration gaps | Sensitivity sliders on payload/temp/headwind; Monte Carlo lite (N=50) as v1.5 optional |
| **Native mobile driver navigation** | Drivers want turn-by-turn with SoC | Different UX, safety, map licensing, real-time ops scope | Desktop-first; PWA read-only results viewer in Phase 3 if needed |
| **Hydrogen / alt-fuel comparator module** | POLB strategy work includes H₂ counter-scenarios | Doubles validation surface before EV baseline is credible | EV baseline first (v1); hydrogen module v2 after MAPE gates pass |
| **Rail/intermodal handoff modeling** | Port work involves rail legs | Scope explosion (rail schedules, chassis pools, terminal dwell chains) | Truck leg only; terminal dwell as configurable fixed aux load |
| **Depot charging scheduling / V2G / smart charge orchestration** | OEM CMS (Detroit Connect) markets this | Different domain (depot ops, utility DR); ChargeSim/eYardPlanner owns yard simulation | Note depot charging as user assumption; link to depot tools externally |
| **Live traffic rerouting during trip** | Matches consumer EV nav expectations | Real-time ops product; conflicts with "planning tool" positioning and HOS/liability | Historic/traffic-optional route speed profiles; no live reroute in v1 |
| **Black-box "trust our model" without editability** | Faster to ship, matches OEM portal pattern | Fails consulting credibility test; clients ask "what assumptions?" | Editable params + assumptions log + reset-to-OEM |
| **450+ vehicle library breadth (PTV-style)** | More models = more coverage | Maintenance burden, shallow specs, dilutes validation on 2–3 POLB-relevant trucks | Deep library for eCascadia + T680E; user custom profiles for others |
| **Google Maps consumer EV routing as foundation** | Familiar UX, fast to integrate | Light-duty assumptions, no freight constraints, no NHFN, no MCS taxonomy | Self-hosted OSRM/Valhalla truck profile + physics microservice |
| **Per-second physics simulation loop** | "Higher fidelity" marketing | 100× compute for optimization loops; segment model achieves target MAPE with validation | Segment/event-based physics with documented resolution |
| **Public API / white-label embedding (v1)** | Partner distribution | Support burden before product-market fit | Internal + client-facing SaaS first; API after workflow stable |
| **Advanced thermal management / battery degradation modeling** | Accuracy purists request it | Sparse public data, high parameter uncertainty, slows v1 without improving POLB drayage decisions | Battery aging slider (PTV pattern) as optional sensitivity; defer degradation to telematics calibration v2 |
| **Legal/compliance advice (HOS, weight limits)** | Planners conflate feasibility with compliance | Liability exposure if tool implies regulatory clearance | Explicit disclaimer; show energy/time estimates only |

---

## Feature Dependencies

```
Route Input (O/D + truck profile)
    └──requires──> Truck Config Library
    └──requires──> Truck Routing Engine (OSRM/Valhalla + restrictions)
                       └──requires──> Elevation Profile Integration
                           └──requires──> Physics Segment Energy Model
                               └──requires──> Payload + Weather Inputs
                                   └──requires──> Forward SoC Projection
                                       └──requires──> Charger Database (NREL/PostGIS)
                                           └──requires──> Rule-Based Charging Logic
                                               └──requires──> Feasibility Verdict
                                                   └──requires──> Map Visualization
                                                       └──requires──> KPI Cards + Profile Chart

Assumptions Log ──enhances──> All simulation outputs
Export (CSV/JSON/PDF) ──requires──> Simulation Results Storage (immutable run + input hash)

NHFN Constraint Layer ──requires──> Truck Routing Engine + PostGIS
Port Drayage Profile ──enhances──> Physics Segment Energy Model (port-phase segments)

Scenario Comparison ──requires──> Simulation Results Storage (2+ runs)
Sensitivity Sliders ──requires──> Physics Segment Energy Model (parametric re-run)

Corridor Gap Analysis ──requires──> Charger Database + Route Polyline + Min kW Filter
"Infrastructure Required" Tagging ──requires──> Corridor Gap Analysis + Feasibility Verdict

Emissions Ton-Mile Module ──requires──> Simulation Aggregates (distance, energy)
TCO / LCFS Chart ──requires──> Emissions Module + Energy Cost Inputs

Balanced Multi-Objective Charging ──conflicts──> v1 Rule-Based-Only scope (same release if labeled "preview")
Interactive Stop Editing ──requires──> Rule-Based Charging Logic + Re-simulation from checkpoint
Real-Time OCPI ──conflicts──> "Planning Tool" positioning + Static Charger assumption
Fleet MILP Optimization ──conflicts──> Single-Truck v1 scope
```

### Dependency Notes

- **Physics model requires elevation:** Grade energy is the dominant error source on Cajon Pass corridors; routing without elevation invalidates POLB validation gates.
- **Charging logic requires charger database:** Stop recommendations are only as credible as AFDC freshness and MCS power metadata.
- **Scenario comparison requires immutable run storage:** Consultants must compare apples-to-apples; hash inputs to detect assumption drift.
- **NHFN layer enhances but does not block v1:** Can ship route-first, add NHFN snap in Phase 2 without rewriting physics.
- **Emissions/TCO post-simulation:** Deliberately decoupled from physics engine — high consulting value, low implementation risk once energy totals exist.
- **Gap analysis requires qualifying kW threshold:** "Gap" is meaningless without payload-conditioned range and min charger power filter (e.g., 350 kW for corridor Class 8).

---

## MVP Definition

### Launch With (v1)

Minimum viable product — needed to validate concept with CleverWork consulting use cases.

- [ ] **Physics segment energy model** (elevation, payload, weather presets, regen, aux) — Core Value; without this, product is a map wrapper
- [ ] **Truck config library** (eCascadia 438 kWh, T680E 375 kWh + overrides) — Enables realistic POLB scenarios without param entry friction
- [ ] **POLB corridor route input** (terminal presets + free O/D + truck routing) — Matches primary user mental model
- [ ] **Forward SoC projection + feasibility verdict** — Answers "can this truck make this move?"
- [ ] **Rule-based charging stop recommendations** — Answers "where and how long to charge?"
- [ ] **NREL AFDC charger layer with kW filtering** — Infrastructure-realistic planning
- [ ] **Interactive map** (route SoC gradient + charger markers) — Spatial trust for corridor work
- [ ] **KPI cards + SoC profile chart** — Interpretable without domain PhD
- [ ] **Scenario comparison (2+ runs)** — Fleet transition work is inherently comparative
- [ ] **Sensitivity sliders** (payload, temp, headwind) — Uncertainty without Monte Carlo
- [ ] **Export CSV/JSON + PDF with assumptions audit** — Client deliverable gate (≥3 deliverables in 90 days)
- [ ] **Assumptions log + limitations + disclaimers** — Credibility and liability management
- [ ] **Port drayage profile toggle** — POLB differentiation vs generic EV routing

### Add After Validation (v1.x)

Features to add once physics passes MAPE gates and internal testers complete end-to-end workflow.

- [ ] **NHFN freight network snap/preference** — Trigger: Cajon Pass validation passed; data pipeline stable
- [ ] **Corridor gap analysis view** — Trigger: charger layer trusted; users ask "where are the dead zones?"
- [ ] **"Feasible today / depot required / gap blocked" tags** — Trigger: gap view shipped; consulting narratives need infrastructure framing
- [ ] **Emissions ton-mile comparison** — Trigger: energy totals validated; client RFPs request WTW CO₂e
- [ ] **Energy cost per mile** — Trigger: emissions module exists; TCO conversations begin
- [ ] **Balanced multi-objective charging optimization** — Trigger: rule-based stops validated; users request time vs energy tradeoffs
- [ ] **Interactive stop editing** — Trigger: planners override algorithm in user testing
- [ ] **Weather live pull (OpenWeatherMap)** — Trigger: preset scenarios insufficient for seasonal client work
- [ ] **Saved scenarios + basic auth** — Trigger: repeat users lose work without persistence

### Future Consideration (v2+)

Defer until product-market fit and physics credibility established.

- [ ] **Fleet scheduling / MILP optimization** — Different product; requires telematics partnerships
- [ ] **Real-time OCPI charger status** — Infrastructure maturity + ops liability
- [ ] **Hydrogen comparator module** — After EV baseline is defensible counter-thesis input
- [ ] **Telematics calibration (ELD integration)** — Ground-truth backtest on partner fleets
- [ ] **Monte Carlo lite (N=50–100)** — After sensitivity sliders prove value
- [ ] **PWA offline corridor cache** — Field use case unvalidated for analyst-primary persona
- [ ] **Rolling cumulative TCO + LCFS chart** — Phase 3 per PRD; depends on cost/emissions modules
- [ ] **Public API / white-label** — After workflow stable and support model defined
- [ ] **Depot/yard charging simulation** — ChargeSim domain; integrate via export, don't rebuild

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Physics segment energy model | HIGH | HIGH | P1 |
| Truck config library (2 OEM models) | HIGH | MEDIUM | P1 |
| Route input + truck routing | HIGH | MEDIUM | P1 |
| Forward SoC + feasibility verdict | HIGH | MEDIUM | P1 |
| Rule-based charging stops | HIGH | HIGH | P1 |
| NREL charger database | HIGH | MEDIUM | P1 |
| Map + SoC profile visualization | HIGH | MEDIUM | P1 |
| Scenario comparison | HIGH | MEDIUM | P1 |
| Export PDF/CSV + assumptions audit | HIGH | MEDIUM | P1 |
| Port drayage profile | HIGH | MEDIUM | P1 |
| Sensitivity sliders | HIGH | LOW | P1 |
| Assumptions log + disclaimers | HIGH | LOW | P1 |
| NHFN constraint layer | MEDIUM | HIGH | P2 |
| Corridor gap analysis | HIGH | MEDIUM | P2 |
| Infrastructure feasibility tags | HIGH | LOW | P2 |
| Emissions ton-mile comparison | HIGH | MEDIUM | P2 |
| Energy cost per mile | MEDIUM | LOW | P2 |
| Balanced multi-objective charging | MEDIUM | HIGH | P2 |
| Interactive stop editing | MEDIUM | MEDIUM | P3 |
| Saved scenarios + auth | MEDIUM | MEDIUM | P3 |
| Live weather pull | MEDIUM | LOW | P3 |
| TCO + LCFS rolling chart | MEDIUM | MEDIUM | P3 |
| Monte Carlo lite | LOW | MEDIUM | P3 |
| Fleet MILP optimization | HIGH (future) | VERY HIGH | Defer v2 |
| Real-time OCPI | MEDIUM (future) | HIGH | Defer v2 |
| Hydrogen comparator | MEDIUM (future) | HIGH | Defer v2 |
| Mobile driver navigation | LOW (v1 persona) | HIGH | Defer v2 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible (v1.x)
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | PTV EV Truck Route Planner | Pathfinder / AmpTrans | NREL EVI-X / HEVII | Detroit Connect eRange | FleetVolt Approach |
|---------|---------------------------|----------------------|-------------------|------------------------|-------------------|
| **Class 8 truck focus** | Yes (200+ truck twins, EU-heavy) | Yes (BEV route planner) | HEVII for HD fleets | eCascadia only | US Class 8: eCascadia + T680E deep specs |
| **Physics transparency** | Black-box algorithms | Partial | Research-grade, not UI-friendly | OEM black-box | Fully editable params + audit trail |
| **Elevation / grade** | Yes | Yes | Yes (EVI-RoadTrip) | Yes (road gradient) | Yes; Cajon Pass validation gate |
| **Payload modeling** | Per-stop payload | Route-level | Telematics-inferred (HEVII) | Load parameter | GCW / % payload + sensitivity |
| **Port drayage profile** | No | No | No | No | **Differentiator:** stop-go + terminal aux |
| **NHFN freight network** | Truck restrictions only | Truck-verified chargers | Corridor tools, not NHFN snap | No | **Differentiator:** PostGIS NHFN layer |
| **Charging optimization** | Auto-optimized stops | Route + charger find | Network design (EVI-RoadTrip) | No en-route planning | Rule-based v1 → multi-objective v1.5 |
| **MCS / high-power filter** | Connector/speed config | Truck-verified chargers | Power level in network tools | CMS depot focus | Explicit 350+ kW tier filtering |
| **Scenario comparison** | Vehicle swap / re-run | Side-by-side EV vs diesel | Fleet-level analysis | What-if scenarios | Structured 2+ scenario diff view |
| **Corridor gap analysis** | Indirect (infeasible routes) | Partial | **Core feature** (EVI-RoadTrip) | No | Single-route gap highlights |
| **Export / reporting** | CSV download, KPIs | Cost/CO₂ reports | Research outputs | Post-trip OEM reports | **Differentiator:** PDF + CSV + assumptions for consulting |
| **Emissions / TCO** | Operational cost settings | Cost + CO₂ comparison | Financial tools (EVI-FAST) | eConsulting TCO packages | WTW ton-mile + LCFS toggle (Phase 2–3) |
| **Real-time charger status** | No | Partial (verified network) | No | No | Deferred; static AFDC |
| **Fleet optimization** | Bulk route upload | Network-level (Pro) | HEVII fleet placement | Depot CMS only | Deferred v2 |
| **API access** | PTV Developer API | Unknown | Research scripts | No | Deferred v2 |
| **Geographic focus** | Europe-primary | Global | US research | North America OEM | **US POLB + NHFN corridors** |

---

## Sources

- [PTV EV Truck Route Planner product page](https://www.ptvlogistics.com/en-us/products/ptv-ev-truck-route-planner) — feature list, pricing, vehicle library (HIGH relevance, vendor primary)
- [HERE Routing API v8 EV routing docs](https://docs.here.com/routing/docs/routing-v8-ev-routing) — physical/empirical consumption models, charging integration (HIGH relevance, API reference)
- [Moovex EVRP documentation](https://www.moovex.ai/docs/evrp) — charge curves, gradient/temperature modeling (MEDIUM relevance)
- [NREL EVI-X modeling suite](https://www.nrel.gov/transportation/evi-x) — EVI-RoadTrip, HEVII, EVI-Fleet scope (HIGH relevance, US freight infrastructure)
- [NREL EVI-RoadTrip](https://www.nrel.gov/transportation/evi-roadtrip) — corridor gap analysis capabilities (HIGH relevance)
- [NREL HEVII / SAE 2023-01-0708](https://saemobilus.sae.org/articles/development-a-heavy-duty-electric-vehicle-integration-implementation-hevii-tool-2023-01-0708) — HD fleet electrification features (MEDIUM relevance)
- [Pathfinder electric truck planner](https://pathfinder.lotsgroup.com/) — route comparison, TCO framing (MEDIUM relevance)
- [AmpTrans eFleetPlan](https://www.amptrans.net/solutions/fleet) — drayage route modeling (MEDIUM relevance)
- [ChargeSim eYardPlanner](https://www.chargesim.com/eyardplanner) — depot/yard feature boundary (MEDIUM relevance)
- [Detroit Connect eRange / eCascadia](https://northamerica.daimlertruck.com/news-stories/2022/world-premiere-of-the-new-battery-electric-freightliner-ecascadia) — OEM portal feature set (MEDIUM relevance)
- [Electrification Coalition Electric Freight Dashboard](https://www.cleantrucking.com/infrastructure/charging-infastructure/article/15817068/electric-freight-dashboard-for-ev-trucks-updated) — corridor/policy gap mapping (MEDIUM relevance)
- [Caltrans: Routing BEHDTs for Drayage Operations (CA23-Task3369)](https://dot.ca.gov/-/media/dot-media/programs/research-innovation-system-information/documents/final-reports/ca23-task3369-v2.pdf) — POLB drayage domain requirements (HIGH relevance, academic)
- FleetVolt `PROJECT.md` and `00_PRD_FleetVolt_Route_v2.md` — product scope and MoSCoW (HIGH relevance, internal)

---
*Feature research for: Class 8 EV drayage & corridor energy modeling (FleetVolt Route)*
*Researched: 2026-07-01*
