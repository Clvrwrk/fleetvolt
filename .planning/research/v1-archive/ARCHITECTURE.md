# Architecture Research

**Domain:** Class 8 EV drayage & corridor energy modeling (planning/feasibility tools)
**Researched:** 2026-07-01
**Confidence:** MEDIUM-HIGH (cross-verified against NREL/PTV/BETOS/CHALET patterns + FleetVolt project specs; web-only claims tagged MEDIUM)

## Standard Architecture

Class 8 EV freight energy modeling systems in research and industry follow a **layered pipeline architecture** with clear separation between (1) spatial/network truth, (2) vehicle physics, (3) route generation, (4) charging feasibility, and (5) presentation/reporting. Systems range from open research frameworks (NREL FASTSim + RouteE, TUM BETOS) to commercial APIs (PTV Developer) to corridor planning tools (ChargEval/EVI-DSS, Amazon CHALET), but the component boundaries are remarkably consistent.

FleetVolt Route's hybrid Node/Python + PostGIS design aligns with this industry pattern: **Python owns the simulation brain; Node owns orchestration and UX; PostGIS owns spatial reference data.**

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER (Browser)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Scenario     │  │ Map + Route  │  │ Results      │  │ Export      │ │
│  │ Config UI    │  │ Visualization│  │ Dashboard    │  │ PDF/CSV     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
└─────────┼─────────────────┼─────────────────┼─────────────────┼────────┘
          │                 │                 │                 │
          └─────────────────┴─────────────────┴─────────────────┘
                                    │ HTTPS (REST/tRPC + job polling)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  ORCHESTRATION LAYER (Node.js / Fastify)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Auth &       │  │ Job Lifecycle│  │ Results      │  │ Scenario    │ │
│  │ Multi-tenant │  │ Submit/Poll  │  │ Cache (Redis)│  │ Persistence │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
└─────────┼─────────────────┼─────────────────┼─────────────────┼────────┘
          │                 │                 │                 │
          └─────────────────┴─────────────────┴─────────────────┘
                                    │ Internal HTTP / shared queue
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              SIMULATION CORE (Python FastAPI + Workers)                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Simulation Orchestrator                        │   │
│  │  route → elevation → discretize → physics → soc → charge plan   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │ Route       │ │ Elevation   │ │ Physics     │ │ Charger         │   │
│  │ Provider    │ │ Service     │ │ Engine      │ │ Planner         │   │
│  │ (adapter)   │ │ (cache)     │ │ (segment)   │ │ (spatial+rules) │   │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └────────┬────────┘   │
│         │               │               │                  │            │
│  ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐  ┌───────┴────────┐   │
│  │ Weather     │ │ Vehicle     │ │ Emissions/  │  │ Post-Sim       │   │
│  │ Adjuster    │ │ Config Repo │ │ TCO Module  │  │ Aggregator     │   │
│  └─────────────┘ └─────────────┘ └─────────────┘  └────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ SQL (psycopg / GeoAlchemy)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   SPATIAL DATA LAYER (PostgreSQL + PostGIS)              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐   │
│  │ NHFN       │ │ Chargers   │ │ Elevation  │ │ Simulation Runs    │   │
│  │ Network    │ │ (NREL)     │ │ Profiles   │ │ + Truck Configs    │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ batch / scheduled
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   DATA INGESTION LAYER (Python scripts / cron)           │
│  NHFN shapefiles │ NREL AFDC │ Open-Elevation │ Weather cache │ Validate  │
└─────────────────────────────────────────────────────────────────────────┘

