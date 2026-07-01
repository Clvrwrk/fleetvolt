# Phase 3: Charging & Job Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 3-Charging & Job Pipeline
**Areas discussed:** Job pipeline & API, Charging stop selection, SoC thresholds, Feasibility tiers, Dwell time & post-charge, Charger search

---

## Job Pipeline & API

| Option | Description | Selected |
|--------|-------------|----------|
| Async new + sync keep | POST /v1/simulations → job_id; GET /v1/simulations/{id} poll; keep sync POST /v1/simulate | ✓ |
| Async only | Replace sync simulate with job pipeline everywhere | |
| You decide | Claude picks | |

**User's choice:** New async job API alongside existing sync simulate
**Notes:** Aligns with PLAT-02 deferred from Phase 2; Fastify proxies both paths; `simulation_runs` + `inputs_hash` per architecture doc.

---

## Charging Stop Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Greedy first-feasible (MVP) | Nearest HD charger at each low-SoC event; CHRG-06 weights documented for v2 | ✓ |
| Scored greedy | Rank by weighted time+energy+cost in v1 | |
| You decide | Claude picks | |

**User's choice:** Greedy first-feasible for MVP
**Notes:** CHRG-06 satisfied in v1 via transparent greedy + documented tradeoff rationale; scored optimization deferred.

---

## SoC Thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| 18% trigger, 10% floor | Default search at 18%; hard floor 10%; configurable per request | ✓ |
| 15% trigger, 8% floor | More conservative | |
| You decide | Claude picks | |

**User's choice:** 18% trigger, 10% hard floor

| Option | Description | Selected |
|--------|-------------|----------|
| 10% min arrival | Minimum SoC at destination | ✓ |
| 15% min arrival | More conservative for drayage | |
| You decide | Claude picks | |

**User's choice:** 10% minimum arrival SoC at destination

---

## Feasibility Tiers

| Option | Description | Selected |
|--------|-------------|----------|
| Three tiers + sub-reasons | feasible / critical / infeasible with public_hd, depot_required, infrastructure_gap | ✓ |
| Binary only | feasible/infeasible; defer critical | |
| You decide | Claude picks | |

**User's choice:** Three-tier verdict with infrastructure tags

| Option | Description | Selected |
|--------|-------------|----------|
| Comfort margin | Critical = completes but arrival SoC 5–10% or single stop <30 min buffer | ✓ |
| Single stop only | Critical = exactly one stop, no alternate within detour | |
| You decide | Claude picks | |

**User's choice:** Comfort-margin definition for critical tier

---

## Dwell Time & Post-Charge

| Option | Description | Selected |
|--------|-------------|----------|
| Piecewise charge curves | Integrate truck JSON charge_curve bands (CHRG-03) | ✓ (Claude discretion) |
| Flat effective kW | Simpler, less accurate | |
| You decide | Claude picks | ✓ |

**User's choice:** You decide → **piecewise charge curves** locked in CONTEXT (D-14) per CHRG-03 requirement

| Option | Description | Selected |
|--------|-------------|----------|
| Energy injection | Add kWh at stop, continue same segment array | ✓ |
| Full re-simulate | Re-run physics from stop onward | |
| You decide | Claude picks | |

**User's choice:** Energy injection post-stop

---

## Charger Search

| Option | Description | Selected |
|--------|-------------|----------|
| 25 mi, expand 50 mi | Default 25 mi radius; fallback 50 mi if none found | ✓ |
| 15 mi fixed | Tighter search | |
| You decide | Claude picks | |

**User's choice:** 25 mi with 50 mi fallback

| Option | Description | Selected |
|--------|-------------|----------|
| 10 min max detour | Valhalla detour time limit per stop | ✓ |
| 5 min max detour | Stricter | |
| You decide | Claude picks | |

**User's choice:** 10 min max detour per stop

---

## Claude's Discretion

- Dwell model: piecewise charge curves (user deferred; aligned with CHRG-03)
- OpenAPI job schema details, sync charging default, Celery retry policy, `inputs_hash` canonicalization, segment charging annotations

## Deferred Ideas

- Scored multi-objective CHRG-06 optimization (v2)
- Analyst UI (Phase 4)
- NHFN route preference (Phase 5)
- Live charger status / webhooks
- Depot charger inventory CRUD
