# Phase 3: Charging & Job Pipeline - Research

**Researched:** 2026-07-01
**Domain:** Greedy charging planner, piecewise charge curves, Celery+Redis job pipeline, Fastify job orchestration, simulation_runs caching
**Confidence:** HIGH

## Summary

Phase 3 extends the Phase 2 synchronous physics pipeline with a **greedy charging planner**, **feasibility verdict + infrastructure-tier framing**, and a **production async job path** while preserving `POST /v1/simulate` for dev/CI. The locked architecture keeps all physics and charging logic in Python (`services/simulator/`), uses **PostGIS `simulation_runs` + `inputs_hash`** for immutable results and cache hits, and enforces the **Node → HTTP → FastAPI → Celery** queue boundary — Node never pushes to Redis/Celery directly [CITED: AGENTS.md / STACK.md queue boundary rule].

The charging planner consumes Phase 2 segment arrays and forward SoC profiles, triggers at **18% SoC** (10% hard floor), searches HD chargers within **25 mi (50 mi fallback)** via existing `GET /v1/chargers/near` spatial query, validates **≤10 min detour** per stop using Valhalla multi-location `/route`, computes dwell from **piecewise OEM charge curves** (not linear kWh/kW), injects energy forward without full re-route, and emits `charging_stops[]` + `feasibility{}`. CHRG-06 multi-objective scoring is explicitly deferred — v1 satisfies the requirement via documented greedy tradeoffs in `model_assumptions.md`.

The async path adds: Fastify `POST /v1/simulations` (Node inserts `simulation_runs` PENDING, cache-check by hash, HTTP-enqueue to FastAPI), Celery worker running the extended orchestrator, worker UPDATE to COMPLETE/FAILED, and `GET /v1/simulations/{id}` poll returning full payload when complete. Docker Compose gains a `sim-worker` service; Redis broker uses **DB 0** per Phase 1 placeholder [CITED: `.planning/phases/01-foundation-spatial-data/SKELETON.md`].

**Primary recommendation:** Implement three new Python modules (`charge_curve.py`, `charging_planner.py`, `feasibility.py`) plus `RouteProvider.get_route_via()` for detour validation; extend `orchestrator.py` with an opt-in charging pass; add Alembic `003_simulation_runs`; wire Celery worker + FastAPI enqueue endpoint; add Node `pg` client for job lifecycle (not a pure proxy for async routes).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Job Pipeline & API (PLAT-02)
- **D-01:** Add **async job API** alongside Phase 2 sync path — `POST /v1/simulations` returns `{ job_id, status }`; `GET /v1/simulations/{id}` polls until `COMPLETE` with full result payload
- **D-02:** **Keep sync `POST /v1/simulate`** for dev, CI, and quick runs — same nested scenario body; Phase 3 extends response with `charging_stops` and `feasibility` when charging planner is enabled (default on for async jobs; configurable flag for sync)
- **D-03:** **Fastify (`:4000`) proxies** both `/v1/simulations` and `/v1/simulations/:id` — same pattern as `/v1/simulate`; Node creates `simulation_runs` row (PENDING), computes `inputs_hash`, forwards enqueue to FastAPI/Celery
- **D-04:** **`simulation_runs` table** in PostGIS — `id`, `inputs` JSONB, `inputs_hash`, `outputs` JSONB, `status` (PENDING/RUNNING/COMPLETE/FAILED), `physics_version`, `charger_version`, `duration_ms`, `created_at`; cache hit on identical `inputs_hash` returns stored result without recompute
- **D-05:** **Celery + Redis** for worker queue — Python worker runs full pipeline: route → elevation → physics → charging planner → aggregate → persist; Redis already in Docker Compose from Phase 1

#### Charging Stop Selection (CHRG-01, CHRG-06)
- **D-06:** **Greedy first-feasible planner for MVP** — at each low-SoC event, select nearest HD charger (per D-12/D-13) that reaches next segment or destination within detour limit; iterate until route complete or infeasible
- **D-07:** **CHRG-06 multi-objective scoring deferred to v2** — document intended weights (time, energy, cost) in `model_assumptions.md` for future scored-greedy upgrade; v1 satisfies CHRG-06 via transparent greedy + documented tradeoff rationale in assumptions panel fields

#### SoC Thresholds (CHRG-01)
- **D-08:** **18% default charge-search trigger**, **10% hard safety floor** — both overridable per request via `conditions.charging.soc_trigger_pct` / `soc_floor_pct`; aligns with PRD 15–20% range
- **D-09:** **10% minimum arrival SoC at destination** — configurable via `conditions.charging.min_arrival_soc_pct`; planner must target charge-to level that satisfies this at final segment

#### Feasibility Verdict (CHRG-04, CHRG-05)
- **D-10:** **Three-tier verdict** in response: `feasible` | `critical` | `infeasible`
- **D-11:** **Infrastructure tier tags** on verdict: `public_hd` (route completable with public HD chargers), `depot_required` (only depot/private infrastructure enables completion), `infrastructure_gap` (no charger set satisfies constraints even with depot assumption)
- **D-12:** **Critical definition** — route completes but violates comfort margin: arrival SoC between 5–10% (below D-09 target but above floor), OR requires exactly one stop with less than 30 min dwell buffer at that stop
- **D-13:** **Infeasible** includes `soc_deficit_kwh` and `blocking_reason` (e.g., no_charger_in_radius, detour_exceeded, cannot_reach_destination)