External Services (via adapters, not owned):
  OSRM/Valhalla (routing) │ Open-Elevation (DEM) │ OpenWeatherMap (optional)
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation | FleetVolt Mapping |
|-----------|----------------|------------------------|-------------------|
| **Scenario Config UI** | Capture truck, payload, O/D, weather profile, optimization preference | React/Next.js forms + Zod validation | Next.js 15 + shadcn/ui |
| **Map Visualization** | Route polyline, SoC gradient, charger markers, NHFN overlay | Mapbox GL JS / Leaflet + vector tiles or GeoJSON | Mapbox GL JS (preferred) |
| **API Orchestrator** | Job submit/poll, auth, caching, scenario CRUD, proxy to Python | Node.js Fastify/NestJS + Redis | Node Fastify |
| **Simulation Orchestrator** | Pipeline coordination: route → elevation → segments → energy → charging → aggregate | Python worker (Celery/RQ) or FastAPI background task | Python FastAPI + Celery |
| **Route Provider** | Generate drivable geometry + distance/speed metadata; optional NHFN bias | OSRM/Valhalla adapter; PTV uses proprietary routing | OSRM/Valhalla self-hosted |
| **Elevation Service** | Grade profiles along route; cache by geometry hash | Open-Elevation batch + PostGIS cache table | `elevation_profiles` cache |
| **Physics Engine** | Segment energy: rolling + aero + grade + aux − regen; SoC integration | NumPy vectorized; FASTSim-style road-load equations | Custom segment model (not full FASTSim v1) |
| **Vehicle Config Repository** | Versioned truck parameters (battery, mass, CdA, C_rr, regen, aux) | JSONB in Postgres; OEM spec seeding | `truck_configs` table |
| **Charger Planner** | Detect SoC threshold crossings; spatial search; charge time estimate; greedy stop selection | PostGIS `ST_DWithin` + rule engine; CHALET/PTV use optimization | Greedy v1; MILP deferred v2 |
| **Weather Adjuster** | Temperature/HVAC and headwind multipliers on base consumption | Scenario presets or OpenWeatherMap at origin | Scenario presets v1 |
| **Emissions/TCO Module** | Post-simulation WTW CO₂e, energy cost, LCFS, maintenance delta | Lookup tables + Pandas aggregation | Phase 2/3 extension |
| **Spatial Data Store** | Single source of truth for network, chargers, cached profiles | PostgreSQL 16 + PostGIS 3.x with GIST indexes | Core persistence |
| **Data Ingestion** | NHFN, NREL AFDC, elevation precompute, validation checks | Python scripts + cron on VPS | Phase 0 pipelines |
| **Results Store** | Full inputs/outputs JSONB, assumptions hash, reproducibility | `simulation_runs` with version stamps | Audit trail per run |

## Industry Reference Architectures

Understanding how established systems partition work informs FleetVolt's boundaries and build order.

### NREL FASTSim + RouteE (Research Standard)

**FASTSim** models vehicle powertrains as hierarchical components: fuel/battery storage → converter/motor → wheels, driven by speed-vs-time cycles or road-load equations (rolling, aero, grade). It is **cycle-resolved** (second-by-second) but fast enough for batch analysis.

**RouteE** splits into two modules — a pattern FleetVolt should mirror conceptually:
- **RouteE-Powertrain**: Predicts energy per road **link/segment** from attributes (speed, grade, distance) — mesoscopic, ML or physics-trained.
- **RouteE-Compass**: Energy-aware routing engine (Rust core) that integrates powertrain predictions into graph search.

**Implication for FleetVolt:** Use segment-based physics (like RouteE-Powertrain) rather than 1 Hz simulation for v1 planning. Reserve cycle-resolved models for validation/backtest against OEM claims.

### TUM BETOS Framework (Long-Haul BET Operations)

Modular Python structure with explicit separation:
1. **M1–M3**: Vehicle, environment, freight property definitions
2. **M5–M7**: Drivetrain, mass, charging infrastructure models
3. **Operation Simulation**: Driving + charging actions
4. **Operation Strategy**: Charging management policies

**Implication:** Keep vehicle params, environment (weather/grade), and charging policy as **injectable modules** — not hardcoded in the orchestrator.

### PTV Developer (Commercial Reference)

Three-layer commercial architecture:
1. **Vehicle Model Database** — digital twins with battery, drag, weight, aux
2. **Routing + Consumption Engine** — topography, weather (Open-Meteo), payload at waypoints
3. **Charging Optimization** — automatic charge events when SoC constraints require

PTV treats charging as **integrated into route calculation**, not a post-hoc patch. FleetVolt v1 uses post-hoc greedy planning (acceptable for feasibility); v2 should move toward integrated optimization.

### CHALET + EVI-DSS (Corridor Infrastructure Planning)

**CHALET** (Amazon): Graph abstraction — nodes (O/D + candidate charger sites), arcs (road connections with transit time/distance), MILP to maximize OD electrification eligibility under range/time constraints.

**EVI-DSS/ChargEval**: PostGIS-centric — `pgr_dijkstra` shortest paths, `ST_DWithin` charger buffer, `ST_LineLocatePoint` for linear referencing along route, spacing analysis for corridor gaps.

**Implication:** PostGIS is the right spatial truth layer. Pre-compute or cache shortest paths for hot corridors; avoid raw spatial joins at simulation runtime without GIST indexes.

