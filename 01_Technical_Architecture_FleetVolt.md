# Technical Architecture: FleetVolt Route v2

**Version**: 1.0 (Companion to PRD v2)  
**Date**: June 17, 2026  
**Status**: Draft for Engineering Alignment

---

## 1. Architecture Principles & Design Goals

1. **Separation of Concerns**: UI orchestration & presentation (Node/Next) vs. heavy scientific computation & spatial logic (Python). Avoid forcing numeric work into JavaScript.
2. **Modularity & Extensibility**: Physics engine, charger planner, routing adapter, and data ingest as swappable components or services. Easy to add new truck models, cost functions, or infrastructure layers.
3. **Validation-First & Observable**: Every simulation run logs full inputs + assumptions hash + outputs. Model parameters versioned. Easy to add unit tests, backtests, and regression suites.
4. **Pragmatic Performance**: Segment/event-driven simulation (not naive 1 Hz for entire US route). Pre-computation and caching for elevation, popular corridors, and charger lookups. Async job queue for longer runs.
5. **Data as First-Class**: PostGIS as spatial truth. Clear distinction between static/reference data (NHFN, charger locations, cached elevation) and dynamic/simulation results.
6. **Developer & Agent Friendly**: Clean APIs, Pydantic models, typed endpoints, comprehensive logging. Supports both human devs and AI agent orchestration (CrewAI/LangGraph patterns user already uses).
7. **Incremental Realism**: Start deterministic + rule-based charging. Layer stochastic elements, better optimization, and live data later without core rewrite.
8. **Alignment with Existing Infrastructure**: Where possible, fit user's VPS/Docker patterns, PostgreSQL comfort, and hybrid JS/Python workflows. Avoid lock-in to expensive managed services unless clear ROI.

**Target Fidelity (v1)**: "Good enough for strategic planning and feasibility" — energy estimates within ~8-12% MAPE on validated corridors under known conditions, with transparent error bands. Not a replacement for OEM digital twins or high-end simulation (AnyLogic, PTV) but complementary and more accessible/customizable for port-specific work.

---

## 2. High-Level System Context Diagram (Textual)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  Next.js App (SSR + Client Components)                           │
│  - Scenario Config Form (Zod validated)                          │
│  - Mapbox GL JS or Leaflet + Deck.gl layers                      │
│  - Results Dashboard (KPIs, Synced Chart, Charging Table)        │
│  - Scenario Comparison & Sensitivity Sliders                     │
│  - Export (PDF via react-pdf or server, CSV/JSON)                │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS / tRPC or REST + WebSocket (progress)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway / Orchestrator                   │
│  Node.js + Fastify (or NestJS)                                   │
│  - Auth (future: Clerk/Supabase or JWT)                          │
│  - Job submission & status polling                               │
│  - Results retrieval & caching (Redis)                           │
│  - User/Org/Scenario persistence (Postgres)                      │
│  - Proxy / adapter to Python Simulation Service                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Internal HTTP or gRPC / Message Queue
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              Python Simulation Service (FastAPI)                 │
│  ┌──────────────────────┐  ┌──────────────────────────────┐     │
│  │   Physics Engine     │  │   Charging & Route Planner   │     │
│  │   - Segment model    │  │   - PostGIS spatial search   │     │
│  │   - Elevation lookup │  │   - Rule-based / greedy stop │     │
│  │   - Weather adjust   │  │   - Future: MILP / heuristic │     │
│  │   - SoC integration  │  └──────────────────────────────┘     │
│  └──────────────────────┘                                        │
│  - Pydantic request/response models                              │
│  - Job queue worker (Celery + Redis or BullMQ bridge)            │
│  - Logging + assumptions hashing                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │ SQL (psycopg + GeoAlchemy)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PostgreSQL + PostGIS                         │
│  - nhfn_network (linestrings, attributes)                        │
│  - chargers (points, power_kw, connector, operator, flags)       │
│  - elevation_cache (corridor_id, segment_key, elevation_profile) │
│  - truck_configs (JSONB, versioned)                              │
│  - simulation_runs (inputs_hash, outputs JSONB, metadata)        │
│  - users/orgs/scenarios (future)                                 │
└─────────────────────────────────────────────────────────────────┘