#### Dwell Time & Post-Charge (CHRG-03)
- **D-14:** **Piecewise SOC-dependent charge curves** from truck JSON (`charge_curve[]` with `soc_pct` / `max_kw` breakpoints) — integrate energy band-by-band to compute dwell seconds; not linear kWh/rated_kW
- **D-15:** **Default charge target: 80% SoC** at each stop (configurable `conditions.charging.target_soc_pct`); dwell computed from current SoC to target along curve
- **D-16:** **Energy injection post-stop** — add computed kWh to SoC at stop index in segment array; continue forward simulation on same segment geometry without full re-route or re-simulate from scratch (orchestrator discretion on segment index bookkeeping)

#### Charger Search (CHRG-02)
- **D-17:** **25 mi (40,234 m) search radius** from low-SoC geographic point; **expand to 50 mi** if zero candidates pass HD/power filters
- **D-18:** **10 min max detour per stop** — compare Valhalla route time corridor→charger→rejoin vs direct corridor continuation; reject candidates exceeding limit
- **D-19:** **HD filter: `hd_capable = true` AND `power_kw >= 350`** — MCS-aware tier per CHRG-02; reuse `GET /v1/chargers/near` spatial query with `hd_only=true` and post-filter power
- **D-20:** **Greedy tie-break** — among feasible candidates, prefer shortest detour time, then highest power_kw

#### Response Shape Extensions
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

### Deferred Ideas (OUT OF SCOPE)
- **Scored multi-objective charging optimization (CHRG-06 v2)** — weighted time/energy/cost ranking; greedy sufficient for Phase 3 MVP
- **Analyst map, SoC chart, charging table UI** — Phase 4 (MAP-*, SCEN-*)
- **NHFN route preference for charger corridor alignment** — Phase 5 (ROUT-03)
- **Live charger status / OCPI** — future integration per architecture doc
- **Webhook/callback on job complete** — poll-only for Phase 3; webhook optional later
- **Depot charger inventory in DB** — `depot_required` tier is verdict tag only; depot CRUD deferred
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHRG-01 | Recommend stops when SoC drops below configurable threshold (default 15–20%) | D-08 trigger 18%; greedy loop in `charging_planner.py`; extend `ConditionsSpec.charging` |
| CHRG-02 | Filter chargers ≥350 kW MCS-aware + HD accessibility | D-19; reuse `chargers_near` + post-filter; existing `hd_capable` column |
| CHRG-03 | Piecewise SOC-dependent dwell (not linear kWh/kW) | D-14/D-15; `charge_curve.py` band integration from `data/trucks/*.json` |
| CHRG-04 | Feasibility verdict Feasible/Critical/Infeasible + soc_deficit | D-10/D-12/D-13; `feasibility.py` post-planner classifier |
| CHRG-05 | Infrastructure tier tags public_hd / depot_required / infrastructure_gap | D-11; tier logic in `feasibility.py` based on stop sources + planner outcome |
| CHRG-06 | Multi-objective time/energy/cost tradeoffs | D-07 deferred scoring; document weights in `model_assumptions.md`; greedy tie-break D-20 satisfies MVP |
| PLAT-02 | Node Fastify submits jobs to Python FastAPI/Celery (correct queue boundary) | D-01/D-03/D-05; Node HTTP enqueue only; Celery worker + `sim-worker` Compose service |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Greedy charging planner | API / Backend (Python) | PostGIS spatial query | Physics + spatial search belong in simulator; consumes segment SoC arrays |
| Piecewise charge curve dwell | API / Backend (Python) | Truck JSON fixtures | OEM curves already in `data/trucks/`; numeric integration is Python-only |
| Valhalla detour validation | External routing (Valhalla) | Python `RouteProvider` | Multi-stop `/route` time comparison; extend existing adapter |
| Charger spatial search | Database / Storage (PostGIS) | Python `chargers_near` SQL | GIST-indexed `ST_DWithin` already in `chargers.py` |
| Feasibility verdict + tier tags | API / Backend (Python) | — | Derived from planner output; no UI in Phase 3 |
| Sync `POST /v1/simulate` extension | API / Backend (Python) | Node Fastify proxy | Same as Phase 2; add optional charging fields to response |
| `POST /v1/simulations` job submit | API / Backend (Node Fastify) | PostGIS | Node owns `simulation_runs` INSERT + cache lookup per D-03/D-04 |
| `GET /v1/simulations/{id}` poll | API / Backend (Node Fastify) | PostGIS read | Node reads job row; returns cached COMPLETE payload without Python round-trip |
| Celery task enqueue | API / Backend (Python FastAPI) | Redis broker | FastAPI receives HTTP from Node, calls `task.delay()` — single queue boundary |
| Celery worker execution | Background worker (Python) | PostGIS write | Worker runs orchestrator, UPDATEs `simulation_runs` COMPLETE/FAILED |
| `inputs_hash` computation | Shared contract | Node + Python | Both tiers must produce identical hash for cache hits; shared spec in `packages/shared` |
| `simulation_runs` schema | Database / Storage (PostGIS) | Alembic migration | New table via `003_simulation_runs.py` |
| OpenAPI / shared types | Python sim + Node API | `packages/shared-types` | Extend codegen for job + charging response shapes |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Celery** | 5.6.3 | Async simulation worker queue | STACK.md; CPU-bound physics jobs; integrates with NumPy worker processes [VERIFIED: PyPI `pip index versions celery`] |
| **redis-py** | 8.0.1 | Celery broker client | Paired with Redis 8 server in Compose [VERIFIED: PyPI] |
| **kombu** | 5.6.2 | Celery transport abstraction | Bundled with Celery 5.6 [VERIFIED: PyPI] |
| **FastAPI** | 0.138.2 | Enqueue endpoint + existing simulate | Already in simulator; owns Celery task dispatch |
| **Fastify** | 5.9.0 | Public job API on `:4000` | Phase 1–2 proxy pattern; extends with DB-backed job routes |
| **pg** (node-postgres) | 8.22.0 | Node `simulation_runs` CRUD + cache lookup | Lightweight Postgres client; no ORM needed for thin job layer [VERIFIED: npm registry `npm view pg`] |
| **Alembic** | 1.16.x | `simulation_runs` migration | Phase 1 established pattern |
| **NumPy / SciPy** | 2.5.0 / 1.18.0 | Unchanged from Phase 2 | Physics + optional curve interpolation |
| **Redis** | 8-alpine (server) | Celery broker DB 0 | Already in `docker-compose.yml` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **httpx** | ≥0.28 | Node → FastAPI enqueue HTTP | Already in Python; Node uses native `fetch` |
| **Pydantic** | 2.13.4 | Job + charging response models | Extend `schemas.py` |
| **pytest** | 8.x | Unit + integration tests | `@integration` for full job pipeline |
| **pytest-celery** | — | **Do not add** | Overkill; test task function directly + mock broker |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Celery + Redis | FastAPI BackgroundTasks | Phase 1 spike only; no retry/backpressure/worker restart safety (STACK.md forbids for production) |
| Node direct Redis enqueue | HTTP → FastAPI → Celery | Violates queue boundary; dual-language retry semantics diverge |
| BullMQ in Node for physics | Celery in Python | Cross-language duplicate queue risk (STACK.md HIGH avoid) |
| Redis for inputs_hash cache | PostGIS `simulation_runs` | D-04 locks DB persistence; Redis cache is Phase 2+ optimization only |
| OR-Tools charger optimization | Greedy MVP (D-06) | 10× scope; deferred to v1.5+ per architecture doc |
| Linear kWh/station_kW dwell | Piecewise curve (D-14) | 30%+ dwell error per PITFALLS.md Pitfall 6 |

