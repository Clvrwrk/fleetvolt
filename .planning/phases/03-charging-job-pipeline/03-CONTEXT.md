# Phase 3: Charging & Job Pipeline - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers **charging stop recommendations**, **feasibility verdicts with infrastructure-tier framing**, and the **async job pipeline** (Fastify → FastAPI/Celery) on top of Phase 2's physics simulation core.

Success means a planner can submit a scenario (sync for quick dev runs or async for production), receive recommended charging stops with dwell estimates from OEM charge curves, a three-tier feasibility verdict (Feasible / Critical / Infeasible) with tier tags (public_hd / depot_required / infrastructure_gap), and persisted results via `simulation_runs` + `inputs_hash` caching — **without analyst UI** (Phase 4).

Phase 2's segment arrays, nested scenario request shape, and sync `POST /v1/simulate` remain stable; Phase 3 extends the orchestrator and adds job endpoints.
</domain>

<decisions>
## Implementation Decisions

### Job Pipeline & API (PLAT-02)
- **D-01:** Add **async job API** alongside Phase 2 sync path — `POST /v1/simulations` returns `{ job_id, status }`; `GET /v1/simulations/{id}` polls until `COMPLETE` with full result payload
- **D-02:** **Keep sync `POST /v1/simulate`** for dev, CI, and quick runs — same nested scenario body; Phase 3 extends response with `charging_stops` and `feasibility` when charging planner is enabled (default on for async jobs; configurable flag for sync)
- **D-03:** **Fastify (`:4000`) proxies** both `/v1/simulations` and `/v1/simulations/:id` — same pattern as `/v1/simulate`; Node creates `simulation_runs` row (PENDING), computes `inputs_hash`, forwards enqueue to FastAPI/Celery
- **D-04:** **`simulation_runs` table** in PostGIS — `id`, `inputs` JSONB, `inputs_hash`, `outputs` JSONB, `status` (PENDING/RUNNING/COMPLETE/FAILED), `physics_version`, `charger_version`, `duration_ms`, `created_at`; cache hit on identical `inputs_hash` returns stored result without recompute
- **D-05:** **Celery + Redis** for worker queue — Python worker runs full pipeline: route → elevation → physics → charging planner → aggregate → persist; Redis already in Docker Compose from Phase 1

### Charging Stop Selection (CHRG-01, CHRG-06)
- **D-06:** **Greedy first-feasible planner for MVP** — at each low-SoC event, select nearest HD charger (per D-12/D-13) that reaches next segment or destination within detour limit; iterate until route complete or infeasible
- **D-07:** **CHRG-06 multi-objective scoring deferred to v2** — document intended weights (time, energy, cost) in `model_assumptions.md` for future scored-greedy upgrade; v1 satisfies CHRG-06 via transparent greedy + documented tradeoff rationale in assumptions panel fields

### SoC Thresholds (CHRG-01)
- **D-08:** **18% default charge-search trigger**, **10% hard safety floor** — both overridable per request via `conditions.charging.soc_trigger_pct` / `soc_floor_pct`; aligns with PRD 15–20% range
- **D-09:** **10% minimum arrival SoC at destination** — configurable via `conditions.charging.min_arrival_soc_pct`; planner must target charge-to level that satisfies this at final segment

### Feasibility Verdict (CHRG-04, CHRG-05)
- **D-10:** **Three-tier verdict** in response: `feasible` | `critical` | `infeasible`
- **D-11:** **Infrastructure tier tags** on verdict: `public_hd` (route completable with public HD chargers), `depot_required` (only depot/private infrastructure enables completion), `infrastructure_gap` (no charger set satisfies constraints even with depot assumption)
- **D-12:** **Critical definition** — route completes but violates comfort margin: arrival SoC between 5–10% (below D-09 target but above floor), OR requires exactly one stop with less than 30 min dwell buffer at that stop
- **D-13:** **Infeasible** includes `soc_deficit_kwh` and `blocking_reason` (e.g., no_charger_in_radius, detour_exceeded, cannot_reach_destination)

### Dwell Time & Post-Charge (CHRG-03)
- **D-14:** **Piecewise SOC-dependent charge curves** from truck JSON (`charge_curve[]` with `soc_pct` / `max_kw` breakpoints) — integrate energy band-by-band to compute dwell seconds; not linear kWh/rated_kW
- **D-15:** **Default charge target: 80% SoC** at each stop (configurable `conditions.charging.target_soc_pct`); dwell computed from current SoC to target along curve
- **D-16:** **Energy injection post-stop** — add computed kWh to SoC at stop index in segment array; continue forward simulation on same segment geometry without full re-route or re-simulate from scratch (orchestrator discretion on segment index bookkeeping)

### Charger Search (CHRG-02)
- **D-17:** **25 mi (40,234 m) search radius** from low-SoC geographic point; **expand to 50 mi** if zero candidates pass HD/power filters
- **D-18:** **10 min max detour per stop** — compare Valhalla route time corridor→charger→rejoin vs direct corridor continuation; reject candidates exceeding limit
- **D-19:** **HD filter: `hd_capable = true` AND `power_kw >= 350`** — MCS-aware tier per CHRG-02; reuse `GET /v1/chargers/near` spatial query with `hd_only=true` and post-filter power
- **D-20:** **Greedy tie-break** — among feasible candidates, prefer shortest detour time, then highest power_kw

