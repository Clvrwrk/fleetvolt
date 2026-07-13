# FleetVolt Route

> **Active source of truth — 2026-07-12:** FleetVolt.Network CaaS Desktop MVP is the current product and release target. The production architecture is Next.js + Convex + Google Maps/Routes + Vercel. Docker, PostGIS, Valhalla, Fastify, Python services, and the former Freight Pulse milestone are historical implementation context only; they are not executable requirements for the desktop release. Tablet/mobile work is owned by the separate FleetVolt.Network Mobile/Tablet Design project.

## What This Is

FleetVolt Route is a desktop-first web application that models physics-grounded energy consumption, charging requirements, and corridor feasibility for Class 8 battery-electric trucks (BETs) in intermodal drayage and regional freight. It serves fleet transition analysts, dispatch planners, and CleverWork consultants who need credible, auditable answers to "can this EV truck make this move?" on POLB-focused corridors — with exportable reports suitable for client deliverables and internal zero-emission strategy work.

## Core Value

A planner or analyst can configure a realistic POLB drayage + inland corridor scenario (including grade-heavy routes like Cajon Pass), run a physics-based simulation, see recommended charging stops with transparent assumptions, compare scenarios, and export a defensible report they trust enough for client or stakeholder decisions.

## Business Context

- **Customer**: Fleet transition analysts, drayage dispatch planners, port/zero-emission consultants (CleverWork internal + client-facing)
- **Revenue model**: Internal consulting capability multiplier; evolves to client-facing SaaS or deliverable product
- **Success metric**: Used in ≥3 client deliverables or internal strategy docs within 90 days of v1; 80%+ of test users rate output as credible/actionable
- **Strategy notes**: Tied to POLB ecosystem work and zero-emission freight advisory; serves as EV baseline for future hydrogen counter-scenario analysis (v2)

## Current Milestone: v2.0 Freight Pulse Network Visualizer

**Goal:** Ship a new `/pulse` tab that visualizes West-Coast freight movement (ports → highways → warehouses → last-mile) with pulsing R/Y/G volume flows, clickable hotspots, TAM/SAM/SOM overlays, and solar-charger site recommendations — a BD/sales demo surface that proves market opportunity and identifies mobile-charger deployment sites.

**Target features:**
- West Coast port selector (POLA, POLB, Hueneme, Oakland, SF, San Diego), CA-first and expandable
- Pulsing volume-flow engine on real highway geometry with a leading Class-8 SVG truck marker
- Clickable hotspots: queue/parking, congestion, trucking-HQ proximity, solar site recs (dimension-callout popups)
- TAM/SAM/SOM overlay toggles with dimension-style number callouts
- Date filter: 5yr / 1yr historical / "Live" simulation mode
- Last-mile street-level routes via Google Directions (targeted nice-to-have)
- Strict Technical Brand Geometry aesthetic (framed CAD container, blueprint grid, JetBrains Mono, GSAP motion)
- Public/paid data (BTS/FAF, Caltrans AADT/GIS, PeMS, FHWA, FMCSA, Google Traffic) with sources surfaced in a technical footer

**Key context:** This milestone introduces a NEW parallel tech stack for the `/pulse` surface only — Next.js 15 (App Router) on Vercel, Convex (state/DB), Google Maps JS API, WorkOS auth, Sentry, GSAP. This intentionally overrides v1's Docker/PostGIS/Valhalla/"no-Google-API" constraints for this surface. The existing FleetVolt Route simulation app (Phases 1–4 shipped) is unaffected. Demo target: Friday July 11, 2026. Phases continue numbering from Phase 7 (v1 Phases 5–6 remain deferred, not built).