**Installation:**

```bash
# Python (services/simulator/requirements.txt)
pip install "celery[redis]==5.6.3" "redis==8.0.1"

# Node (services/api/package.json)
npm install pg@8.22.0
```

**Version verification (2026-07-01):**

```bash
python3 -m pip index versions celery   # 5.6.3
python3 -m pip index versions redis    # 8.0.1
python3 -m pip index versions kombu    # 5.6.2
npm view pg version                    # 8.22.0
```

## Package Legitimacy Audit

> Seam `package-legitimacy check` returned SUS for PyPI packages in sandbox (missing download metadata). Manual PyPI/npm verification performed.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| celery | PyPI | 15+ yrs | Very high | github.com/celery/celery | OK | Approved |
| redis (redis-py) | PyPI | 15+ yrs | Very high | github.com/redis/redis-py | OK | Approved |
| kombu | PyPI | 15+ yrs | Very high | github.com/celery/kombu | OK | Approved |
| pg | npm | 15+ yrs | Very high | github.com/brianc/node-postgres | OK | Approved |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none (manual verification overrides sandbox SUS)

## Architecture Patterns

### System Architecture Diagram

```
[Client / CI / Phase 4 UI later]
        │
        ▼ POST /v1/simulations (async)          POST /v1/simulate (sync, proxied)
[Fastify :4000]
        │                                              │
        ├─ compute inputs_hash ────────────────────────┼──► (proxy) ──► [FastAPI :8000]
        ├─ SELECT simulation_runs WHERE inputs_hash    │                    │
        │     └─ cache HIT → return COMPLETE           │                    ▼
        ├─ INSERT simulation_runs (PENDING)              │              run_simulation()
        └─ POST /v1/internal/jobs/{id}/enqueue ────────┼──────────► Celery delay()
                │                                        │                    │
                ▼                                        │                    ▼
        [PostGIS simulation_runs] ◄──────────────────────┴────── [sim-worker Celery]
                ▲   UPDATE RUNNING/COMPLETE/FAILED                 route→elev→physics
                │   outputs JSONB                                  →charging_planner
        GET /v1/simulations/{id} (poll)                            →feasibility→persist
        [Fastify reads row, returns status + payload]
```

### Recommended Project Structure