## Recommended Project Structure

```
fleetvolt/
├── apps/
│   └── web/                          # Next.js 15 frontend
│       ├── app/                      # Routes, pages, API route handlers (thin)
│       ├── components/
│       │   ├── scenario/             # Config forms, truck selector
│       │   ├── map/                  # Map layers, SoC gradient, chargers
│       │   ├── results/              # Charts, KPI cards, charge table
│       │   └── export/               # PDF/CSV triggers
│       └── lib/                      # API client, Zod schemas, state (Zustand)
├── services/
│   ├── api/                          # Node Fastify orchestrator
│   │   ├── routes/                   # /simulations, /scenarios, /health
│   │   ├── jobs/                     # Redis queue bridge to Python
│   │   └── db/                       # Prisma/Drizzle or raw pg for scenarios
│   └── simulator/                    # Python FastAPI simulation service
│       ├── app/
│       │   ├── main.py               # FastAPI entry, /simulate, /jobs
│       │   ├── orchestrator.py       # Pipeline coordinator
│       │   ├── physics/              # Segment energy, SoC integration
│       │   ├── routing/              # OSRM/Valhalla adapter interface
│       │   ├── elevation/            # Cache lookup + Open-Elevation client
│       │   ├── charging/             # Spatial search + greedy planner
│       │   ├── weather/              # Scenario presets + optional API
│       │   ├── emissions/            # Phase 2: WTW, cost, TCO
│       │   └── models/               # Pydantic request/response schemas
│       ├── workers/                  # Celery tasks
│       └── tests/                    # Physics unit tests, integration
├── packages/
│   └── shared/                       # Shared types (OpenAPI-generated or manual)
├── scripts/
│   └── ingest/                       # NHFN, NREL AFDC, elevation precompute
├── infra/
│   └── docker-compose.yml            # Postgres+PostGIS, Redis, Node, Python, OSRM
└── data/                             # Seed truck configs, validation fixtures
```

### Structure Rationale

- **`services/simulator/`:** All scientific and spatial logic lives here. No physics in Node or frontend.
- **`services/api/`:** Thin orchestration — validates requests, persists scenarios, enqueues jobs, serves cached results. Does not compute energy.
- **`scripts/ingest/`:** Offline batch jobs separate from runtime simulation. PostGIS populated before any simulation runs.
- **`packages/shared/`:** Contract types between Node and Python prevent schema drift (Pydantic ↔ Zod or OpenAPI codegen).

## Architectural Patterns

### Pattern 1: Segment-Based Mesoscopic Energy Model

**What:** Discretize route into fixed-distance or adaptive segments (grade/speed change boundaries). Compute energy per segment using road-load physics, accumulate SoC. Not second-by-second.

**When to use:** Strategic planning, corridor feasibility, "can this truck make this move?" — FleetVolt v1 sweet spot.

**Trade-offs:**
- (+) 10–100× faster than cycle simulation; vectorizable with NumPy
- (+) Transparent per-segment audit trail for reports
- (−) Misses transient acceleration spikes; port stop-go needs explicit aux/low-speed penalties
- (−) Requires good grade data (elevation cache quality matters)

**Example:**
```python
# Segment energy — road-load model (FASTSim/RouteE lineage)
def segment_energy_kwh(seg, truck, weather) -> float:
    m = truck.curb_weight_kg + seg.payload_kg
    v = seg.avg_speed_mps
    grade = seg.grade_rad
    f_roll = truck.c_rr * m * 9.81 * math.cos(grade)
    f_aero = 0.5 * weather.rho * truck.cda * v**2
    f_grade = m * 9.81 * math.sin(grade)
    f_total = f_roll + f_aero + f_grade
    p_mech = f_total * v + truck.aux_kw * 1000
    p_battery = p_mech / truck.drivetrain_eff if p_mech > 0 else p_mech * truck.regen_eff
    return (p_battery * seg.duration_s) / 3.6e6 * weather.temp_factor
```

### Pattern 2: Adapter Pattern for External Services

**What:** RouteProvider, ElevationProvider, WeatherProvider as swappable interfaces. Simulation orchestrator depends on interfaces, not concrete OSRM/Open-Elevation implementations.

**When to use:** Any external dependency that may change (routing engine, elevation source, weather API).

**Trade-offs:**
- (+) Test with mocks; swap OSRM → Valhalla without touching physics
- (+) MVP can use hardcoded corridor geometries behind adapter
- (−) Small interface overhead — worth it for validation fixtures

