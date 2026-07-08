# PRD: FleetVolt Route v2 — Class 8 EV Drayage & Corridor Energy Modeler

**Version**: 2.0 (Revised & Restructured)  
**Date**: June 17, 2026  
**Status**: Draft for Review & Alignment  
**Owner**: CleverWork / FleetVolt Initiative (tied to POLB & Zero-Emission freight strategy)  
**Audience**: Product, Engineering, Domain Experts (ports, drayage, energy), Potential Clients/Partners

---

## 1. Executive Summary & Strategic Context

FleetVolt Route is a **desktop-first web application** that provides physics-grounded, corridor-constrained energy and charging planning for Class 8 battery-electric trucks (BETs) operating in intermodal drayage and regional/long-haul freight. 

**Core Use Case (MVP Focus)**: Model freight movement originating at the Port of Long Beach (POLB) or similar California ports — including drayage to inland terminals/yards — then long-haul segments along National Highway Freight Network (NHFN) corridors to U.S. hinterland destinations (e.g., Inland Empire hubs, or further to Phoenix, Dallas, or Chicago as infrastructure matures).

It helps **fleet operators, drayage companies, 3PLs, port stakeholders, and consultants** answer:
- Is this route/payload feasible with current EV trucks and charging infrastructure?
- Where and how long must we stop to charge? What is the total trip energy, time, and cost impact?
- How sensitive is feasibility to payload, weather, departure time, or truck configuration?
- What infrastructure gaps (charger power, spacing) exist on key corridors?

**Why v2?** The original PRD outlined an ambitious dual-interface vision but suffered from:
- Overly broad scope for a first release (full real-time mobile + macro planner + complex optimization in 16 weeks).
- Underestimated data integration, model validation, and computational realities of high-fidelity physics simulation.
- Insufficient emphasis on **validation against real-world constraints** (nascent MCS network, proprietary truck efficiency curves, port operational variability).
- Missing clear MVP definition, success metrics, risk register, and MoSCoW prioritization.
- Tech stack choices viable but physics-heavy workload better served by hybrid scientific computing approach.

**v2 Philosophy**: 
- **Narrow & Deep First**: Deliver high-accuracy single-corridor / single-truck simulation and planning before adding fleet scheduling, live execution, or mobile.
- **Evidence-Based**: Every physics claim or recommendation must be traceable to public specs, published studies, or user-provided calibration data. Surface confidence intervals and limitations transparently.
- **Infrastructure-Aware**: Explicitly model the current (2026) reality of sparse public Megawatt Charging System (MCS) deployment. Highlight "feasible today" vs "requires depot/strategic charging or infrastructure build-out".
- **Extensible for Client Work**: Designed as a reusable framework for POLB ecosystem analysis, hydrogen/EV counter-scenario modeling, drayage transition planning, and RFP support.

**Target Users (Primary for v1/v1.5)**: Fleet transition analysts, sustainability/operations consultants, dispatch planners at mid-to-large drayage or regional fleets. Driver-facing mobile is deferred to v2+ or as lightweight PWA companion.

**Key Differentiators vs Existing Tools** (PTV EV Truck Route Planner, generic routing + spreadsheets, OEM telematics portals):
- Tight integration of **NHFN freight network constraints** + **port drayage operational profiles** (stop-go, idling/aux at terminals).
- Transparent, editable physics model with elevation (grades like Cajon Pass), weather, and payload dynamics.
- Scenario comparison and sensitivity built-in from day one.
- Designed for **consulting/strategic use** (exportable reports, assumptions audit trail) alongside operational planning.

---

## 2. Problem & Opportunity

### 2.1 The Problem
Class 8 EV adoption in drayage and regional freight is accelerating due to CARB Advanced Clean Trucks/Fleets rules, port clean truck programs, corporate Scope 3 goals, and total cost of ownership (TCO) pressure. However:
- Real-world range is highly variable (payload, grade, speed, aux loads, weather, driver behavior).
- Public high-power charging (especially MCS >250-350 kW, let alone 1 MW) remains sparse outside specific depots and early corridor pilots (Tesla/Pilot, Forum Mobility at POLB area, EV Realty Inland Empire as of mid-2026).
- Existing planning tools are either consumer-grade, lack freight-specific constraints (weight/height/bridge clearances), or treat charging as an afterthought.
- Operators lack easy ways to quantify infrastructure gaps or run "what-if" scenarios for mixed fleets or new contracts.

Result: Overly optimistic deployments, stranded assets, or delayed transitions. Planners fall back to conservative diesel assumptions or manual spreadsheet models that ignore topography and dynamics.