```
services/simulator/
├── app/
│   ├── worker.py                    # Celery app + task definitions
│   ├── routes/
│   │   ├── simulate.py              # extend response (charging_stops, feasibility)
│   │   ├── simulations.py           # POST enqueue, internal job trigger
│   │   └── chargers.py              # unchanged; planner calls DB layer directly
│   └── simulation/
│       ├── orchestrator.py          # extend: optional charging pass after physics
│       ├── charge_curve.py          # piecewise dwell integration (NEW)
│       ├── charging_planner.py      # greedy stop loop (NEW)
│       ├── feasibility.py           # verdict + tier classifier (NEW)
│       ├── detour_validator.py      # Valhalla multi-stop time delta (NEW)
│       ├── inputs_hash.py           # canonical hash (Python side) (NEW)
│       └── route_provider.py        # add get_route_via() multi-stop helper
├── alembic/versions/
│   └── 003_simulation_runs.py       # NEW migration
└── tests/
    ├── test_charge_curve.py
    ├── test_charging_planner.py
    ├── test_feasibility.py
    ├── test_simulations_job.py
    └── test_inputs_hash.py

services/api/
├── src/
│   ├── index.ts                     # add /v1/simulations routes
│   ├── db.ts                        # pg pool (NEW)
│   ├── simulations.ts               # job submit/poll/cache (NEW)
│   └── inputs_hash.ts               # canonical hash (Node side) (NEW)

packages/shared/
└── inputs-hash-spec.md              # cross-language hash contract + test vectors (NEW)

docker-compose.yml                   # add sim-worker service
```

### Pattern 1: Celery Worker with FastAPI Enqueue Boundary

**What:** FastAPI exposes an internal HTTP endpoint; Node calls it after DB insert; FastAPI enqueues Celery task by `simulation_run_id`.

**When to use:** All async simulation jobs (PLAT-02).

**Example:**

```python
# Source: https://docs.celeryq.dev/en/stable/getting-started/backends-and-brokers/redis.html
from celery import Celery

celery_app = Celery("fleetvolt")
celery_app.conf.broker_url = os.environ["CELERY_BROKER_URL"]  # redis://redis:6379/0
celery_app.conf.result_backend = os.environ.get("CELERY_RESULT_BACKEND", celery_app.conf.broker_url)
celery_app.conf.task_acks_late = True
celery_app.conf.task_reject_on_worker_lost = True
celery_app.conf.broker_transport_options = {"visibility_timeout": 600}
celery_app.conf.result_backend_transport_options = {"visibility_timeout": 600}
celery_app.conf.visibility_timeout = 600

@celery_app.task(name="simulation.run", bind=True, max_retries=2, autoretry_for=(RuntimeError,))
def run_simulation_task(self, run_id: str) -> None:
    # load row → run_simulation(with_charging=True) → UPDATE simulation_runs
    ...
```

```yaml
# docker-compose.yml addition
sim-worker:
  build: ./services/simulator
  command: celery -A app.worker worker -c 2 --loglevel=info
  environment:
    DATABASE_URL: postgresql+psycopg://...
    CELERY_BROKER_URL: redis://redis:6379/0
    VALHALLA_URL: http://valhalla:8002
  depends_on:
    postgres: { condition: service_healthy }
    redis: { condition: service_healthy }
    simulator: { condition: service_started }
```

### Pattern 2: Greedy Charging Planner Loop

**What:** Forward-scan SoC array; at trigger index, spatial search + detour filter + charge + inject energy; repeat until destination or infeasible.

**When to use:** CHRG-01 MVP (D-06).

**Example:**

```python
# Source: Phase 2 orchestrator.py + segment_builder.interpolate_point_at_dist
def plan_greedy_stops(
    db, segments, soc_pct, coordinates, truck, charge_curve, conditions, route_provider
) -> tuple[list[ChargingStop], FeasibilityResult]:
    stops: list[ChargingStop] = []
    i = 0
    while i < len(segments):
        if soc_pct[i] > conditions.charging.soc_trigger_pct:
            i += 1
            continue
        if soc_pct[i] <= conditions.charging.soc_floor_pct:
            return stops, infeasible("soc_below_floor", ...)

        lon, lat = interpolate_point_at_dist(coordinates, cumulative_dist[i])
        candidates = search_hd_chargers(db, lat, lon, radius_m=40_234)  # 25 mi
        if not candidates:
            candidates = search_hd_chargers(db, lat, lon, radius_m=80_468)  # 50 mi fallback

        rejoin_lon, rejoin_lat = interpolate_point_at_dist(coordinates, cumulative_dist[min(i + 1, len-1)])
        feasible = [
            c for c in candidates
            if detour_seconds(route_provider, (lat, lon), (c.lat, c.lon), (rejoin_lat, rejoin_lon)) <= 600
        ]
        if not feasible:
            return stops, infeasible("detour_exceeded", ...)

        chosen = min(feasible, key=lambda c: (c.detour_s, -c.power_kw))  # D-20
        dwell_s, energy_kwh, dep_soc = integrate_charge_curve(
            charge_curve, arrival_soc=soc_pct[i], target_soc=conditions.charging.target_soc_pct,
            station_kw=chosen.power_kw, usable_kwh=truck.usable_kwh,
        )
        stops.append(build_stop(chosen, soc_pct[i], dep_soc, dwell_s, energy_kwh))
        soc_pct = inject_soc_from_index(soc_pct, i, dep_soc)  # D-16
        i += 1  # continue forward; do not re-route geometry
    return stops, classify_feasibility(stops, soc_pct[-1], conditions)
```

### Pattern 3: Piecewise Charge Curve Integration

