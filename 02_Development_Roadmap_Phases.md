# Development Roadmap & Phasing: FleetVolt Route v2

**Version**: 1.0  
**Date**: June 17, 2026  
**Status**: Draft — Aligned to PRD v2 MVP Definition

---

## Overview & Philosophy

This roadmap breaks the original 16-week ambitious plan into **more realistic, gated phases** with clear deliverables, validation requirements, and "Definition of Done" (DoD) criteria. Total timeline for a solid v1 (usable for internal/client strategic work) is estimated at **14-18 weeks** depending on team size (1-2 full-stack + 1 domain/physics contributor ideal) and whether Python microservice is new or familiar.

**Core Principles**:
- **Value at Every Gate**: Each phase ends with something a target user (analyst/planner) can run and get credible insight from — even if limited to one corridor.
- **Validation Before Polish**: Physics and data accuracy gates before heavy UI investment.
- **Narrow Scope Ruthlessly**: No multi-truck optimization, no live OCPI, no native mobile in v1. These are explicit "v2+" items.
- **Documentation & Handoff**: Every phase produces or updates living docs (this roadmap, PRD, data spec, model assumptions log).
- **Agent-Augmentable**: Structure so AI agents (your existing Conductor/Hermes patterns) can assist with data ingest, testing, report generation, etc.

**MVP Success Definition (End of Phase 2 or 3)**:
A dispatch analyst or consultant can:
1. Select a pre-configured Class 8 EV (e.g., eCascadia 438 kWh or T680E 375 kWh), input realistic payload for a POLB drayage + inland move.
2. Run simulation on a priority corridor.
3. Receive map + energy profile + recommended charging stop(s) with estimated dwell.
4. Compare to a second scenario (different payload or truck).
5. Export a defensible PDF report with assumptions and limitations clearly stated.
6. Trust the numbers enough for internal strategy or client discussion (after passing validation gates).

**Risk Buffer**: Add 20-30% contingency per phase for data cleaning surprises, physics edge cases, or integration friction with routing/elevation services.

---

## Phase 0: Foundations, Data & Validation Framework (Weeks 1-3)

**Goal**: Establish the data backbone, physics parameter schema, validation test cases, and scaffolding so subsequent phases build on solid ground rather than assumptions.

**Key Deliverables**:
- Project skeleton: Monorepo structure or clear separation (`web/`, `simulator/`, `data/`, `docs/`).
- Docker Compose local dev environment (Postgres+PostGIS, Redis, Node dev server, Python FastAPI).
- CI basics (lint, typecheck, unit test runners).
- **Data Ingest**:
  - NHFN shapefiles downloaded, cleaned, loaded into PostGIS with GIST index and basic attributes.
  - NREL AFDC high-power chargers (DCFC + any MCS-tagged) ingested into `chargers` table. Script for weekly refresh.
  - Seed `truck_configs` table with 2-3 models (eCascadia 291/438 kWh variants, T680E 375/500 kWh) using public specs. JSONB params with source notes and "last validated" date.
- **Validation Framework**:
  - Documented test cases in `docs/validation/` or Notion/Obsidian:
    - Ideal flat/highway: Reproduce ~manufacturer claimed range (within 5-10% tolerance after regen/aux assumptions).
    - Grade example: POLB → Cajon Pass or equivalent (known elevation change); expected higher consumption uphill, regen credit downhill. Compare to any published drayage studies.
  - Physics parameter defaults + rationale (C_rr, CdA, regen_efficiency, aux_kw_port vs highway, thermal scalars, etc.).
  - Simple backtest script (Python) that runs reference scenarios and asserts key outputs within bounds.
- **Scaffolding**:
  - Basic Next.js app with Tailwind/shadcn, Mapbox (or Leaflet) placeholder map centered on POLB, simple config form (truck select, payload slider, origin/dest presets).
  - Python FastAPI service with `/health`, stub `/simulate` endpoint returning mock JSON.
  - Shared types (Zod + Pydantic) for simulation request/response.
- **Documentation Updates**: This roadmap refined with actual effort; PRD open questions answered or prioritized; initial model assumptions log started.

**Definition of Done (Gate)**:
- [ ] NHFN and charger data queryable in PostGIS (spatial queries work in psql or Python).
- [ ] Truck configs loadable; physics parameter schema stable.
- [ ] Validation test cases written + reference script passes on ideal case (even if numbers need tuning).
- [ ] Local dev environment spins up cleanly for new contributor.
- [ ] Internal walkthrough: "Here is the data foundation and how we will prove the model is credible."