### 2.2 The Opportunity
A credible, auditable modeling tool can:
- De-risk EV pilots and fleet transitions for drayage companies serving POLB and other gateways.
- Support infrastructure planning (where to site/prioritize chargers along NHFN corridors).
- Provide defensible analysis for policy, RFP responses, and investor/stakeholder communications (including hydrogen counter-scenarios).
- Evolve into an operational decision-support layer (charging stop recommendations, dynamic range) once real-time data matures.

**Strategic Fit**: Aligns with ongoing POLB ecosystem work, zero-emission advisory, and multi-client research on maritime/port energy transition. Can serve as a productized offering or internal capability multiplier.

---

## 3. User Personas & Jobs-to-be-Done (JTBD)

### Primary (v1 Focus)
**Persona A: Fleet Transition / Sustainability Analyst** (Consultant or internal at 3PL/fleet)
- **JTBD**: "When evaluating a new EV drayage contract or corridor, I need to quickly model energy feasibility, charging requirements, and TCO sensitivity so I can recommend go/no-go or infrastructure asks with confidence."
- Pain: Spreadsheets break on topography/weather; OEM tools are black-box or single-truck; no easy comparison across truck configs or seasons.
- Success: Generate client-ready report in <30 min with transparent assumptions and quantified uncertainty.

**Persona B: Dispatch / Operations Planner** (at drayage or regional carrier)
- **JTBD**: "For tomorrow's or next week's loads, I need to know which EV trucks can handle specific origin-destination pairs with current charging options, and what charging windows to plan around."
- Pain: Manual range calcs ignore real grades/traffic; charger status changes; HOS + charging dwell conflicts.
- Success: Reliable "can this truck make this move today?" answer + suggested charging plan.

### Secondary / Future (v2+)
**Persona C: Driver or Fleet Supervisor (Mobile)**
- Real-time SoC countdown, next charger status, simple turn-by-turn optimized for truck constraints.
- Deferred; PWA viewer of planner outputs possible earlier.

**Persona D: Infrastructure / Policy Analyst**
- Aggregate corridor-level gap analysis (e.g., "On I-15 north from Barstow, average gap between 350+ kW chargers exceeds 150 miles under typical payload").

---

## 4. Scope

### 4.1 In Scope (MVP / v1)
- Single truck, single origin-destination simulation (POLB-focused corridors prioritized).
- Physics-based energy consumption model (rolling resistance, aero, grade, aux, regen) with segment discretization.
- Elevation profile integration and basic weather adjustment (temp, wind).
- Truck configuration library (seeded with public specs for eCascadia 291/438 kWh, T680E 250/375/500 kWh; user-editable parameters).
- Payload input (weight or % of GCW) affecting consumption.
- NHFN network awareness (prefer or constrain routes to designated freight corridors where data supports).
- Charger database from NREL AFDC (power level, connector type, location); basic "nearest feasible" or rule-based charging stop logic.
- Interactive map visualization (route, SoC/energy profile overlay, charger annotations).
- Scenario comparison (2-4 side-by-side or diff view).
- Exportable reports (PDF summary + detailed CSV/JSON profile).
- Assumptions log and model limitations disclosure in UI.

### 4.2 Out of Scope (v1 — Explicitly Deferred)
- Multi-truck / fleet scheduling or optimization (MILP/ALNS style).
- Live/real-time charger availability polling (OCPI) or reservations — use cached/static status with freshness indicator.
- Native mobile apps or advanced driver navigation (PWA read-only viewer OK in Phase 3).
- Full stochastic/Monte Carlo simulation (simple sensitivity sliders first).
- Rail/intermodal handoff modeling (truck leg only; terminal dwell as fixed or configurable aux load).
- Depot charging scheduling or V2G.
- Cost modeling beyond rough electricity + opportunity cost (TCO module later).
- Integration with ELD/telematics providers (API hooks planned).
- Hydrogen or other alt-fuel comparison module (separate or future extension).

**MVP Success Gate**: Accurate reproduction of manufacturer-claimed ranges under ideal conditions + credible Cajon Pass / similar grade example; planner can run end-to-end scenario in <2 minutes with meaningful output.

---

## 5. Functional Requirements (MoSCoW Prioritized)