**What:** Step through SOC bands defined by OEM breakpoints; at each band use `effective_kw = min(station_kw, curve_max_kw, optional_vehicle_cap)`; accumulate `energy_kwh` and `dwell_s = energy_kwh / effective_kw * 3600`.

**When to use:** CHRG-03 (D-14). Recommend **step-wise max_kw per band** (conservative vs trapezoidal — matches PITFALLS Pitfall 6 guidance).

**Example:**

```python
# Source: data/trucks/ecascadia_438.json charge_curve breakpoints
def integrate_charge_curve(
    curve: list[dict], *, arrival_soc: float, target_soc: float,
    station_kw: float, usable_kwh: float,
) -> tuple[float, float, float]:
    soc = arrival_soc
    total_kwh = 0.0
    total_s = 0.0
    while soc < target_soc - 1e-6:
        band_max_kw = max_kw_at_soc(curve, soc)  # step: use lower breakpoint's max_kw
        eff_kw = min(station_kw, band_max_kw)
        if eff_kw <= 0:
            break
        band_top = next_breakpoint_soc(curve, soc)
        target_band_soc = min(target_soc, band_top)
        kwh_needed = (target_band_soc - soc) / 100.0 * usable_kwh
        total_s += (kwh_needed / eff_kw) * 3600.0
        total_kwh += kwh_needed
        soc = target_band_soc
    dep_soc = arrival_soc + (total_kwh / usable_kwh) * 100.0
    return total_s, total_kwh, min(dep_soc, target_soc)
```

### Pattern 4: Valhalla Detour Time Validation

**What:** Compare direct leg time vs via-charger leg time using Valhalla `/route` multi-location request.

**When to use:** CHRG-02 detour cap (D-18).

**Example:**

```python
# Source: https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/
def detour_seconds(provider: RouteProvider, origin, charger, rejoin) -> float:
    direct = provider.get_route(origin[0], origin[1], rejoin[0], rejoin[1]).duration_s
    via = provider.get_route_locations([
        {"lat": origin[0], "lon": origin[1]},
        {"lat": charger[0], "lon": charger[1], "type": "via"},
        {"lat": rejoin[0], "lon": rejoin[1]},
    ]).duration_s
    return max(0.0, via - direct)
```

### Pattern 5: Cross-Language inputs_hash

**What:** Canonical JSON → SHA-256 hex; identical output in Node and Python.

**When to use:** D-04 cache hits; SCEN-04 prep.

**Recommended spec (planner discretion resolved):**

1. Build hash input object: `{ scenario: <nested request>, physics_version, charger_version }`
2. Recursively sort all object keys lexicographically
3. Serialize JSON: no whitespace, UTF-8, no trailing newline
4. Round all floats to **6 decimal places** before serialization
5. `SHA256(canonical_bytes).hexdigest()`

**Example test vector:** Same fixture in `tests/test_inputs_hash.py` (Python) and `services/api/src/inputs_hash.test.ts` (Node) must match.

### Anti-Patterns to Avoid

- **Node pushing Celery tasks directly:** Violates PLAT-02 queue boundary; use HTTP to FastAPI only.
- **Linear dwell `kWh / station_kW`:** PITFALLS Pitfall 6; under/over-estimates by 30%+ near taper zone.
- **Re-running full Valhalla route after each stop:** D-16 locks energy injection on same geometry; detour time is advisory metric only for stop selection.
- **Nameplate kWh for charge energy bands:** Use `usable_kwh` from truck config (PITFALLS Pitfall 2).
- **Pure proxy for async GET without Node DB read:** Node must read `simulation_runs` for poll; Python worker writes status.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue / retry / worker lifecycle | Custom Redis LPOP worker | Celery 5.6 + Redis | Visibility timeout, acks_late, graceful shutdown [CITED: Celery Redis docs] |
| Postgres job persistence | In-memory job map | `simulation_runs` Alembic table | Survives restarts; audit trail; cache by hash |
| Charger spatial search | Python loop over all chargers | PostGIS `ST_DWithin` (existing) | GIST index; already in `chargers.py` |
| Multi-stop route time | Haversine detour estimate | Valhalla `/route` multi-location | Truck costing, real road network |
| Charge taper modeling | Single `max_charge_rate_kw` | OEM `charge_curve[]` breakpoints | SOC-dependent taper per truck JSON |
| Cross-language types | Duplicate TS/Pydantic by hand | OpenAPI codegen in `packages/shared-types` | Phase 1–2 established pattern |
| JSON cache key hashing | Ad-hoc stringify | Shared canonical hash spec + test vectors | Node/Python mismatch silently breaks cache |

**Key insight:** The charging planner's hardest parts (spatial search, road-network detour, SOC-taper dwell) already have domain-standard implementations in the Phase 1–2 stack — Phase 3 wires them into a forward greedy loop, not new infrastructure.

## Common Pitfalls

### Pitfall 1: Queue Boundary Violation (Dual Enqueue)

**What goes wrong:** Node and Python both enqueue Celery tasks, or Node uses BullMQ for physics — duplicate execution, divergent retry semantics.

**Why it happens:** Temptation to "optimize" by pushing directly to Redis from Fastify.

**How to avoid:** Node calls only `POST ${SIMULATOR_URL}/v1/internal/jobs/{id}/enqueue`; Celery imports live only in `services/simulator/`.