**Production domain:** `fleetvolt.network` (Google Maps key referrer allowlist: `http://localhost:3000/*`, `http://127.0.0.1:3000/*`, `https://fleetvolt.network/*`, `https://*.fleetvolt.network/*`). Convex dev deployment: `sensible-oriole-832`. Local creds live in `apps/web/.env.local` (git-ignored), sourced from `~/.config/cleverwork/master.env`.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Physics-based segment energy model with elevation, weather, payload, and regen
- [ ] POLB drayage + Cajon Pass priority corridor validation
- [ ] Rule-based charging stop recommendations with balanced multi-objective optimization
- [ ] Truck config library: Freightliner eCascadia 438 kWh + Kenworth T680E 375 kWh
- [ ] Interactive map visualization with SoC profile and charger annotations
- [ ] Scenario comparison (2+ side-by-side)
- [ ] Exportable PDF/CSV reports with assumptions audit trail
- [ ] Emissions ton-mile comparison + energy cost per mile (Phase 2)
- [ ] Rolling cumulative TCO chart with LCFS toggle (Phase 3)
- [ ] NHFN freight network awareness and NREL charger database integration
- [ ] Docker Compose deployment on VPS

### Out of Scope

- Multi-truck fleet scheduling or MILP optimization — deferred to v2+; v1 is single-truck simulation
- Live OCPI charger availability / reservations — static NREL data with freshness indicator; real-time deferred
- Native mobile driver navigation — PWA read-only viewer possible in Phase 3; full driver app deferred
- Hydrogen or alt-fuel comparator module — v2 after EV baseline is credible
- Full stochastic Monte Carlo simulation — simple sensitivity sliders in v1
- Rail/intermodal handoff modeling — truck leg only
- Depot charging scheduling or V2G — future extension

## Context

**Prior work**: Comprehensive PRD v2, Technical Architecture, Development Roadmap, and Data Integration Spec already exist in the repo root (`00_PRD_*` through `03_Data_*`). Original PRD v1 was torn down for over-ambitious scope (16-week dual-interface + real-time OCPI + full optimization). v2 philosophy: narrow & deep first, validation-gated physics, infrastructure-realistic (sparse MCS in 2026).

**Domain**: Class 8 EV drayage from Port of Long Beach through inland terminals to hinterland destinations. Key physics challenges: payload-driven rolling resistance, Cajon Pass grade effects, port stop-go aux loads, sparse public MCS network.

**Tech direction**: Hybrid stack — Next.js 15 + TypeScript frontend; Node.js/Fastify API orchestration; Python FastAPI microservice for physics, spatial queries, emissions/TCO; PostgreSQL + PostGIS; Redis for job queue/cache; Docker Compose on VPS.

**Users (v1 primary)**:
- Fleet Transition / Sustainability Analyst — client-ready reports in <30 min
- Dispatch / Operations Planner — "can this truck make this move?" with charging plan

**Emissions & TCO extension** (confirmed in scope): Post-simulation module computing WTW ton-mile CO₂e (CA diesel vs national diesel vs EV), energy cost per mile, optional LCFS credit revenue, maintenance delta, and rolling cumulative TCO with break-even mileage. Uses EPA/CARB/GREET-aligned lookup tables.

## Constraints