### Must Have (Core to MVP Value)
- **M1. Route & Simulation Engine**: Accept origin (POLB terminal selector or lat/lon), destination (pre-seeded popular hinterland points or free lat/lon), truck config, payload, departure conditions → compute and return time-series energy/SoC profile + aggregates.
- **M2. Physics Model (Segment-Based)**: Implement standard longitudinal dynamics with documented parameters. Support regen. Output kWh consumed, recovered, net, average Wh/mi, total time.
- **M3. Elevation & Topography**: Integrate elevation profiles; demonstrate impact on routes with significant grade (e.g., leaving POLB basin via Cajon or similar).
- **M4. Charging Logic (Rule-Based v1)**: When projected SoC drops below threshold (configurable, default 15-20%), recommend stop(s) at qualifying chargers (min kW, proximity to route). Estimate charge time to target SoC (simple power-limited model; note taper limitations).
- **M5. Map Visualization**: Route polyline (color or annotation for SoC segments), charger markers (sized/color by power), interactive hover for details at point along route.
- **M6. Truck Config Library & Overrides**: Pre-load 2-3 real models with public data; allow editing key params (battery usable kWh, base efficiency, regen %, aux kW, drag coeff, etc.) with "reset to OEM" .
- **M7. Basic Comparison & Sensitivity**: Run 2+ scenarios; simple sliders for payload, temp, headwind; show delta energy/time.
- **M8. Export & Audit**: PDF report (summary KPIs, assumptions, profile table excerpt, map screenshot); JSON/CSV full profile for further analysis.

### Should Have (High Value, Post-MVP or Parallel)
- **S1. NHFN Constraint Layer**: Route generation or snapping prefers/validates against BTS NHFN shapefiles in PostGIS.
- **S2. Weather Scenarios**: Pre-defined (Hot/Cold, Headwind, Ideal) or live OpenWeatherMap pull for departure point/time (with cache).
- **S3. Port Drayage Profile**: Configurable "port phase" with lower average speed, higher aux/idle time, stop-go penalty.
- **S4. Charger Detail & Notes**: Power level, connector (CCS/MCS), operator, known issues or "depot only" flags from data.
- **S5. User Accounts & Saved Scenarios**: Basic auth; save, load, share (read-only) simulations with assumption snapshots.
- **S6. Performance**: Single simulation completes in <5-8 seconds on target hardware; support basic concurrency.

### Could Have (Nice-to-Have for Polish / v1.5)
- **C1. Interactive Stop Editing**: User can force or remove charging stops; re-simulate from that point.
- **C2. Corridor Gap Analysis View**: For a route, highlight stretches >X miles without qualifying charger.
- **C3. Simple Monte Carlo Lite**: Run N=50-100 variations with noise on key params; show distribution of outcomes (P50/P90 energy, feasibility %).
- **C4. Basic Cost Overlay**: User-input electricity rate + driver dwell opportunity cost; show rough $ impact.
- **C5. PWA + Offline Cache**: Installable; cache popular corridor results and map tiles for low-connectivity areas.

### Won't Have (v1)
- Live dynamic routing around charger outages or traffic.
- Full optimization (min time vs min energy vs min cost) — rule-based + manual tweak first.
- Multi-leg intermodal (rail schedules, chassis pools).
- Advanced thermal management or battery degradation modeling.
- Public API or white-label embedding (future).

---

## 6. Non-Functional Requirements

- **Accuracy & Validation**: Target mean absolute percentage error (MAPE) on total energy <8-12% vs available ground truth (manufacturer claims under controlled conditions; later partner telematics on specific corridors). Document all modeling assumptions and known error sources in UI and reports.
- **Performance**: Simulation job p95 <10s. Map interactions smooth (<100ms). Initial page load <3s on desktop broadband.
- **Usability**: Config form completable in <60s for repeat users. Results interpretable without deep domain knowledge (tooltips, glossary, limitations callout).
- **Reliability & Data Freshness**: Charger location DB refreshable weekly via script. Elevation cached per corridor. Simulation results immutable once run (or versioned with assumptions hash).
- **Security & Privacy**: Simulation inputs/outputs private to user/org. No PII in core model. SOC2 or equivalent path if commercialized.
- **Accessibility & Browser**: Modern desktop Chrome/Firefox/Edge primary. Responsive for tablet; mobile PWA secondary.
- **Observability**: Logging of simulation params + outcomes for debugging/model improvement. Error boundaries for physics edge cases (e.g., negative SoC projected).

---

## 7. Success Metrics & KPIs

**Leading (Build Phase)**:
- Physics model passes validation gates on 2-3 reference corridors (ideal range match + grade example within X%).
- End-to-end planner workflow time-to-insight <5 min for target user.
- Zero critical bugs in simulation math or spatial queries in staging.

**Lagging (Post-Launch, 30-90 days)**:
- 80%+ of test users rate output as "credible" or "actionable" (survey).
- Used in ≥3 client deliverables or internal strategy docs.
- Quantifiable infrastructure gap findings adopted in stakeholder conversations (e.g., "X miles of corridor lack 350+ kW charging under 40k lb payload").