**Warning signs:** Redis messages without corresponding `simulation_runs` row; two workers processing same `run_id`.

### Pitfall 2: inputs_hash Mismatch Between Node and Python

**What goes wrong:** Cache never hits; duplicate compute for identical scenarios; Phase 4 comparison broken.

**Why it happens:** Different JSON key ordering, float serialization, or missing version stamps in hash input.

**How to avoid:** Single written spec + shared test vectors; include `physics_version` and `charger_version` in hash payload.

**Warning signs:** Identical POST bodies produce different hashes in Node vs Python unit tests.

### Pitfall 3: Celery Visibility Timeout Too Low

**What goes wrong:** Long Cajon corridor jobs (>60s with charging + Valhalla detours) redelivered and executed twice.

**Why it happens:** Redis default visibility timeout is 3600s but misconfiguration or shared broker with shorter app setting.

**How to avoid:** Set **600s** in all three Celery config keys per STACK.md; `task_acks_late=True` [CITED: Celery Redis visibility timeout docs].

**Warning signs:** Duplicate `simulation_runs` COMPLETE updates; doubled `duration_ms` variance.

### Pitfall 4: Linear Charge Time

**What goes wrong:** Dwell estimates implausible; critical/feasible verdicts wrong near 80% target.

**Why it happens:** Shortcut `energy_kwh / 350 * 3600`.

**How to avoid:** Band integration per D-14; validate 10→80% time exceeds naive linear lower bound in tests.

**Warning signs:** Constant kW implied across 10–90% SOC; dwell identical regardless of arrival SOC.

### Pitfall 5: Ignoring Usable kWh for SOC Math

**What goes wrong:** Overstated range; feasibility too optimistic.

**Why it happens:** Using nameplate 438 kWh instead of 394 usable.

**How to avoid:** Reuse Phase 2 `TruckParams.usable_kwh`; charge energy bands scale on usable only.

**Warning signs:** SoC drops faster/slower than OEM expectations on validation corridors.

### Pitfall 6: Detour Validation Without Truck Costing

**What goes wrong:** Detour times computed with auto profile; false acceptance/rejection.

**Why it happens:** New Valhalla helper omits `costing: truck`.

**How to avoid:** Extend `RouteProvider._route_body` pattern for multi-location requests with same `CLASS8_TRUCK_OPTIONS`.

**Warning signs:** Detour seconds identical to car routing on restricted roads.

### Pitfall 7: Sync Simulate Breaking Phase 2 Contract

**What goes wrong:** CI/regression tests fail; Phase 2 consumers break on new required fields.

**Why it happens:** Always attaching charging fields or changing segment shape.

**How to avoid:** `options.include_charging` flag (recommend default `true` but test Phase 2 paths); preserve all Phase 2 segment keys; add optional `charging_event_segment_index`.

**Warning signs:** `test_simulate_api.py` assertion `charging_stops not in body` fails without intentional update.

## Code Examples

### Alembic simulation_runs Migration

```python
# Source: 01_Technical_Architecture_FleetVolt.md §3.4, 03_Data_Integration_Spec.md §2.7
def upgrade() -> None:
    op.create_table(
        "simulation_runs",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("inputs", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column("inputs_hash", sa.Text(), nullable=False),
        sa.Column("outputs", sa.dialects.postgresql.JSONB()),
        sa.Column("status", sa.Text(), nullable=False, server_default="PENDING"),
        sa.Column("physics_version", sa.Text(), nullable=False),
        sa.Column("charger_version", sa.Text(), nullable=False),
        sa.Column("duration_ms", sa.Integer()),
        sa.Column("error", sa.dialects.postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("simulation_runs_inputs_hash_idx", "simulation_runs", ["inputs_hash"])
    op.create_index("simulation_runs_status_idx", "simulation_runs", ["status"])
```

### Node Job Submit with Cache Hit

```typescript
// Source: Phase 3 CONTEXT D-03/D-04; services/api/src/index.ts proxy patterns
import { pool } from "./db.js";
import { computeInputsHash } from "./inputs_hash.js";

app.post("/v1/simulations", async (request, reply) => {
  const body = request.body as SimulateRequest;
  const hash = computeInputsHash(body, PHYSICS_VERSION, CHARGER_VERSION);

  const cached = await pool.query(
    `SELECT id, status, outputs FROM simulation_runs
     WHERE inputs_hash = $1 AND status = 'COMPLETE' ORDER BY created_at DESC LIMIT 1`,
    [hash],
  );
  if (cached.rows[0]) {
    return { job_id: cached.rows[0].id, status: "COMPLETE", outputs: cached.rows[0].outputs };
  }

  const inserted = await pool.query(
    `INSERT INTO simulation_runs (inputs, inputs_hash, status, physics_version, charger_version)
     VALUES ($1, $2, 'PENDING', $3, $4) RETURNING id`,
    [body, hash, PHYSICS_VERSION, CHARGER_VERSION],
  );
  const jobId = inserted.rows[0].id;

  await fetch(`${simulatorUrl}/v1/internal/jobs/${jobId}/enqueue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: body }),
  });

  return { job_id: jobId, status: "PENDING" };
});
```

### Extend SimulateResponse

```python
# Source: services/simulator/app/simulation/schemas.py pattern
class ChargingStopResult(BaseModel):
    station_id: str
    name: str | None = None
    lat: float
    lon: float
    power_kw: float
    arrival_soc_pct: float
    departure_soc_pct: float
    dwell_s: float
    energy_added_kwh: float
    detour_s: float