**Example:**
```python
class RouteProvider(Protocol):
    def get_route(self, origin: Point, dest: Point, profile: str) -> RouteGeometry: ...

class OSRMRouteProvider(RouteProvider):
    def get_route(self, origin, dest, profile="truck"):
        # HTTP call to self-hosted OSRM
        ...
```

### Pattern 3: Input-Hash Result Caching

**What:** Canonicalize simulation inputs (truck version, route hash, payload, weather scenario, physics version) → SHA256. Cache full outputs in Redis or Postgres; return instantly on cache hit.

**When to use:** Scenario comparison, sensitivity sliders, repeated corridor analysis.

**Trade-offs:**
- (+) Identical scenario = instant response; supports "reproduce this run"
- (+) De-dupe expensive elevation/routing work
- (−) Must version physics/charger data in hash or invalidate on model updates

### Pattern 4: PostGIS as Spatial Query Engine (Not Application Logic)

**What:** Chargers, NHFN, route buffers queried via PostGIS (`ST_DWithin`, `ST_ClosestPoint`, linear referencing). Python orchestrator calls SQL; heavy spatial math stays in database.

**When to use:** Charger discovery within route buffer; corridor gap analysis; NHFN overlay validation.

**Trade-offs:**
- (+) GIST-indexed queries scale; proven in EVI-DSS/ChargEval
- (+) Single spatial truth — no duplicate charger lists in app memory
- (−) Complex linear-referencing queries can be slow without pre-computed paths — cache hot corridors

### Pattern 5: Async Job Pipeline with Observable Stages

**What:** Simulation submitted as job → PENDING → RUNNING (stage: routing/elevation/physics/charging) → COMPLETE. Frontend polls or WebSockets for progress.

**When to use:** Any run >2s; multi-segment routes with elevation fetch.

**Trade-offs:**
- (+) Non-blocking UI; rate limiting per user/org
- (+) Retry failed stages (elevation timeout) without full restart
- (−) Job infrastructure (Redis, Celery) adds ops complexity — justified for VPS Docker Compose pattern

## Data Flow

### Primary Simulation Request Flow

```
User submits scenario (truck, O/D, payload, weather, options)
    ↓
[Next.js] Zod validate → POST /api/simulations
    ↓
[Node API] Create simulation_runs (PENDING) → compute inputs_hash → check cache
    ↓ (cache miss)
[Node API] Enqueue job → Redis/Celery → Python worker
    ↓
[Python Orchestrator]
    1. Load truck_config from PostGIS
    2. RouteProvider.get_route(origin, dest) → geometry + metadata
    3. ElevationService.get_profile(geometry) → grade per segment [cache or fetch]
    4. Discretize geometry → segment list (distance, grade, speed)
    5. PhysicsEngine.compute_segments(segments, truck, weather) → energy[], soc[]
    6. ChargerPlanner.plan(soc[], geometry) → PostGIS spatial search → charge_events[]
    7. Re-simulate post-charge segments if stops inserted
    8. Aggregate totals + viz arrays → outputs JSONB
    ↓
[PostGIS] UPDATE simulation_runs SET outputs=..., status=COMPLETE
    ↓
[Node API] Return result_id → frontend polls/fetches
    ↓
[Next.js] Render map (route + SoC gradient + chargers) + charts + export
```

### Reference Data Flow (Offline)

```
BTS NHFN shapefile ──ingest_nhfn.py──→ nhfn_network (PostGIS)
NREL AFDC CSV/API  ──ingest_chargers.py→ chargers (PostGIS, weekly)
Priority corridors ──precompute_elevation.py→ elevation_profiles (PostGIS)
OEM spec sheets    ──seed_trucks.py────→ truck_configs (PostGIS)
```

### State Management (Frontend)

```
Zustand scenario store
    ↓ (subscribe)
[Config Form] ←→ [Map Preview] ←→ [Run Button]
    ↓ (on complete)
[Results Store] ← fetch /api/simulations/{id}/results
    ↓
[Map Layers] + [SoC Chart] + [Charge Table] + [Comparison View]
```

### Key Data Flows