**Dependencies / Blockers**: Access to download BTS NHFN shapefiles (public); NREL AFDC export or API key if needed (mostly open); decision on priority corridors and initial truck models (from PRD Open Qs).

**Risks Mitigated**: Data format surprises, schema debates, unclear "what good looks like" for physics.

**Output Artifacts**:
- `data/ingest/` scripts ( reproducible).
- `docs/validation/test_cases.md` + reference outputs.
- Updated `PRD` and this roadmap with Phase 0 learnings.

---

## Phase 1: Core Physics Engine & Single-Route Evaluation (Weeks 4-8)

**Goal**: Deliver the first credible, end-to-end simulation capability for a single truck on a single corridor. UI sufficient to configure, run, and interpret results.

**Key Deliverables**:
- **Physics Engine (Python)**:
  - Segment discretization of route geometry.
  - Full longitudinal dynamics implementation (rolling, aero, grade, aux, drivetrain efficiency, regen on decel/down-grade).
  - Elevation profile integration (cache + lookup or interpolate).
  - Basic weather adjustment (scenario-based scalars or simple OpenWeatherMap pull for origin).
  - SoC forward projection with safety margin and "infeasible" flagging.
  - Output: Per-segment arrays (dist, time, power, energy_delta, SoC, grade, speed) + aggregates.
- **Charging Logic v0.5 (Rule-Based)**:
  - When SoC projected < threshold (configurable 15-25%): Trigger search for nearest qualifying charger (min power_kw, within buffer of route).
  - Simple charge time estimate (kWh needed / effective charger power; note CV taper limitations in UI).
  - Append charge event(s) to profile; continue to destination or next threshold.
- **Routing Integration**:
  - Adapter to OSRM or Valhalla (self-hosted preferred) with heavy truck profile.
  - Basic NHFN bias or post-filter (prefer segments that overlap freight network).
- **Frontend (Interactive MVP)**:
  - Config form: Truck library select (with "edit params" modal or accordion), payload input (lbs or % GCW), origin (POLB terminal presets or lat/lon), destination (presets or free), departure conditions (scenario select or basic time).
  - "Run Simulation" button → job submission → loading state with progress (even if simulated).
  - Results view: Map with route polyline (SoC color gradient or power annotation), charger markers, popup details.
  - KPI strip + primary SoC / Energy vs Distance chart (Recharts, tooltip syncs map center or hover position).
  - Charging plan summary table.
  - Basic limitations / assumptions callout panel (auto-generated from run metadata).
- **Persistence & Jobs**:
  - Node API + Python worker + Redis queue.
  - `simulation_runs` table populated with full inputs/outputs.
  - Simple caching by inputs_hash.
- **Validation Execution**:
  - Run Phase 0 test cases through full pipeline.
  - Tune parameters (regen, aux, etc.) until ideal range and grade examples are within tolerance. Document changes.
  - Internal alpha test on 1-2 real POLB drayage-style moves (even if short).

**Definition of Done (Gate)**:
- [ ] Physics engine produces stable, non-negative SoC curves on reference corridors.
- [ ] Validation gates passed (documented MAPE or tolerance vs reference cases).
- [ ] End-to-end flow works: Form → job → map + chart + table in <10s p95.
- [ ] Results are explainable (user can trace why a charging stop was recommended).
- [ ] Code reviewed; basic unit tests for physics functions and spatial queries.
- [ ] "This is an estimate with these known limitations" language live in UI and exports.

**Dependencies**: Phase 0 data + scaffolding complete; routing engine (OSRM/Valhalla) accessible; elevation service chosen and prototyped.

**Risks Mitigated**: Physics model fundamentally broken or uncalibrated; job infrastructure flaky; UI disconnected from real computation.

**Stretch Goals (if ahead)**: Simple scenario save/load (even without auth); one pre-computed popular corridor cached for instant demo.

**Output Artifacts**:
- Working alpha environment (shareable link or deployed staging).
- `docs/model_assumptions.md` (living document of all physics parameters + sources/justification).
- Updated validation report with actual vs expected numbers.

---

## Phase 2: Charging Optimization, Comparison & Reporting (Weeks 9-12)

**Goal**: Make the tool useful for real planning work — scenario comparison, sensitivity, and professional output. Charging logic improved. NHFN integration deeper.

