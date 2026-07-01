# Phase 2: Physics Simulation Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 2-Physics Simulation Core
**Areas discussed:** Simulation API, Segmentation, Weather & Drayage, OEM Validation, Presets & Overrides

---

## Simulation API & Invocation

| Option | Description | Selected |
|--------|-------------|----------|
| Synchronous POST /v1/simulate | Returns full result; job queue in Phase 3 | |
| Sync with timeout + 503 | Hard cap on response time | |
| You decide | Planner picks | ✓ (invoke) |
| Fastify proxy | Matches existing stack pattern | |
| FastAPI direct only | :8000 until Phase 3 | |
| You decide | Planner picks | ✓ (proxy) |
| Flat request body | origin/dest, truck_id, presets | |
| Nested scenario object | route/truck/conditions/overrides | |
| You decide | Planner picks | ✓ (request) |
| Full segment arrays always | All segments in response | ✓ |
| Summary + segments | KPIs always, segments with limits | |
| Tiered detail param | summary vs full query param | |

**User's choice:** You decide for invoke/proxy/request; **full segment arrays** for response detail.
**Notes:** Orchestrator to lock sync FastAPI + Fastify proxy + nested scenario body.

---

## Route Segmentation & Elevation

| Option | Description | Selected |
|--------|-------------|----------|
| 150m segments | Matches Phase 1 elevation sampling | |
| 500m segments | Per architecture doc | |
| Adaptive subdivision | Grade-threshold based | |
| **10 US mile segments** | User custom (Other) | ✓ |
| Cache first + live fallback | Preset corridors cached; custom O/D live | ✓ |
| Pure 10mi average grade | May smooth Cajon | |
| 10mi + subdivide >6% grade | Cajon fidelity compromise | |
| You decide | Document tradeoff | ✓ (grade fidelity) |
| Posted limits from Valhalla | Primary speed source | ✓ |
| + route history overlay | User addition on top of posted limits | ✓ |

**User's choice:** **10 US mile segments**; cache-first elevation; you decide on grade subdivision; posted limits + route-history speed overlay.
**Notes:** 10 miles ≈ 16,093 m — significantly coarser than Phase 1 150m elevation samples; subdivision at |grade|>6% is discretion to preserve Cajon.

---

## Weather & Port Drayage

| Option | Description | Selected |
|--------|-------------|----------|
| PRD-style presets | Temp/headwind/thermal derate | ✓ |
| Simple multipliers only | No explicit temp | |
| POLB basin first 15 mi | Radius-based drayage | |
| Geo-fenced port polygon | POLB/LB boundary only | ✓ |

**User's choice:** PRD weather presets; geo-fenced port polygon for drayage profile.

---

## OEM Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Two reference cases | Flat OEM + POLB→Cajon | ✓ |
| Three cases | Add POLB→SB drayage | |
| API + pytest CI gate | Both surfaces | ✓ |

**User's choice:** Two cases; expose via API and CI.

---

## Corridor Presets & Physics Overrides

| Option | Description | Selected |
|--------|-------------|----------|
| JSON fixtures + GET /v1/corridors | Extend data/corridors/*.json | ✓ |
| Inline overrides + assumptions[] audit | PHYS-08 for Phase 2 | ✓ |
| Defer overrides to Phase 4 | OEM defaults only | |

**User's choice:** JSON corridor fixtures; inline overrides with audit trail.

---

## Claude's Discretion

- Sync simulate API wiring and nested OpenAPI schema
- Fastify proxy for /v1/simulate
- 10-mile segments with |grade|>6% subdivision
- Route-history speed overlay implementation
- Port polygon GeoJSON definition

## Deferred Ideas

- Charging recommendations → Phase 3
- Celery job pipeline → Phase 3
- NHFN route preference → Phase 5
- Saved override DB profiles → later phase
- Response detail tiers → not needed (full segments chosen)