1. **Route → Elevation → Physics:** Route geometry is the key that unlocks elevation cache. Elevation drives grade; grade dominates energy on Cajon Pass corridors. This chain must complete before physics runs.
2. **Physics → SoC → Charger Search:** SoC profile is input to spatial charger queries. Charger selection feeds back into route timeline (dwell time) and potentially re-segmentation after charge.
3. **Simulation → Emissions/TCO (Phase 2):** Post-simulation module reads aggregate kWh + distance + payload ton-miles; does not re-run physics. Lookup tables for grid carbon intensity, diesel baseline, LCFS credits.
4. **Inputs Hash → Cache:** Identical canonical inputs skip entire Python pipeline. Critical for scenario comparison UX.

## Suggested Build Order

Dependencies between components dictate phase ordering. Build bottom-up: spatial truth → physics → integration → UI.

```
Phase 0: Foundation
  [1] Docker Compose (PostGIS, Redis)
  [2] PostGIS schema (nhfn, chargers, truck_configs, elevation_profiles, simulation_runs)
  [3] Data ingestion scripts (NHFN, NREL AFDC, truck seed)
      ↓
Phase 1: Simulation Core (Python-first, no UI)
  [4] Vehicle Config Repository (read truck_configs)
  [5] Physics Engine (standalone unit tests, flat + grade cases)
  [6] Elevation Service (cache + Open-Elevation for one corridor)
  [7] Route Provider (OSRM adapter or hardcoded POLB corridor)
  [8] Simulation Orchestrator (wire 4→7, output JSON)
      ↓
Phase 2: Charging & Spatial
  [9] Charger Planner (PostGIS ST_DWithin + greedy selection)
  [10] Full pipeline with charge-stop re-simulation
  [11] Input-hash caching
      ↓
Phase 3: API & Jobs
  [12] Python FastAPI endpoints + Celery worker
  [13] Node API orchestrator (submit/poll/results)
      ↓
Phase 4: Frontend
  [14] Scenario config form + truck selector
  [15] Map visualization (route, SoC gradient, chargers)
  [16] Results dashboard (charts, KPIs, charge table)
  [17] Scenario comparison + export
      ↓
Phase 5: Extensions
  [18] Emissions/TCO post-simulation module
  [19] Validation suite (Cajon Pass backtest, OEM range checks)
  [20] Sensitivity sliders, PDF report with assumptions audit
```

**Critical path:** PostGIS schema + ingestion → Physics Engine → Elevation + Route → Orchestrator → Charger Planner → API → UI.

**Parallelizable after Phase 0:** Physics unit tests and ingestion scripts can run in parallel. Map UI spike with mock data can start once API contract (Pydantic schemas) is defined.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1–10 users (v1 internal) | Single VPS Docker Compose; one Python worker; PostGIS on same host; OSRM container co-located |
| 10–100 users | Separate Redis; 2–4 Celery workers; read replica for PostGIS if query-heavy; pre-compute top 10 corridor elevation profiles |
| 100–1K users | Dedicated PostGIS instance; route/elevation result cache in Redis; vector tiles for NHFN/chargers instead of GeoJSON per request |
| 1K+ / SaaS | Horizontal Python workers; job priority queues; consider RouteE-Compass-style Rust routing core; CDN for static map tiles |

### Scaling Priorities

1. **First bottleneck:** PostGIS spatial queries (`ST_DWithin` on chargers along route) without GIST indexes or with uncached routes — pre-compute paths for hot O/D pairs; index all geography columns.
2. **Second bottleneck:** Elevation API rate limits — aggressive corridor caching; never call Open-Elevation per simulation for known routes.
3. **Third bottleneck:** Python worker concurrency — queue depth limits; identical-input cache bypasses workers entirely.

## Anti-Patterns

### Anti-Pattern 1: Monolithic Physics in JavaScript

**What people do:** Implement road-load equations in Node/TypeScript because "one language is simpler."

**Why it's wrong:** Loses NumPy vectorization, GeoPandas/Shapely ecosystem, and separation that NREL/PTV/BETOS all use. Harder to validate against FASTSim/OEM data.

**Do this instead:** Python FastAPI microservice for all energy/spatial computation. Node proxies requests.

### Anti-Pattern 2: Second-by-Second Simulation for Planning Tools

**What people do:** 1 Hz loop over entire US route for feasibility checks.

**Why it's wrong:** 100× slower with minimal accuracy gain for strategic planning. Port drayage needs segment-level aux modeling, not micro-acceleration.

**Do this instead:** Segment-based mesoscopic model (500m–2km segments, adaptive at grade changes). Validate against cycle model on reference corridors only.

