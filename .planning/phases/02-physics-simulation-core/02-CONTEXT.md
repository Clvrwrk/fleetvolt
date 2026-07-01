# Phase 2: Physics Simulation Core - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers a physics-grounded POLB drayage + Cajon Pass simulation that returns credible segment energy, forward SoC profile, and KPIs (total kWh, Wh/mi, regen recovered, total time) — **without charging stop recommendations or job-queue UI** (those belong in Phases 3–4).

Success means a planner can submit origin/destination (or corridor preset), truck config, payload, weather preset, and optional port drayage profile; receive a full segment-level result with visible Cajon grade impact; and pass OEM validation gates (±8–12% MAPE on two reference cases).
</domain>

<decisions>
## Implementation Decisions

### Simulation API & Invocation
- **D-01:** Phase 2 uses **synchronous `POST /v1/simulate`** on FastAPI — single response with full result; target **<10s p95** per ROUT-04; Celery/async job pipeline deferred to Phase 3 (PLAT-02)
- **D-02:** **Fastify proxies `/v1/simulate`** on `:4000` — same pattern as routing, trucks, elevation (orchestrator discretion per user "you decide")
- **D-03:** Request body uses a **nested scenario object**: `route{}`, `truck{}`, `conditions{}`, `overrides{}` — maps cleanly to Phase 4 analyst form (orchestrator discretion)
- **D-04:** Response **always includes full segment arrays** — every segment returns `dist_m`, `grade`, `speed`, `energy_kwh`, `soc_pct` (and related fields) for Phase 4 charting

### Route Segmentation & Elevation
- **D-05:** Physics segments use **10 US mile** discretization (~16,093 m) — user preference over metric 150m/500m defaults
- **D-06:** Elevation/grade sourcing: **cached corridor profiles first** (`elevation_profiles` for preset corridors), **live Open-Elevation fallback** for custom origin/destination pairs
- **D-07:** Within 10-mile segments, **subdivide when |grade| > 6%** to preserve Cajon Pass fidelity without abandoning mile-based segmentation (orchestrator discretion per user "you decide")
- **D-08:** Segment speed: **posted speed limits from Valhalla edge metadata** where available, capped for Class 8 truck costing; apply an **overlay of route history as the simulation builds** — accumulated prior-segment context adjusts effective speed along the route (user-specified overlay on top of posted limits)

### Weather & Port Drayage
- **D-09:** Weather presets follow **PRD-style definitions**: Ideal (20°C, 0 headwind); Hot (35°C + thermal derate); Cold (0°C + heater aux bump); Headwind (15 mph headwind + aero penalty)
- **D-10:** Port drayage profile (PHYS-07) applies inside a **geo-fenced port polygon** (POLB/Long Beach port boundary) — stop-go penalty, elevated aux kW, lower speed cap; does not blanket the entire route

### OEM Validation (PHYS-06)
- **D-11:** Two reference test cases gate validation: **(1) flat highway ideal OEM range**, **(2) POLB→Cajon with grade** — both must pass **±8–12% MAPE**
- **D-12:** Validation exposed via **`GET /v1/physics/validation`** (MAPE per case + pass/fail) **and** pytest CI gate

### Corridor Presets & Physics Overrides
- **D-13:** Corridor/terminal presets (ROUT-02) stored as **JSON fixtures** (`data/corridors/*.json`) with **`GET /v1/corridors`** listing presets; ties to existing elevation cache `corridor_key` values
- **D-14:** Truck physics overrides (PHYS-08): **inline on simulate request** with **`assumptions[]` audit trail** in response; omitting overrides = OEM defaults; support explicit reset-to-OEM semantics in API contract