**Key Deliverables**:
- **Enhanced Charging Planner**:
  - Configurable threshold, target SoC at charge, min charger power.
  - Better candidate selection (e.g., prefer higher power, penalize excessive detour).
  - Multi-stop support (if one charge insufficient to reach dest with margin).
  - UI to view/edit planned stops (Phase 2.5 or early Phase 3).
- **Scenario Comparison**:
  - Side-by-side or tabbed view of 2-4 runs.
  - Delta view (energy, time, stops, cost proxy) between baseline and variant.
  - Quick "duplicate & tweak" (change payload +10%, different truck, different weather scenario).
- **Sensitivity Analysis (Basic)**:
  - Sliders or quick buttons: Payload ±10/20%, Temp scenario, Headwind toggle.
  - Re-run on change or batch small set; show range of outcomes (min/max energy, feasibility).
- **NHFN & Corridor Awareness**:
  - Route generation or post-processing that prefers or validates against NHFN layers.
  - Visual layer toggle: "Show freight network" on map.
  - Corridor gap highlighting (stretches without qualifying charger within X miles — simple version).
- **Reporting & Export**:
  - PDF report generation (server or client): Executive summary KPIs, assumptions snapshot, map image, charging plan, profile excerpt, limitations.
  - CSV/JSON full profile download (for further analysis in Excel or NotebookLM).
  - Shareable link (even if read-only, via inputs_hash or saved run ID).
- **Polish & Hardening**:
  - Better error handling (infeasible routes, no charger found, data stale warnings).
  - Performance: p95 simulation <5-8s for typical drayage + regional corridors.
  - UI copy, tooltips, glossary for non-expert users (e.g., "What is regen braking credit?").
- **Validation**:
  - Additional backtests on new corridors or published drayage EV studies.
  - User testing (internal or 1-2 friendly analysts): Can they complete a realistic planning task and trust the output?

**Definition of Done (Gate)**:
- [ ] Analyst can complete full workflow (configure → run → compare 2 scenarios → export report) in <5-7 minutes.
- [ ] Charging recommendations are sensible (not obviously suboptimal on test cases).
- [ ] NHFN layer integrated and visible; route bias demonstrable.
- [ ] PDF export professional enough for client/internal sharing.
- [ ] Validation report updated; no major physics regressions.
- [ ] Alpha feedback incorporated (at least one round of UI/UX tweaks).

**Dependencies**: Phase 1 core engine stable; PDF generation library chosen; basic auth or share mechanism if needed for alpha.

**Risks Mitigated**: Tool feels like a toy (no comparison/export); charging logic produces obviously bad plans; performance unacceptable for interactive use.

**v1 Readiness Check**: If this gate passes cleanly, the product is at minimum viable for strategic/feasibility use on focused corridors. Mobile, live data, and fleet features explicitly deferred.

---

## Phase 3: Polish, What-If & Mobile Foundation (Weeks 13-16+)

**Goal**: Production-hardened v1 with interactive refinement, accounts/saving, and PWA foundation for future driver view. Prepare for real user onboarding.

**Key Deliverables**:
- **Interactive What-If**:
  - On results map: Ability to add/remove/adjust charging stops (snap to existing chargers or arbitrary point on route).
  - Re-simulate only affected portion or full re-run (with caching).
  - "Force charge here" or "skip recommended stop" actions.
- **Advanced Sensitivity / Lite Stochastic**:
  - Monte Carlo lite: Run N variants with noise on key uncertain params (payload distribution, aux load, regen real-world, weather deviation). Show P50 / P10-P90 bands on energy and feasibility.
  - Or simpler: Tornado chart or table of one-at-a-time sensitivities.
- **User Accounts & Persistence (Light)**:
  - Basic auth (email/password or magic link via Supabase/Clerk or existing pattern).
  - Save simulation runs to user/org library with name/notes.
  - Load previous run (exact inputs or results).
  - Read-only share links for stakeholders.
- **PWA & Mobile Foundation**:
  - Service worker + manifest for installable PWA.
  - Responsive layouts (Tailwind mobile utilities) — results view usable on tablet; map pinch-zoom friendly.
  - Offline support: Cache map tiles + pre-computed popular corridor results (service worker + IndexedDB or similar).
  - Read-only "driver view" mode: Simplified KPI + next stop + SoC countdown (no editing). Useful for supervisors or as companion.