- **Tech stack**: Hybrid Node + Python required for scientific computing; no pure-JS physics engine
- **Deployment**: Docker Compose on VPS (CleverWork existing patterns); not Vercel+AWS for v1
- **Timeline**: 14–18 weeks realistic for solid v1 with validation gates
- **Accuracy**: Target MAPE <8–12% on total energy vs manufacturer claims; document all assumptions
- **Performance**: Single simulation p95 <10s; map interactions <100ms
- **Data**: NREL AFDC static charger data; NHFN shapefiles; elevation via Open-Elevation or cached profiles; no Google API dependency required
- **Regulatory**: Planning/feasibility tool only — not real-time dispatch; clear disclaimers on HOS/weight limits
- **Infrastructure reality**: Model must surface sparse MCS network; distinguish "feasible today" vs "requires depot/strategic charging"

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Priority corridors: POLB drayage + Cajon Pass | Matches validation needs for grade + port profile; inland drayage is MVP sweet spot | — Pending |
| Truck models: eCascadia 438 kWh + T680E 375 kWh | Strong public spec data; covers two major OEMs without library bloat | — Pending |
| Optimization: Balanced multi-objective | Fastest/lowest-energy/lowest-cost tradeoffs matter to different users | — Pending |
| Emissions/TCO: Phase 2 core + Phase 3 full chart | High consulting value; low implementation risk post-physics | — Pending |
| Deployment: Docker Compose on VPS | Aligns with CleverWork agent/VPS patterns | — Pending |
| Hydrogen comparator: v2 | EV baseline must be credible first; supports counter-thesis work later | — Pending |
| Business model: Internal + client-facing | Consulting deliverable now, productizable later | — Pending |
| Physics: Segment-based (not 1-second loop) | Computationally efficient for optimization; validation-gated accuracy | — Pending |
| Mobile driver interface: Deferred | Desktop-first for analysts; PWA viewer only in Phase 3 | — Pending |
| **[v2.0] Freight Pulse uses parallel stack (Convex/Google Maps/WorkOS/Vercel/GSAP)** | Stakeholder has paid Google console + explicit request for accurate street-level routing; BD demo surface, not the sim engine — overrides v1 no-Google/Docker constraint for `/pulse` only | — Decided 2026-07-06 |
| **[v2.0] Freight Pulse is a new parallel surface, not a rewrite** | Existing FleetVolt Route sim app (Phases 1–4) stays on its Docker/PostGIS/Valhalla stack, untouched | — Decided 2026-07-06 |
| **[v2.0] Phases continue at Phase 7; v1 Phases 5–6 deferred** | Preserve 67% of shipped v1 work; Freight Pulse is the Friday demo priority | — Decided 2026-07-06 |
| **[v2.0] Data Intelligence Layer: provenance + usefulness rubric + static×dynamic blend** | Accuracy-first requirement from stakeholder; pulse = `static_volume × (1 + congestion_factor)`; every layer carries `{source, fetchedAt, usefulnessScore, matchMethod}`; live signals are stretch-only | — Decided 2026-07-06 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
## Milestone v3.0: Full Platform Migration (started 2026-07-07)

**Goal:** Re-platform the ENTIRE app onto Google Maps + Google Directions/Routes API + Convex + Vercel; retire the Docker Compose stack (PostGIS/Redis/Valhalla/Fastify/Python simulator/Celery) completely. Phases 11–14. Full scope + locked decisions in `.planning/MILESTONE-CONTEXT.md`.

**⚠️ Supersedes these v2.0 decisions:**
- ~~[v2.0] Freight Pulse uses parallel stack for `/pulse` only~~ → v3.0: whole app moves to the modern stack
- ~~[v2.0] Freight Pulse is a new parallel surface, not a rewrite~~ → v3.0: physics engine IS rewritten (Python → Convex TS actions)
- ~~[v2.0] Existing sim app stays on Docker/PostGIS/Valhalla untouched~~ → v3.0: Docker stack fully decommissioned

**v3.0 locked decisions:**

| Decision | Rationale | Date |
|----------|-----------|------|
| **Routing = Google Directions/Routes API** (Valhalla retired) | Removes a self-hosted Docker service; paid Google console available | 2026-07-07 |
| **Physics engine = full rewrite** to Convex TS actions (3,454 LOC Python) | True single-platform; Convex actions allow 10-min execution (fits batch sim) | 2026-07-07 |
| **Convex = full backend** (data + spatial + compute) | Chris chose full rewrite over Convex-as-data-layer-only | 2026-07-07 |
| **Hosting = Vercel**; Docker Compose decommissioned | Web + Convex native to Vercel; no VPS | 2026-07-07 |

*Last updated: 2026-07-07 — started milestone v3.0 Full Platform Migration (supersedes v2.0 parallel-stack decisions)*
*Prior: 2026-07-06 — started milestone v2.0 Freight Pulse Network Visualizer*