### Response Shape Extensions
- **D-21:** Async and sync (when charging enabled) responses include **`charging_stops[]`** — each stop: `station_id`, `name`, `lat`, `lon`, `power_kw`, `arrival_soc_pct`, `departure_soc_pct`, `dwell_s`, `energy_added_kwh`, `detour_s`
- **D-22:** Responses include **`feasibility{}`** — `verdict`, `tier`, `soc_deficit_kwh` (nullable), `blocking_reason` (nullable), `stop_count`
- **D-23:** Phase 2 **full segment arrays preserved** — inject stop markers or `charging_event_at_segment` index on affected segments for Phase 4 charting (orchestrator discretion on field name)

### Claude's Discretion
- Exact OpenAPI schema for `/v1/simulations` request/response and job status enum values
- Whether sync `/v1/simulate` defaults charging planner on or off (recommend: `options.include_charging: true` default for parity with async)
- Celery task naming, retry policy, and FAILED status error payload shape
- `inputs_hash` canonicalization (field ordering, float rounding) — must match between Node and Python
- Charge curve integration algorithm (trapezoidal vs step-wise max_kw bands)
- How to annotate segments with charging events for Phase 4 hover sync

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product & Requirements
- `00_PRD_FleetVolt_Route_v2.md` — Charging feasibility (M3), SoC thresholds, infrastructure framing
- `.planning/PROJECT.md` — POLB + Cajon corridors, core value proposition
- `.planning/REQUIREMENTS.md` — CHRG-01–06, PLAT-02 (Phase 3 scope)
- `.planning/ROADMAP.md` — Phase 3 goal and success criteria

### Architecture & Data
- `01_Technical_Architecture_FleetVolt.md` §3.3–3.4, §5 — Job execution flow, `simulation_runs` schema, caching by `inputs_hash`
- `03_Data_Integration_Spec.md` — `simulation_runs` storage, charger schema
- `02_Development_Roadmap_Phases.md` — Phase 3 deliverables

### Phase 2 Handoff
- `.planning/phases/02-physics-simulation-core/02-CONTEXT.md` — Sync simulate API, 10-mile segments, nested scenario, full segment arrays (D-01–D-14)
- `services/simulator/app/simulation/orchestrator.py` — Physics pipeline entry point to extend
- `services/simulator/app/routes/simulate.py` — Existing sync endpoint
- `services/api/src/index.ts` — Fastify proxy pattern

### Charging Data & APIs
- `services/simulator/app/routes/chargers.py` — `GET /v1/chargers/near` with `hd_only`, `radius_m`
- `data/trucks/ecascadia_438.json` — `charge_curve[]` breakpoints
- `data/trucks/t680e_375.json` — `charge_curve[]` breakpoints

### Research
- `.planning/research/ARCHITECTURE.md` — Results store, job pipeline data flow
- `.planning/research/PITFALLS.md` — Usable kWh vs nameplate, charger data freshness

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/simulator/app/simulation/orchestrator.py` — Extend after physics SoC integration with charging planner loop
- `services/simulator/app/routes/chargers.py` — Spatial search with PostGIS `ST_DWithin`, `hd_capable` filter, distance sort
- `data/trucks/*.json` — Piecewise `charge_curve` for dwell integration (D-14)
- `services/simulator/app/routes/routing.py` — Valhalla for detour time validation (D-18)
- `docker-compose.yml` — Redis service for Celery broker
- `services/api/src/index.ts` — Fastify proxy; add `/v1/simulations` routes

### Established Patterns
- FastAPI routes in `services/simulator/app/routes/`; Alembic for new tables
- pytest with `@integration` marker; `tests/test_simulate_api.py` asserts no `charging_stops` yet — update in Phase 3
- OpenAPI codegen in `packages/shared-types/src/schema.d.ts`
- Phase 2 nested scenario: `route{}`, `truck{}`, `conditions{}`, `overrides{}`

### Integration Points
- Charging planner consumes Phase 2 segment arrays + forward SoC profile; emits stops before/at low-SoC indices
- Node API owns `simulation_runs` INSERT + cache lookup; Python worker owns COMPLETE/FAILED update
- Phase 4 UI will poll `GET /v1/simulations/{id}` and render `charging_stops` + `feasibility`

</code_context>

<specifics>
## Specific Ideas

- User wants **production path async** but **sync simulate retained** for dev/CI — not a breaking change to Phase 2
- Greedy planner acceptable for MVP; scored multi-objective (CHRG-06) explicitly deferred with documented weights
- Comfort-margin definition for **critical** tier: tight arrival SoC (5–10%) or single stop with <30 min buffer
- Charger search: **25 mi default, 50 mi fallback**; **10 min detour cap**

</specifics>

<deferred>
## Deferred Ideas

- **Scored multi-objective charging optimization (CHRG-06 v2)** — weighted time/energy/cost ranking; greedy sufficient for Phase 3 MVP
- **Analyst map, SoC chart, charging table UI** — Phase 4 (MAP-*, SCEN-*)
- **NHFN route preference for charger corridor alignment** — Phase 5 (ROUT-03)
- **Live charger status / OCPI** — future integration per architecture doc
- **Webhook/callback on job complete** — poll-only for Phase 3; webhook optional later
- **Depot charger inventory in DB** — `depot_required` tier is verdict tag only; depot CRUD deferred

</deferred>

---

*Phase: 3-Charging & Job Pipeline*
*Context gathered: 2026-07-01*