class FeasibilityResult(BaseModel):
    verdict: Literal["feasible", "critical", "infeasible"]
    tier: Literal["public_hd", "depot_required", "infrastructure_gap"]
    soc_deficit_kwh: float | None = None
    blocking_reason: str | None = None
    stop_count: int = 0

class SimulateResponse(BaseModel):
    segments: list[SegmentResult]
    kpis: KpiResult
    charging_stops: list[ChargingStopResult] = Field(default_factory=list)
    feasibility: FeasibilityResult | None = None
    # ... existing fields unchanged
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sync-only simulate (Phase 2) | Sync + async job pipeline | Phase 3 | Production path without breaking dev/CI sync |
| No charging in orchestrator | Greedy planner post-physics | Phase 3 | CHRG-01–05 delivered API-only |
| No simulation_runs table | Alembic 003 + cache by hash | Phase 3 | SCEN-04 foundation |
| CHRG-06 full optimizer | Greedy + documented weights | Phase 3 MVP | Meets requirement via transparency (D-07) |

**Deprecated/outdated:**
- FastAPI BackgroundTasks for simulation: acceptable Phase 0 spike only; Celery required for PLAT-02 [CITED: STACK.md patterns]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Step-wise (not trapezoidal) charge curve integration is acceptable for MVP dwell accuracy | Pattern 3 | Dwell estimates slightly conservative vs OEM; may over-estimate time in mid-SOC bands |
| A2 | Node implements job routes with direct PostGIS access (`pg`), not pure proxy to Python | Pattern 1 / D-03 | If misread as pure proxy, cache lookup and INSERT ownership unclear |
| A3 | `depot_required` tier assigned when public HD search fails but hypothetical depot charge at origin would complete route | Feasibility | Tier semantics may need user validation for consulting narratives |
| A4 | Rejoin point for detour = next segment midpoint (not destination) | Pattern 2 | Detour times slightly optimistic vs rejoin-at-destination; may accept marginal stops |
| A5 | Sync simulate `options.include_charging` defaults to `true` | Claude's discretion | CI tests expecting no charging fields need updating |

## Open Questions (RESOLVED)

1. **Exact depot_required classification algorithm** — **RESOLVED (Plan 02)**
   - What we know: D-11 defines tag semantics; depot CRUD deferred
   - Decision: If public greedy fails, run single shadow pass assuming unlimited depot at origin; if shadow succeeds tag `depot_required`, else `infrastructure_gap`
   - Implemented in `feasibility.py` per Plan 02 Task 2

2. **FAILED job error payload shape** — **RESOLVED (Plan 03)**
   - What we know: Store in `simulation_runs.error` JSONB
   - Decision: `{ "code": "valhalla_unavailable", "message": "...", "stage": "routing" }` for Phase 4 error display
   - Implemented in `worker.py` per Plan 03 Task 2

3. **Segment charging annotation field name** — **RESOLVED (Plan 02)**
   - What we know: D-23 leaves naming to orchestrator
   - Decision: Add optional `charging_event: bool = False` on `SegmentResult` plus `stop_sequence: int | None` for Phase 4 hover sync
   - Implemented in Plan 02 Task 2

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL + PostGIS | simulation_runs, chargers | ✓ (Compose) | 16 + 3.5 | — |
| Redis | Celery broker | ✓ (Compose) | 8-alpine | None — blocking for async path |
| Valhalla | Detour validation, routing | ✓ (Compose) | latest self-hosted | Mock in unit tests |
| Python 3.12 | Celery worker | ✓ (simulator Docker) | 3.12 | — |
| Node 24 | Fastify job API | ✓ (api Docker) | 24 LTS | — |
| Docker Compose | sim-worker service | ✓ | 29.x client | Local venv worker for dev without Compose |
| redis-cli (host) | Dev debugging | ✗ | — | Use `docker compose exec redis redis-cli` |

**Missing dependencies with no fallback:**
- Redis (async job pipeline cannot run without broker)

**Missing dependencies with fallback:**
- Host redis-cli → Docker exec

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x (simulator), Node typecheck for api |
| Config file | `services/simulator/pytest.ini` |
| Quick run command | `cd services/simulator && pytest tests/test_charge_curve.py tests/test_charging_planner.py tests/test_feasibility.py tests/test_inputs_hash.py -q -m "not integration" -x` |
| Full suite command | `cd services/simulator && pytest tests/ -q -m "not integration"` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHRG-01 | Stop recommended when SoC crosses 18% trigger | unit | `pytest tests/test_charging_planner.py::test_triggers_at_soc_threshold -x` | ❌ Wave 0 |
| CHRG-02 | HD + ≥350 kW filter applied | unit | `pytest tests/test_charging_planner.py::test_hd_power_filter -x` | ❌ Wave 0 |
| CHRG-03 | Piecewise dwell > linear lower bound at high SOC | unit | `pytest tests/test_charge_curve.py::test_taper_slows_above_70pct -x` | ❌ Wave 0 |
| CHRG-04 | Feasible/critical/infeasible verdict + deficit | unit | `pytest tests/test_feasibility.py::test_infeasible_soc_deficit -x` | ❌ Wave 0 |
| CHRG-05 | Tier tags on feasibility object | unit | `pytest tests/test_feasibility.py::test_public_hd_tier -x` | ❌ Wave 0 |
| CHRG-06 | Documented weights + greedy rationale in assumptions | unit/doc | `pytest tests/test_charging_planner.py::test_greedy_prefers_shorter_detour -x` + grep model_assumptions | ❌ Wave 0 |
| PLAT-02 | Async submit → worker → COMPLETE poll | integration | `pytest tests/test_simulations_job.py -m integration -x` | ❌ Wave 0 |
| PLAT-02 | inputs_hash parity Node/Python | unit | `pytest tests/test_inputs_hash.py -x` + api vitest/tsc | ❌ Wave 0 |
| D-02 | Sync simulate extended; Phase 2 keys preserved | unit | `pytest tests/test_simulate_api.py -x` (update assertions) | ✅ exists |