External Data Sources (Ingestion Scripts / Scheduled Jobs):
- BTS NHFN shapefiles → PostGIS (one-time + periodic update)
- NREL AFDC (Alternative Fuel Stations) → chargers table (weekly refresh)
- Open-Elevation or Google Elevation API (batched, cached per corridor)
- OSRM / Valhalla (self-hosted or hosted) for base routing
- OpenWeatherMap (on-demand or cached for departure point/time)
```

**Key Insight**: The Python service owns the "brain" (physics + spatial optimization). Node layer owns user experience, persistence, and integration surface. This prevents the original PRD's risk of cramming complex math into a Node-heavy stack.

---

## 3. Core Components Detail

### 3.1 Frontend (Next.js 15 + TypeScript)
- **Framework Rationale**: Excellent DX, SSR for fast initial map/config load, PWA support, great ecosystem for maps (Mapbox) and forms (React Hook Form + Zod).
- **State**: Zustand (light) or Jotai for global scenario state. URL sync for shareable scenario links (nice-to-have).
- **Map Layering** (priority order):
  1. Base map (Mapbox Streets or Satellite).
  2. NHFN freight network (filtered or highlighted linestrings from PostGIS via vector tiles or GeoJSON on demand).
  3. Route polyline (from simulation or routing engine) — color gradient by SoC or instantaneous power.
  4. Charger markers (clustered if dense; size/color by kW; popup with details + "use this stop" action).
  5. Elevation/grade overlay or tooltip on hover (optional heat).
- **Visualization**:
  - KPI cards (Total Distance, Est. Duration, Net Energy kWh, Wh/mi, # Charging Stops, Total Dwell, Final SoC or Deficit).
  - Primary chart: SoC (%) or Cumulative Energy (kWh) vs Distance (mi) or Time. Brushing/tooltip syncs with map position.
  - Secondary: Power draw breakdown or speed/grade profile (toggleable).
  - Charging events table (sortable, clickable to zoom map).
- **Interactivity (Phase 2+)**: Drag to adjust stop locations (snap to charger or route); re-trigger partial simulation from changed point.
- **Theming**: Muted professional palette (navy/steel as user preference) with clear data viz (ColorBrewer or similar for SoC gradient: green → yellow → red).

**Tech Choices**:
- Map: Mapbox GL JS (best performance/polish) or react-leaflet + leaflet (lower cost, sufficient).
- Charts: Recharts (React-friendly) or Chart.js.
- PDF Export: Server-side (Puppeteer or pdfkit) or client react-pdf for summaries.
- Forms: React Hook Form + Zod + shadcn/ui components.

### 3.2 Backend Orchestration (Node.js + Fastify)
- Responsibilities: Auth (future), job lifecycle, results caching (Redis), user data, integration with external systems later (ELD, TMS).
- Why not pure Python? Faster iteration on UI-facing APIs, better WebSocket support for job progress if desired, aligns with original stack. Python service is called internally.
- Job Pattern: Submit simulation → receive job_id → poll status or WebSocket → fetch results when COMPLETE. Store raw inputs + hash for de-dupe/caching.

### 3.3 Simulation Service (Python FastAPI + Scientific Stack) — The Heart
**Why Python?**
- Mature, reproducible numeric computing (NumPy vectorized operations fast enough for segment models).
- Excellent spatial (GeoPandas, Shapely, PostGIS via SQLAlchemy/GeoAlchemy2 or psycopg).
- Optimization libraries path (PuLP, OR-Tools, scipy.optimize, or custom heuristics).
- Easy to unit test physics functions in isolation.
- User already comfortable with Python-heavy agent workflows.

**Core Modules**:
1. **PhysicsEngine**:
   - `compute_segment_energy(distance_m, avg_grade, avg_speed_mph, payload_lbs, truck_params, weather_params) -> dict` (power_avg, energy_kwh, regen_kwh, etc.).
   - Standard model:
     ```
     F_rolling = C_rr * m_total * g * cos(θ)   [θ from grade]
     F_aero = 0.5 * ρ * Cd * A * v²
     F_grade = m_total * g * sin(θ)
     F_total = F_rolling + F_aero + F_grade + F_aux (if any)
     P = F_total * v   (then account for drivetrain efficiency ~85-92%)
     ΔE = P * Δt - P_regen * regen_efficiency   (regen only on deceleration/grade down)
     ```
   - Parameters: From truck_config JSONB (battery_usable_kwh, curb_weight_lbs, CdA, C_rr, regen_efficiency, aux_kw_base, thermal_factor_temp, etc.). Many tunable.
   - Discretization: Fixed distance segments (e.g., 500m) or adaptive (by grade change or speed limit change). Pre-split route geometry.
   - Edge cases: SoC <0 projected → flag infeasible or force charge earlier; very low speed in port → higher aux/idle penalty.

2. **ElevationService**:
   - On first use for a corridor or route: Query Open-Elevation (free, rate-limited) or Google Elevation in batches → store as JSONB array or PostGIS 3D linestring in cache table keyed by route hash or corridor_id + segment.
   - Fallback: SRTM or other open DEM if needed.
   - For a route: Interpolate or nearest segment lookup.

3. **RouteProvider** (Adapter):
   - Interface to OSRM/Valhalla (self-host recommended for truck profile control — weight, height, hazmat=false for most freight) or Mapbox Directions.
   - Post-process: Snap or bias toward NHFN linestrings (PostGIS ST_ClosestPoint or graph overlay).
   - Future: Custom cost function (energy + time) for true eco-routing.

4. **ChargerPlanner**:
   - Given projected SoC profile + route geometry: Identify points where SoC crosses threshold.
   - Spatial query: `SELECT * FROM chargers WHERE ST_DWithin(geom, route_buffer, X_miles) AND power_kw >= 250 ORDER BY ...`
   - For each candidate: Estimate arrival SoC, required kWh, charge_time = f(kWh_needed, charger_power, battery_temp, taper_model).
   - Simple v1: Greedy — take first feasible charger that allows reaching next or destination with safety margin.
   - v1.5+: Limited lookahead or cost-based selection (dwell time vs detour).

5. **WeatherAdjuster** (Light):
   - Temp affects battery efficiency and aux (HVAC). Wind vector projected on heading for head/tail component.
   - Source: User scenario (Hot 95°F, Cold 32°F, Ideal 60°F) or live OpenWeatherMap at origin + simple interpolation.
   - Conservative: Apply scalar multipliers to base consumption (e.g., +15-25% hot/cold, +10% strong headwind).

**Job Execution**:
- FastAPI endpoint `/simulate` accepts Pydantic model (truck_id or inline params, origin, dest, payload, conditions, options).
- Enqueue Celery task (or RQ/ARQ).
- Worker: Resolve route → elevation → simulate segments → charging events → aggregate → store results JSONB + metadata.
- Return job status + final result_id.

**Performance Notes**:
- Vectorize segment calculations with NumPy where possible.
- Cache full results by input_hash (SHA256 of canonical inputs).
- For long routes: Consider coarser segments or event-based (only recompute changed portions on what-if).

### 3.4 Data Layer (PostGIS-Centric)
**Core Tables** (initial):
- `truck_configs` (id, name, version, params JSONB, source_notes, is_active)
- `chargers` (id, name, geom geography(POINT), power_kw, connector_types text[], operator, status, last_updated, source, notes)
- `nhfn_segments` or `nhfn_network` (geom geography(LINESTRING), name, type PHFS/CUFC/etc., attributes JSONB)
- `elevation_profiles` (id, route_hash or corridor_key, profile JSONB array of {dist_m, elev_m}, created_at)
- `simulation_runs` (id, created_by, inputs JSONB, inputs_hash, outputs JSONB, physics_version, charger_version, duration_ms, status, notes)
- Reference/lookup: `weather_scenarios`, `port_terminals` (for POLB selector)

**Ingestion Patterns**:
- NHFN: Download shapefile → ogr2ogr or GeoPandas to PostGIS. Add spatial index (GIST).
- Chargers: NREL AFDC CSV/JSON or API → upsert script (weekly cron or manual trigger). Enrich with power level parsing.
- Elevation: On-demand or pre-compute for high-priority corridors (POLB to major inland hubs). Store compressed or quantized.

**Spatial Queries Examples**:
- Route buffer for chargers: `ST_Buffer(route_geom::geography, 5000)` then `ST_Intersects` or `ST_DWithin`.
- Nearest on-route: More advanced — linear referencing or closest point on line.

### 3.5 External Integrations & Adapters
- **Routing**: OSRM HTTP API (truck profile) or Valhalla. Self-host on same VPS or cheap instance for control.
- **Elevation**: Open-Elevation (self-hostable) preferred over Google for cost/volume.
- **Weather**: OpenWeatherMap One Call or similar (cache responses).
- **Charger Live Status (Future)**: OCPI aggregator or direct (ChargePoint, EVgo) — start with "last known / estimated" + freshness timestamp. Heavy rate limiting and auth.
- **Future Telematics**: Webhooks or polling from Geotab/Samsara for calibration loops (compare simulated vs actual energy on completed trips).

---

## 4. Technology Stack Summary Table

| Layer              | Recommended Technology                  | Rationale / Alternative Notes |
|--------------------|-----------------------------------------|-------------------------------|
| Frontend Framework | Next.js 15 (React 19) + TS             | Original choice; strong for SSR maps & PWA. Keep. |
| UI Components      | Tailwind + shadcn/ui                   | Fast, consistent, accessible. |
| State              | Zustand or Jotai                       | Lightweight. |
| Maps               | Mapbox GL JS (preferred) or Leaflet    | Mapbox for performance & layers; Leaflet cheaper/familiar. |
| Charts             | Recharts or Chart.js                   | Recharts React-native feel. |
| Backend API        | Node.js + Fastify (or NestJS)          | Orchestration & user surface. |
| Simulation Engine  | Python 3.11+ + FastAPI                 | **Critical addition** for physics/spatial. |
| Task Queue         | Celery + Redis (Python) or BullMQ      | Async long jobs. |
| Database           | PostgreSQL 16 + PostGIS 3.x            | Original + spatial power. |
| Cache / Jobs       | Redis                                  | Results cache, job state. |
| Routing            | OSRM or Valhalla (self-hosted)         | Truck profile control. Mapbox Directions alt. |
| Spatial Libs (Py)  | GeoPandas, Shapely, GeoAlchemy2        | Or pure PostGIS + psycopg for speed. |
| Numeric (Py)       | NumPy, Pandas, SciPy                   | Vectorized segment math. |
| Validation/Types   | Pydantic (Py), Zod (TS)                | Strong contracts. |
| Deployment         | Docker Compose (local) → ECS/Fargate or VPS pattern | Aligns with user's infrastructure. |
| Monitoring         | Basic logging + Sentry or similar      | Physics edge cases important. |

**Hosting Cost Estimate (Low Volume)**: Modest — PostGIS on RDS or self-managed VPS (~$50-150/mo base), Redis, compute for occasional jobs. Scale with usage. Self-host routing engine adds one small instance.

---

## 5. Data Flow for a Typical Simulation Job (Detailed)

1. User submits config via form → Zod validates → POST `/api/simulations` (Node).
2. Node creates `simulation_runs` record (PENDING), computes inputs_hash, enqueues job to Python worker (via HTTP to FastAPI `/jobs` or shared Redis queue).
3. Python worker:
   a. Load/validate truck params (from DB or inline).
   b. Call RouteProvider → get geometry + metadata (distance, speed limits per segment if available).
   c. For geometry: Check elevation cache or batch query Open-Elevation → store.
   d. Discretize geometry into segments (Shapely/GeoPandas or turf.js equivalent in Py).
   e. For each segment: compute forces/power/energy using PhysicsEngine (NumPy arrays for batch).
   f. Accumulate SoC; when crosses threshold: ChargerPlanner.spatial_search + charge_time_estimate.
   g. Handle edge cases (infeasible, multiple stops needed).
   h. Aggregate: totals, per-segment arrays for viz, charge events list.
   i. Store outputs JSONB in `simulation_runs`, mark COMPLETE, notify (callback or poll).
4. Node polls or receives webhook → returns result_id to frontend.
5. Frontend fetches `/api/simulations/{id}/results` → renders map + charts (deserialize arrays).
6. User iterates (change payload → new job with same route cached where possible).

**Caching Opportunities**:
- Full results by inputs_hash (identical scenario = instant).
- Elevation profiles by route geometry hash or corridor.
- Charger spatial indexes (PostGIS GIST).
- Pre-computed "typical" profiles for popular POLB corridors.

---

## 6. Security, Compliance & Operational Considerations

- **AuthZ**: Row-level security or app-level checks on simulation_runs (user/org ownership). Future multi-tenant.
- **Data Sensitivity**: Freight routes + volumes could be commercially sensitive — encrypt at rest if needed; do not log raw payloads in plain text beyond necessary.
- **Rate Limiting & Abuse**: On simulation endpoints (costly jobs). Anonymous tier limited; authenticated higher.
- **Model Governance**: All physics parameters and versions logged per run. "Reproduce this exact result" button via inputs snapshot.
- **Disclaimers**: Prominent in UI and exports: "Physics-based estimate only. Real-world performance varies with driver behavior, vehicle condition, exact payload distribution, traffic, and unmodeled factors. Not for safety-critical or HOS compliance decisions without validation against your telematics."
- **Backup & DR**: Standard Postgres dumps + point-in-time if on RDS. Simulation results are derived; re-runnable from inputs.
- **Cost Control**: Cache aggressively. Monitor Open-Elevation/Google usage. Self-host routing to avoid per-call fees at scale.

---

## 7. Testing & Validation Strategy

**Unit**:
- Physics functions with known analytical cases (flat road, constant speed, pure grade up/down).
- Charger search spatial queries with synthetic data.
- SoC integration edge cases (negative, >100%, regen only).

**Integration**:
- End-to-end job with mocked route/elevation → verify outputs schema and reasonable numbers.

**Validation / Backtest (Critical Gate)**:
- **Level 1 (Ideal)**: Input manufacturer test conditions (empty or light payload, flat/highway, ideal temp) → output should approximate claimed range within tolerance. Document variance.
- **Level 2 (Realistic Grade)**: POLB to Inland Empire via Cajon Pass or equivalent known route. Compare against any published studies or partner data. Adjust aux/regen params if systematic bias.
- **Level 3 (Partner Telematics)**: When available — replay actual trips (origin, dest, payload estimate, departure) → compare simulated kWh vs logged. Compute MAPE, bias. Feed back into param tuning (not overfit).
- **Regression Suite**: Store reference simulation outputs; on physics change, re-run and diff key metrics (total energy, stops). Alert on >X% drift without explanation.

**UI/UX Testing**: Storybook or Chromatic for components. Manual + Playwright for critical flows (config → run → export).

---

## 8. Risks Specific to Architecture & Mitigations

- **Python service complexity / deployment**: Mitigate with Docker Compose parity between local and prod; good CI; health checks.
- **Numerical stability / floating point in long routes**: Use consistent units (SI), careful accumulation, perhaps float64.
- **Route engine truck profile accuracy**: Validate OSRM/Valhalla heavy vehicle routing on known restricted bridges/roads near POLB.
- **Elevation data resolution**: SRTM/Open-Elevation ~30m; sufficient for grade energy but not micro-topography. Note in limitations.
- **Charger data staleness**: Weekly refresh job + "data as of" timestamp in UI. Manual override capability for known new stations.
- **Job queue backpressure**: Limit concurrent simulations per user/org; queue priority or FIFO with timeout.

---

## 9. Evolution Path (Beyond v1)

- **v1.5**: Interactive what-if editing of stops; basic cost module; Monte Carlo lite (parameter noise → outcome distribution).
- **v2**: Live charger status integration (cached OCPI); native-feeling PWA with offline corridor cache; simple fleet batch runner.
- **v3**: True optimization (time vs energy vs cost) via heuristic or solver; rail intermodal leg modeling; telematics calibration loop (auto-tune params per fleet); public or partner API.
- **Long-term**: Digital twin integration or hybrid with commercial tools (PTV, AnyLogic) for high-stakes operational use.

---

## 10. Recommended Immediate Next Steps (Engineering)

1. **Phase 0 Setup**:
   - Initialize monorepo or clear separation: `apps/web` (Next), `services/simulator` (Python FastAPI), `packages/shared` (types, utils).
   - Docker Compose with Postgres+PostGIS, Redis, Node, Python service.
   - Basic CI (lint, typecheck, unit tests).

2. **Data Pipeline Sprint**:
   - Script to download NHFN shapefile → PostGIS (with spatial index).
   - Script to fetch NREL AFDC (filter to high-power DC fast + MCS capable) → chargers table.
   - Prototype elevation cache for one corridor (POLB to e.g. Barstow or Inland Empire).

3. **Physics Prototype**:
   - Standalone Python notebook or script: Hardcode a simple route (flat + grade), truck params from eCascadia public data, compute SoC curve. Validate against claimed range.
   - Expose as FastAPI endpoint for one hardcoded scenario.

4. **Map + Form Spike**:
   - Next.js page with Mapbox, basic form (truck select, payload slider, origin/dest preset), mock "Run" that calls stub and renders fake results + chart.

This architecture gives a clean, maintainable foundation that can grow with the product while delivering credible results quickly on focused corridors. It directly addresses the original PRD's gaps in model fidelity, computational practicality, and data strategy.