### Claude's Discretion
- Exact nested request field names and OpenAPI schema shape for `/v1/simulate`
- Route-history speed overlay implementation detail (rolling average vs cumulative time/distance heuristic) — must be documented in `model_assumptions.md`
- Port polygon GeoJSON source and boundary definition file location
- Flat-highway OEM reference case constants (distance, payload, speed) sourced from public eCascadia/T680E specs
- NumPy vectorization structure and segment loop vs batch arrays

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product & Requirements
- `00_PRD_FleetVolt_Route_v2.md` — Physics model scope (M2), weather presets (S2), port drayage (S3), MAPE target ±8–12%
- `.planning/PROJECT.md` — POLB + Cajon corridors, truck models, core value
- `.planning/REQUIREMENTS.md` — PHYS-01–08, ROUT-01, ROUT-02, ROUT-04 (Phase 2 scope)
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria

### Architecture & Physics
- `01_Technical_Architecture_FleetVolt.md` §3.3 — PhysicsEngine force balance, segment discretization, parameter schema
- `02_Development_Roadmap_Phases.md` — Validation framework, `model_assumptions.md` deliverable
- `03_Data_Integration_Spec.md` — Elevation profile schema, truck config JSONB fields

### Phase 1 Handoff
- `.planning/phases/01-foundation-spatial-data/01-CONTEXT.md` — Locked stack decisions (D-01–D-17)
- `data/corridors/polb_san_bernardino.json` — Corridor preset fixture pattern
- `data/corridors/polb_cajon_pass.json` — Cajon validation corridor
- `services/simulator/app/routes/routing.py` — Valhalla truck proxy + Class 8 costing
- `services/simulator/app/routes/elevation.py` — Cached elevation API

### Research
- `.planning/research/PITFALLS.md` — Usable kWh vs nameplate, grade/elevation traps, OEM validation pitfalls
- `.planning/research/ARCHITECTURE.md` — Route → elevation → physics data flow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/simulator/app/routes/routing.py` — Valhalla `/v1/routing/route` with Class 8 truck options; polyline decode fixed in gap closure
- `services/simulator/app/routes/elevation.py` — `GET /v1/elevation/{corridor_key}` serves cached profiles with bridge filtering
- `data/trucks/ecascadia_438.json`, `data/trucks/t680e_375.json` — OEM physics params and piecewise charge curves (charge curves used in Phase 3+; physics params used now)
- `data/corridors/*.json` — Origin/dest/corridor_key fixtures for preset routes
- `packages/shared-types/src/schema.d.ts` — OpenAPI codegen; extend with simulate types

### Established Patterns
- FastAPI routes in `services/simulator/app/routes/`; registered in `main.py`
- Fastify proxy in `services/api/src/index.ts` for all `/v1/*` simulator endpoints
- pytest in `services/simulator/tests/` with `@integration` marker for Valhalla-dependent tests
- Alembic migrations for any new tables (e.g., simulation_runs may wait until Phase 3)

### Integration Points
- Simulation orchestrates: Valhalla route geometry → elevation grades → NumPy physics → SoC/KPI aggregation
- Phase 3 will consume segment arrays + SoC profile for charger planning — keep output shape stable
- Phase 4 UI will bind to nested scenario request and full segment response

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants **10 US mile** physics segments (not 150m metric sampling from Phase 1 elevation cache)
- Speed model: posted limits from Valhalla **plus route-history overlay** as simulation progresses
- Port drayage is **geo-fenced**, not a whole-route toggle
- Full segment detail in API response from day one for downstream charts

</specifics>

<deferred>
## Deferred Ideas

- **Charging stop recommendations** — Phase 3 (CHRG-*)
- **Celery job pipeline / async poll** — Phase 3 (PLAT-02)
- **NHFN route preference** — Phase 5 (ROUT-03)
- **Saved override profiles in DB** — deferred; inline overrides sufficient for Phase 2
- **Analyst map/SoC visualization** — Phase 4 (MAP-*)
- **Tiered response detail (`?detail=summary`)** — user chose full segments always; summary-only mode not needed in Phase 2

</deferred>

---

*Phase: 2-Physics Simulation Core*
*Context gathered: 2026-07-01*