**Business / Strategic**:
- Accelerates EV feasibility assessment for at least one active drayage or port-related engagement.
- Provides defensible baseline for hydrogen or other alt-fuel discussions.

---

## 8. Assumptions, Constraints & Open Questions

### Key Assumptions
- Publicly available truck specs (battery kWh, claimed range, charge curves) are starting points; real performance requires calibration with fleet data.
- NREL AFDC provides sufficient static charger data for planning; real-time status is noisy/fragmented and deferred.
- NHFN shapefiles can be ingested and used for route preference or validation (not full graph routing initially).
- Users (analysts/planners) have tolerance for "physics estimate with documented limits" vs perfect digital twin.
- MCS and high-power public charging will remain limited in 2026-2027 for true long-haul; model surfaces this reality.

### Constraints
- Limited ground-truth telematics access initially → heavy reliance on physics + published studies + user overrides.
- Computational budget: Avoid per-second simulation for optimization loops; use segment/event-based.
- Regulatory: Model does not provide legal advice on HOS, weight limits, or driver scheduling.
- Data costs: Google Elevation or similar may incur usage fees; prefer open alternatives (Open-Elevation) or caching for popular routes.

### Critical Open Questions / Decisions Needed (Answer Before or During Phase 0)
1. **Priority Corridors for MVP Validation**: Specific POLB terminal → inland yard (e.g., San Bernardino) + one longer example with grade (Cajon Pass or Tehachapi)? Or user-defined any US origin-dest?
2. **Optimization Objective (v1.5+)**: Fastest arrival (min total time incl. dwell), lowest energy, lowest operating cost, or balanced/multi-objective? Default?
3. **Truck Library Priority**: Which 3-5 specific Class 8 EV models/configs to seed first (with exact public or partner specs)?
4. **Data Fidelity vs Speed Trade-off**: Accept 5-10s sim time for higher accuracy segment resolution, or optimize for <2s interactive feel?
5. **Business Model**: Internal capability only, client-facing SaaS/consulting tool, or embeddable widget for port partners?
6. **Validation Partnership**: Any access to real drayage telematics or fleet partner willing to backtest model on known moves?
7. **Hydrogen Comparator**: Is a side-by-side "EV vs H2 fuel cell" energy/time/cost module desired in v2, or separate effort?

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Physics model inaccuracy vs real world (esp. aux, regen, thermal) | Medium-High | High | Conservative defaults + prominent "estimate only; calibrate with your data" messaging; phased validation gates; sensitivity analysis prominent. |
| Sparse public MCS makes many long-haul routes infeasible | High (current reality) | Medium | Explicit "infrastructure gap" visualization and recommendations; focus MVP on drayage/regional + early corridors where feasible. |
| Data integration effort (NHFN cleaning, elevation caching, charger schema) under-estimated | Medium | Medium | Phase 0 dedicated to data pipeline + validation scripts; use existing open routing engines where possible. |
| Scope creep into fleet optimization or real-time too early | Medium | High | Strict MoSCoW + MVP gate reviews; document "future" items clearly. |
| User adoption low if output feels too academic or UI clunky | Medium | High | Co-design with 1-2 target analysts early; invest in explanation UI (tooltips, glossary, example scenarios); fast iteration post-alpha. |
| Regulatory / liability if used for operational dispatch decisions | Low-Medium | High | Clear disclaimers; position as "planning & feasibility tool" not "real-time dispatch system" initially; audit trail of assumptions. |

---

## 10. High-Level Data Flow & User Journey (MVP)

1. **Configure Scenario** (Form): Select truck from library → edit payload/params if needed → choose origin (POLB selector) + destination (or corridor preset) → set departure conditions (time/weather scenario or live) → optional port drayage profile toggle.
2. **Run Simulation** (Backend Job): 
   - Resolve route (OSRM/Valhalla or pre-defined + NHFN snap).
   - Fetch/cache elevation profile.
   - Discretize into segments → compute per-segment forces/power/energy delta (physics engine).
   - Project SoC forward; when threshold crossed, search nearby qualifying chargers (PostGIS spatial) → apply charge event.
   - Aggregate KPIs + full profile (distance, time, energy, SoC array, charge events).