- **Performance, Observability, DX**:
  - Further optimization (coarser segments for long routes, partial re-compute).
  - Structured logging, error tracking (Sentry), simulation performance metrics.
  - Documentation: User guide (Notion or MD), API docs (if internal), model assumptions deep-dive.
  - Onboarding flow or example scenarios gallery.
- **v1 Launch Prep**:
  - Final validation sweep + limitations language audit.
  - Deployment pipeline to staging/prod (align with your VPS/ECS patterns).
  - Feedback mechanism (in-app or simple form).
  - Roadmap for v1.5+ published (live status, fleet batch, etc.).

**Definition of Done (Gate for v1)**:
- [ ] Interactive stop editing works and produces updated credible results.
- [ ] Accounts + save/load/share functional (even if basic).
- [ ] PWA installable; offline cached corridor demo works.
- [ ] Performance and error handling production-grade for target load (single user or small team concurrent).
- [ ] Full user documentation + known limitations page live.
- [ ] Internal or friendly-user sign-off: "This is ready for real client/strategy work on our priority corridors."

**Dependencies**: Stable Phase 2; decision on auth provider; prioritization of interactive editing vs Monte Carlo lite.

**Post-Phase 3 / v1 Maintenance**:
- Weekly data refresh jobs (chargers, any NHFN updates).
- Model tuning as new validation data or partner telematics arrives.
- Bug fixes and minor UX from real usage.
- Planning for v1.5 (live charger status cache, basic fleet runner, deeper cost modeling).

---

## Timeline Summary (Optimistic / Realistic / Pessimistic)

| Phase | Focus | Optimistic | Realistic | Pessimistic | Key Risk Buffer |
|-------|-------|------------|-----------|-------------|-----------------|
| 0     | Data + Validation Framework | 2.5 wks | 3 wks | 4 wks | Data cleaning / schema debates |
| 1     | Physics Engine + Basic UI | 4 wks | 5 wks | 6-7 wks | Physics calibration surprises |
| 2     | Comparison + Reporting + Charging Polish | 3.5 wks | 4 wks | 5 wks | UI iteration + export polish |
| 3     | Interactive + Accounts + PWA + v1 Hardening | 3-4 wks | 4-5 wks | 6 wks | Scope creep on what-if / auth |
| **Total to v1** | — | **13 wks** | **16 wks** | **21 wks** | — |

**Recommendation**: Staff with at least one person strong in Python/scientific computing + one strong frontend/maps. Domain expert (you or port/drayage SME) heavily involved in Phase 0 validation definition and Phase 1/2 tuning. Use your AI agent infrastructure for data ingest scripts, test generation, and documentation where high-leverage.

---

## Post-v1 Roadmap Themes (High-Level, Not Committed)

**v1.5 (Next 2-3 months after v1)**:
- Live/semi-live charger status (daily cache or limited polling + "as of" UI).
- Basic fleet batch simulation (upload CSV of loads → run many in parallel → summary dashboard).
- Deeper cost modeling (user electricity rates, driver time value, potential demand charges).
- Improved optimization (simple heuristic or intro to solver for min-time charging plans).

**v2+**:
- Native-feeling driver PWA or integration with existing ELD/companion apps.
- Rail/intermodal leg modeling (terminal transfer times, rail schedule hooks).
- Telematics calibration loop (compare sim vs actual → suggest param tweaks per truck/fleet).
- Public or partner API + embeddable widgets.
- Hydrogen / alt-fuel comparator module (if strategic priority).
- Advanced stochastic or ML-assisted components (traffic, queue time prediction).

**Longer Horizon**:
- Hybrid with commercial high-fidelity tools (PTV, AnyLogic) for operational dispatch at scale.
- Infrastructure planning layer (aggregate gap analysis across many simulated routes → charger siting recommendations).
- Policy / regulatory scenario modeling (CARB rule impacts, etc.).

---

## Governance & Change Control

- **Phase Gates**: Go/no-go or "proceed with adjustments" review at end of each phase. Involve domain expert + engineering.
- **Scope Change Process**: New "Must/Should" items require explicit trade-off discussion (drop something else or extend timeline). Document in PRD appendix.
- ** living Documents**: This roadmap, PRD, model_assumptions.md, and validation report updated at each gate.
- **Communication**: Weekly async update (or short sync) + shared dashboard (Notion, Linear, or simple MD + Git).

This phased approach transforms the original ambitious but risky 16-week plan into a controlled, evidence-driven build that delivers usable strategic value well before attempting the full original vision. It directly mitigates the over-scope, under-validated model, and tech-stack mismatch risks identified in the teardown.