### Anti-Pattern 3: Spatial Queries at Runtime Without Indexes or Caching

**What people do:** `ST_DWithin` on full charger table per simulation request; ChargEval documented 100% CPU on RDS from this pattern.

**Why it's wrong:** Parallel user simulations saturate database; p95 latency blows past 10s target.

**Do this instead:** GIST indexes on all geography columns; route-buffer pre-computation for popular corridors; cache charger candidates per route hash.

### Anti-Pattern 4: Charging as Post-Hoc Patch on Fixed Route

**What people do:** Compute energy on route A, then search for chargers near failure points without re-evaluating detour energy.

**Why it's wrong:** Detour to charger adds distance/grade; arrival SoC estimates wrong; "feasible" routes fail in reality.

**Do this instead:** v1 — greedy planner with detour distance estimate added to next segment. v2 — integrated charging-aware routing (PTV/RouteE-Compass pattern).

### Anti-Pattern 5: Planning Tool Presented as Dispatch System

**What people do:** Skip disclaimers; use static NREL data as live availability; ignore HOS/weight limits.

**Why it's wrong:** Liability and credibility loss with dispatch planners who know MCS network is sparse in 2026.

**Do this instead:** Explicit "planning/feasibility only" disclaimers; "data as of" timestamps; distinguish "feasible with depot charging" vs "public MCS only."

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OSRM / Valhalla | Self-hosted HTTP adapter; truck profile | Control weight/height; validate POLB-area restrictions |
| Open-Elevation | Batch HTTP on route sample points; cache in PostGIS | Self-hostable; 30m SRTM sufficient for grade energy |
| NREL AFDC | Weekly CSV/API ingest → chargers table | Static v1; power levels are nameplate not delivered |
| BTS NHFN | Annual shapefile → ogr2ogr/GeoPandas → PostGIS | Bias routes, not hard constraint initially |
| OpenWeatherMap | Optional on-demand at origin; scenario presets for v1 | En-route weather variance not modeled in detail |
| Mapbox GL JS | Client-side tiles + GeoJSON layers from API | Token cost; Leaflet alternative for cost sensitivity |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend ↔ Node API | REST or tRPC; poll job status | Thin API routes; no physics in Next.js |
| Node API ↔ Python Simulator | HTTP POST /simulate or shared Redis queue | Pydantic schemas are contract; version in headers |
| Python Simulator ↔ PostGIS | psycopg3 + parameterized SQL | Spatial queries in SQL, not Python loops |
| Python Orchestrator ↔ Modules | In-process Python imports | Physics, routing, elevation, charging as packages |
| Ingestion ↔ PostGIS | Offline scripts, not runtime | Idempotent upsert; log deltas |
| Simulation ↔ Emissions/TCO | Post-simulation function call | Reads aggregates only; no re-route |

## Sources

- [NREL FASTSim Documentation](https://natlabrockies.github.io/fastsim/) — hierarchical powertrain component model (HIGH)
- [NREL RouteE](https://www.nrel.gov/transportation/route-energy-prediction-model) — segment-based energy + energy-aware routing split (HIGH)
- [TUM BETOS Framework](https://github.com/TUMFTM/BETOS_Framework) — modular BET operation simulation structure (HIGH)
- [PTV Developer EV Consumption](https://developer.myptv.com/en/documentation/routing-api/concepts/model-based-ev-consumption-calculation-preview) — commercial vehicle model + routing + charging integration (HIGH)
- [Amazon CHALET](https://github.com/amzn/chalet-charging-location-for-electric-trucks) — graph-based corridor charging siting (HIGH)
- [ChargEval / EVI-DSS PostGIS patterns](https://evi-dss.readthedocs.io/en/latest/database.html) — spatial query architecture for EV corridor planning (MEDIUM)
- [NREL Class 8 Regional-Haul Electrification Study](https://docs.nlr.gov/docs/fy25osti/91369.pdf) — FASTSim calibration with telematics (HIGH)
- [HEVII Tool (SAE 2023-01-0708)](https://doi.org/10.4271/2023-01-0708) — fleet electrification assessment architecture (MEDIUM)
- FleetVolt `01_Technical_Architecture_FleetVolt.md` — project-specific hybrid stack design (HIGH, internal)
- FleetVolt `03_Data_Integration_Spec.md` — PostGIS schema and ingestion patterns (HIGH, internal)

---
*Architecture research for: Class 8 EV drayage & corridor energy modeling*
*Researched: 2026-07-01*