3. **Review Results** (UI): 
   - Map with route + SoC gradient + charger pins + popups.
   - KPI cards (Total kWh net, Wh/mi, Est. time, # stops, Dwell time, Final SoC).
   - Profile chart (SoC or power vs distance/time; synced hover with map).
   - Charging plan table (location, arrival SoC, charge kWh/time, departure SoC).
   - Assumptions & Limitations panel.
4. **Iterate or Export**: Adjust inputs → re-run; compare scenarios; export PDF/CSV.

**Backend Note**: Long-running or heavy jobs queued (e.g., via BullMQ or Python task queue). Results stored with hash of inputs for caching/replay.

---

## 11. Tech Stack Recommendations (High-Level)

See companion **Technical_Architecture_FleetVolt.md** for details.

**Summary Rationale**:
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind + Shadcn/ui + Mapbox GL JS (or Leaflet for cost). Zustand or Jotai for state. Recharts or Chart.js for profiles.
- **Backend API**: Node.js/Fastify (or NestJS) for orchestration, auth, storage. **Python FastAPI microservice** (Dockerized) for physics simulation, spatial queries (PostGIS via SQLAlchemy/GeoAlchemy), optimization logic. Strong numeric ecosystem (NumPy, Pandas, SciPy, NetworkX).
- **Data**: PostgreSQL + PostGIS (NHFN linestrings, charger points with power metadata, cached elevation profiles, simulation results). Redis for job queue/cache.
- **Routing**: Self-hosted or hosted OSRM/Valhalla with heavy vehicle profile + custom cost overlay, or Mapbox Directions API with constraints.
- **Deployment**: Docker Compose (dev/staging); Vercel or self-host frontend; AWS ECS/Fargate or equivalent for backend services. Aligns with existing VPS patterns where possible.
- **Why Hybrid?** JavaScript excellent for UI/maps/API; Python/Rust far superior for reproducible scientific simulation and spatial analysis without fighting numeric limitations.

**Key Libraries/Dependencies (Initial)**:
- Python: numpy, pandas, scipy, networkx or igraph, geoalchemy2, fastapi, celery/redis, pydantic.
- JS/TS: mapbox-gl, @turf/turf (or geolib), recharts, date-fns, zod for validation.

---

## 12. Implementation Phases (High-Level — See Roadmap Doc)

**Phase 0: Discovery, Data Foundation & Validation Framework (Weeks 1-3)**
- Align on priority corridors, truck configs, success criteria.
- Ingest NHFN + NREL charger data into PostGIS.
- Define physics parameter schema + validation test cases (ideal range, grade example).
- Scaffold Next.js + Python FastAPI services; basic map + form.
- **Gate**: Data pipelines working; reference simulation runs without crashing; validation plan approved.

**Phase 1: Core Physics Engine & Single-Route Evaluation (Weeks 4-8)**
- Implement segment physics + elevation + basic weather.
- Forward SoC projection + simple charging rule.
- Results storage + basic UI (map + KPIs + profile chart).
- **Gate**: Reproduces manufacturer ranges within tolerance on ideal case; credible output on grade-heavy example; UI usable by internal tester.

**Phase 2: Charging Optimization, Comparison & Reporting (Weeks 9-12)**
- Enhance charger search & stop logic.
- Scenario comparison UI + sensitivity.
- PDF/JSON export + assumptions audit.
- NHFN route preference layer.
- **Gate**: End-to-end planner workflow <5 min; 2+ scenarios comparable; export works.

**Phase 3: Polish, What-If & Mobile Foundation (Weeks 13-16+)**
- Interactive stop editing, advanced sensitivity/Monte Carlo lite.
- PWA + offline support for cached corridors.
- User accounts, saved scenarios.
- Initial performance/UX hardening + documentation.
- **Gate**: Alpha ready for 3-5 friendly users; model limitations clearly communicated; roadmap for v1.5 live features approved.

**Post-v1**: Real-time status integration (cached/poll), fleet scheduling module, rail intermodal extensions, deeper telematics calibration partnerships, public API.

---

## 13. Appendices & References (To Be Expanded)

- Original PRD v1 (for traceability).
- Truck spec sources (Freightliner eCascadia, Kenworth T680E public data sheets).
- NREL AFDC / BTS NHFN documentation.
- Relevant research (e.g., drayage routing papers with charging).
- Glossary: SoC, MCS, NHFN, regen efficiency, aux load, etc.

---

**Next Steps After Review**:
1. Align on Open Questions (esp. priority corridors & truck models).
2. Kick off Phase 0 with data ingestion scripts + validation test cases.
3. Iterate this PRD based on domain expert (port/drayage/energy) feedback.
4. Produce detailed Technical Architecture, Data Spec, and full Phase 0-1 user stories / acceptance criteria.

This v2 provides a tighter, more executable foundation while preserving the original vision's ambition. It is designed to be buildable iteratively with measurable value at each gate.