### Sampling Rate

- **Per task commit:** `pytest tests/test_charge_curve.py tests/test_charging_planner.py -q -m "not integration" -x`
- **Per wave merge:** `cd services/simulator && pytest tests/ -q -m "not integration"`
- **Phase gate:** Full suite green + `@integration` job pipeline test with Compose

### Wave 0 Gaps

- [ ] `tests/test_charge_curve.py` — CHRG-03 piecewise integration
- [ ] `tests/test_charging_planner.py` — CHRG-01/02 greedy + detour mock
- [ ] `tests/test_feasibility.py` — CHRG-04/05 verdict + tier
- [ ] `tests/test_simulations_job.py` — PLAT-02 async lifecycle (`@integration`)
- [ ] `tests/test_inputs_hash.py` — cross-language hash vectors
- [ ] `services/api/src/inputs_hash.ts` + test — Node hash parity
- [ ] `app/worker.py` + Celery config — framework install
- [ ] `alembic/versions/003_simulation_runs.py` — schema migration
- [ ] `model_assumptions.md` §Charging — CHRG-06 weights + greedy rationale

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in v1; defer Phase 4+ |
| V3 Session Management | no | Poll-only job API; no sessions |
| V4 Access Control | no | Single-tenant v1 |
| V5 Input Validation | yes | Pydantic `SimulateRequest` extension; Fastify body validation via shared types |
| V6 Cryptography | yes (hash only) | SHA-256 for inputs_hash; no custom crypto |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection on job poll | Tampering | Parameterized queries via `pg` prepared statements |
| Job flooding / resource exhaustion | DoS | Rate limit `POST /v1/simulations` per IP (Fastify plugin); max route distance already capped 800 mi |
| Oversized JSONB payloads | DoS | Pydantic field bounds; Postgres JSONB size monitoring |
| Internal enqueue endpoint abuse | Elevation of privilege | Bind `/v1/internal/jobs/*` to Docker network only; not exposed via Caddy public route |
| Cache poisoning via hash collision | Tampering | SHA-256; include version stamps in hash input |

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory found in project workspace. Project-level constraints sourced from `AGENTS.md`:

- Hybrid Node + Python required; no pure-JS physics engine
- Docker Compose on VPS deployment pattern
- Node → HTTP → FastAPI → Celery queue boundary (no dual queue)
- Celery + Redis for simulation workers; BullMQ Node-side deferred to PDF Phase 2+
- GSD workflow: phase work via `/gsd-execute-phase` orchestration

## Sources

### Primary (HIGH confidence)
- [Celery 5.6.3 Redis broker docs](https://docs.celeryq.dev/en/stable/getting-started/backends-and-brokers/redis.html) — broker_url, visibility_timeout triple-config, ack semantics
- [Valhalla turn-by-turn API reference](https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/) — multi-location `via`/`break` types, `waiting` parameter
- Codebase: `services/simulator/app/simulation/orchestrator.py`, `chargers.py`, `route_provider.py`, `segment_builder.py`
- Codebase: `services/api/src/index.ts` — Fastify proxy pattern
- `01_Technical_Architecture_FleetVolt.md` §3.3–3.4, §5 — job flow, simulation_runs schema
- `03_Data_Integration_Spec.md` §2.7 — simulation_runs storage
- `.planning/phases/03-charging-job-pipeline/03-CONTEXT.md` — locked decisions D-01–D-23
- `.planning/research/PITFALLS.md` — charge curve, usable kWh, HD filter pitfalls

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — job pipeline data flow diagram
- `.planning/research/STACK.md` — Celery/Redis versions, queue boundary
- `data/trucks/ecascadia_438.json` — charge_curve breakpoint shape

### Tertiary (LOW confidence)
- Cross-language canonical JSON hashing — common pattern; exact float rounding needs test vector validation (Assumption A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Celery/Redis/pg versions verified on registries; patterns match Phase 1–2 codebase
- Architecture: HIGH — CONTEXT locks greedy planner, queue boundary, and schema; codebase extension points identified
- Pitfalls: HIGH — PITFALLS.md directly addresses charge curve and HD filter risks

**Research date:** 2026-07-01
**Valid until:** 2026-07-31 (Celery/Valhalla stable; verify npm/pg if major release)
