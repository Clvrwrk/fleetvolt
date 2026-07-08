# Data Integration & Sources Specification: FleetVolt Route v2

**Version**: 1.0 (Companion to PRD v2)  
**Date**: June 17, 2026  
**Status**: Draft — Core for Phase 0 Execution

---

## 1. Purpose & Principles

This document catalogs every external and internal data source required for FleetVolt Route, with integration approach, refresh strategy, schema notes, known limitations, alternatives/fallbacks, and cost/risk considerations.

**Guiding Principles**:
- **Prefer Open / Low-Cost First**: NREL AFDC, BTS NHFN shapefiles, Open-Elevation, OSRM/Valhalla self-host where possible.
- **Cache Aggressively**: Elevation profiles, popular corridor routes, charger static attributes. Minimize repeated paid or rate-limited calls.
- **Explicit Freshness & Provenance**: Every dataset or derived layer carries "as_of", source, and confidence notes visible in UI where relevant.
- **Graceful Degradation**: Simulation should still run (with warnings) if live weather or real-time charger status unavailable.
- **Validation & Auditability**: Ingestion scripts are versioned, logged, and produce reproducible outputs. Simulation runs reference exact data versions used.
- **Spatial First**: PostGIS is the single source of truth for geography. All other systems (routing engines, elevation) feed into or are cached alongside it.

---

## 2. Data Source Inventory

### 2.1 BTS National Highway Freight Network (NHFN)

**Description**: Official FHWA/BTS geospatial layer defining Primary Highway Freight System (PHFS) and Critical Urban/Rural Freight Corridors (CUFC/CRFC). Critical for constraining or biasing routes to heavy-truck authorized corridors out of POLB and across the U.S.

**Access**: Public. Downloadable GIS shapefiles (national or state extracts) and summary tables from BTS/FHWA sites. Updated annually-ish per HPMS cycle.

**Integration Approach (Phase 0)**:
- Download latest national or relevant regional shapefile(s).
- Use `ogr2ogr` (GDAL) or GeoPandas → PostGIS. Create `nhfn_network` table with `geography(LINESTRING)` or `geometry`, plus attributes (PHFS flag, CUFC/CRFC, state, etc.).
- Build GIST spatial index.
- Optional: Simplify or segment for performance; add route hierarchy or speed attributes if available in data dictionary.

**Schema Sketch**:
```sql
CREATE TABLE nhfn_network (
    id SERIAL PRIMARY KEY,
    geom GEOGRAPHY(LINESTRING, 4326) NOT NULL,
    phfs_flag BOOLEAN,
    corridor_type TEXT, -- PHFS, CUFC, CRFC, etc.
    state TEXT,
    name TEXT,
    attributes JSONB, -- full original properties
    source TEXT DEFAULT 'BTS NHFN 2024/2025',
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX nhfn_network_geom_idx ON nhfn_network USING GIST(geom);
```

**Refresh**: One-time load + manual or scripted re-ingest on new annual release. Low volatility.

**Limitations / Notes**:
- Represents designated freight corridors but does not guarantee current truck restrictions (bridges, weight limits) — cross-reference with routing engine truck profile.
- Coverage good for Interstate and major highways; may miss some last-mile drayage nuances near POLB terminals.
- Use for **preference / bias / validation**, not hard constraint initially (routing engine may still propose better practical paths).

**Alternatives / Fallbacks**:
- If shapefile processing heavy: Use FHWA NHFN web visualization tool for manual reference + hardcode key corridors for MVP.
- Commercial: HERE or TomTom truck attributes (paid, higher fidelity on restrictions).

**Cost / Risk**: Free. Low risk. Main effort is data cleaning / attribute mapping in Phase 0.

---

### 2.2 NREL Alternative Fuels Data Center (AFDC) — Charger Locations

**Description**: Authoritative public database of alternative fuel stations in the U.S., including electric (DC fast, Level 2), with power levels, connector types, operator, address, and some status notes. Primary source for charger database.

**Access**: Public CSV/JSON downloads or API (some endpoints). Updated regularly (daily/weekly changes possible for new stations or status).

**Integration Approach**:
- Scheduled (weekly) or on-demand ingestion script (Python requests + pandas or direct to Postgres).
- Filter to relevant: DC fast chargers (Level 3 / DCFC) with power_kw >= 50 or 150+; any tagged MCS or high-power.
- Parse connector types, power output (some stations list multiple).
- Geocode or use provided lat/lon → `geography(POINT)`.
- Upsert logic (match on station_id or lat/lon + name fuzzy).
- Enrich: Add "qualifying_for_ev_truck" flag based on power + connector (CCS1/2, MCS emerging).
- Store history or last_updated for freshness UI.

**Schema Sketch**:
```sql
CREATE TABLE chargers (
    id SERIAL PRIMARY KEY,
    station_id TEXT UNIQUE, -- from NREL if available
    name TEXT,
    geom GEOGRAPHY(POINT, 4326) NOT NULL,
    power_kw NUMERIC, -- max or typical output
    connector_types TEXT[], -- e.g. ['CCS1', 'MCS']
    operator TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    status TEXT, -- 'available', 'planned', 'unknown', etc. (static for v1)
    is_mcs_capable BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMPTZ,
    source TEXT DEFAULT 'NREL AFDC',
    notes TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX chargers_geom_idx ON chargers USING GIST(geom);
CREATE INDEX chargers_power_idx ON chargers (power_kw);
```

**Refresh**: Weekly full or incremental pull. Script logs changes (new stations, power upgrades).

**Limitations / Notes**:
- Power levels are often "max" or nameplate; real delivered power varies with vehicle, temp, battery SoC, station load.
- Status is not real-time (OCPI or operator APIs needed for live). v1 treats as "typical / planning level" with "data as of" warning.
- Coverage excellent for public stations; misses many private/depot chargers (important for drayage — users can add manual overrides later).
- Connector evolution: CCS dominant; MCS (Megawatt) still rolling out 2026+.

**Alternatives / Fallbacks**:
- For live status (v1.5+): OCPI aggregators or direct network APIs (ChargePoint, EVgo, Tesla, etc.). Fragmented auth and schemas — high effort.
- Commercial databases (e.g., from EV infrastructure data providers) — paid but cleaner.
- Manual curation for key POLB/Inland Empire corridors in early phases.

**Cost / Risk**: Mostly free. API rate limits modest. Main risk is staleness of "available" status → mitigate with prominent "static planning data; check operator app for live" in UI.

---

### 2.3 Elevation / Topography Profiles

**Description**: Precise elevation along route segments to compute grade forces (major consumer on passes like Cajon out of LA basin).

**Access Options**:
- **Preferred (Free/Low Cost)**: Open-Elevation (self-hostable Docker image) or similar open DEM services. SRTM 30m global.
- **High Quality / Paid**: Google Elevation API (batch requests, usage billing). Mapbox Terrain or similar.
- **Precomputed / Cache-Heavy**: For priority corridors, pre-fetch and store once.

**Integration Approach**:
- On first simulation for a route (or pre-compute for popular corridors): 
  - Sample route geometry at regular intervals (e.g., every 100-500m) or at vertices + densify.
  - Batch query elevation service → store as JSONB array `{dist_along_route_m, elevation_m, grade_pct?}` or as PostGIS LINESTRINGZ / geography with Z.
- Cache key: Route geometry hash (WKT or GeoJSON normalized) + source version.
- For subsequent runs on similar/same route: Lookup cached profile → interpolate as needed.
- During simulation: For each segment, compute effective grade from elevation delta.

**Schema Sketch (Cache Table)**:
```sql
CREATE TABLE elevation_profiles (
    id SERIAL PRIMARY KEY,
    route_hash TEXT UNIQUE NOT NULL, -- SHA256 of normalized geometry or corridor_id
    corridor_key TEXT, -- e.g. 'POLB_to_InlandEmpire_Cajon'
    profile JSONB NOT NULL, -- array of {dist_m, elev_m}
    source TEXT,
    resolution_m NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Refresh**: Cache is append-only or versioned. Invalidate on major route changes or source update. Rebuild popular corridors periodically or on demand.

**Limitations / Notes**:
- 30m SRTM/Open-Elevation sufficient for energy-grade calculations (grade changes over hundreds of meters matter most). Not for micro road crown or bridge details.
- Urban / port areas: Elevation flatter; drayage energy more dominated by stop-go, aux, and low-speed rolling.
- Long routes: Cache size manageable if keyed smartly; compress JSONB or use binary if needed.

**Alternatives / Fallbacks**:
- If Open-Elevation rate-limited or down: Fallback to coarser global DEM or assume average grade per highway segment (from routing metadata if available).
- For very long hauls: Hybrid — use SRTM for known passes, approximate elsewhere.

**Cost / Risk**: Open-Elevation free/self-hosted (recommended). Google has per-request cost — cache mitigates. Risk low if caching works.

---

### 2.4 Weather / Environmental Conditions

**Description**: Ambient temperature (battery & HVAC efficiency), wind speed/direction (aero + headwind component), precipitation (minor for energy, more for safety/visibility).

**Access**:
- **Primary**: OpenWeatherMap One Call API or similar (current + forecast). Free tier generous for planning use.
- **Scenario-Based (v1 MVP)**: Pre-defined profiles (Ideal 60°F no wind, Hot 95°F, Cold 32°F with headwind) with documented scalar multipliers on base consumption. Simpler, no external dependency for core flows.
- **Live (Should Have)**: Pull for departure point + time; cache response 1-6 hours.

**Integration**:
- User selects scenario OR enables "live weather for departure".
- If live: Query at origin lat/lon + departure time (or now) → extract temp, wind vector.
- Project wind component along initial heading or average route bearing.
- Apply conservative adjustment factors inside PhysicsEngine (e.g., temp_factor, wind_factor).
- Store weather snapshot in simulation inputs for audit.

**Limitations**: Live weather is forecast at departure; actual en-route can differ significantly (especially wind on long hauls). Model should note "conditions at departure; en-route variance not modeled in detail."

**Cost / Risk**: Free tier ample. Low risk for v1 (scenario mode sufficient).

---

### 2.5 Routing Engines (OSRM / Valhalla / Mapbox)

**Description**: Generate drivable route geometry + metadata (distance, duration, speed limits, turn-by-turn) respecting truck constraints (weight, height, axle config, hazmat).

**Access**:
- **Recommended**: Self-hosted OSRM or Valhalla with heavy vehicle / truck profile enabled. Full control, no per-call cost at scale, customizable.
- **Alternative**: Mapbox Directions API (truck profile available) or HERE.
- **Fallback**: Pre-defined corridor geometries for MVP validation (hardcoded or from NHFN extracts).

**Integration**:
- Adapter interface in Python (or Node): `get_route(origin, dest, profile='truck', options) -> geometry, metadata`.
- Post-process: Optional snap or bias toward NHFN network (PostGIS closest segment or overlay cost).
- Store raw route geometry + hash for elevation caching and reproducibility.
- For drayage phase: Special handling or profile for low-speed, port-area restrictions if data available.

**Limitations**: Public/self-hosted truck profiles are good but not perfect (real bridge clearances, seasonal restrictions, construction). Always surface "routing engine output; verify with current dispatch tools or DOT for operational use."

**Cost / Risk**: Self-host ~ small VPS or container (~$10-30/mo). Mapbox usage billing if high volume. Main effort: Profile tuning and validation on POLB-area moves.

---

### 2.6 Truck Configuration & Physics Parameters (Internal + Seed Data)

**Description**: Library of Class 8 EV models with editable parameters for simulation.

**Sources**:
- Public OEM spec sheets (Freightliner eCascadia 291/438 kWh, Kenworth T680E 250/375/500 kWh, others as prioritized).
- Published studies or EPA/SmartWay equivalent for Class 8 efficiency baselines.
- User overrides + calibration from telematics (future).

**Storage**: `truck_configs` table (JSONB params) + version history. UI library view with "source / last validated" notes.

**Key Parameters (Example)**:
- `battery_usable_kwh`
- `curb_weight_lbs` (or GCW max)
- `CdA` (drag area) or `drag_coefficient` + frontal_area
- `C_rr` (rolling resistance coeff)
- `drivetrain_efficiency`
- `regen_efficiency` (typical 0.6-0.8)
- `aux_kw_base` (lights, systems) + `aux_kw_hvac_temp_factor`
- `thermal_efficiency_temp` (battery efficiency vs ambient)
- `max_charge_rate_kw` (vehicle side, for taper modeling)
- Notes on real-world range claims and conditions

**Refresh**: Manual curation on new model releases or validation data. User can fork/edit in UI for "what-if custom truck".

---

### 2.7 Simulation Results & Derived Data (Internal)

**Description**: Every run is persisted for audit, comparison, and potential re-use.

**Storage**: `simulation_runs` table with:
- `inputs` JSONB (full request + resolved route hash, truck version, data versions used)
- `inputs_hash` (for cache hit)
- `outputs` JSONB (aggregates + arrays for viz: segments, SoC series, charge_events, etc.)
- `physics_version`, `charger_version`, `routing_version`
- `duration_ms`, `status`, `created_by`, `notes`

**Benefits**: Exact reproducibility ("re-run this exact scenario"), regression testing, analytics on usage patterns, basis for future ML calibration.

---

## 3. Data Pipeline & Refresh Architecture

**Ingestion Layer** (Python scripts or Airflow/Prefect simple DAGs later):
- `ingest_nhfn.py`: One-time or annual.
- `ingest_chargers.py`: Weekly cron or triggered. Idempotent upsert. Logs delta (new/updated/removed).
- `precompute_elevation.py`: For priority corridors (list in config). Run on demand or schedule.
- `validate_data.py`: Post-ingest checks (row counts, spatial coverage for key areas, null power levels, etc.).

**Orchestration**: Simple cron on VPS or GitHub Actions / your existing agent infrastructure. Logs to file + optional Slack/ email on failure or significant delta.

**Monitoring**:
- Data freshness dashboard (internal): Last successful ingest per source + row counts + warnings (e.g., "No new chargers in 30 days").
- In simulation UI: "Charger data as of [date]" + "Elevation cached [date]" badges where relevant.

**Backup**: Postgres dumps (or managed RDS snapshots). Ingestion scripts re-runnable from source.

---

## 4. Known Gaps & Mitigation Plan

| Gap | Impact | Mitigation (v1) | Future (v1.5+) |
|-----|--------|-----------------|----------------|
| Real-time charger availability & queue times | Medium (planning confidence) | Static power levels + "planning use only; verify live" disclaimer. Cache last-known if partial OCPI integrated. | Daily/ hourly cache poll of major networks; simple queue model or historical avg. |
| Private/depot charger data | High for drayage (many ops depot-charge) | User manual add or "depot assumed at origin/dest" toggle. | Allow org-specific charger import or integration with fleet depot systems. |
| Exact truck efficiency maps (proprietary) | High (model accuracy) | Public specs + conservative aux/regen + sensitivity analysis. Validation against published studies. | Partner telematics calibration loop (per-fleet param tuning). |
| Dynamic traffic / construction / weight restrictions | Medium | Routing engine defaults + NHFN bias. Note "verify with current dispatch tools". | Integrate traffic APIs or crowd-sourced (Waze-like for trucks) if available. |
| MCS-specific power curves & vehicle compatibility | Medium (long-haul future) | Treat MCS as high-power DCFC with note on emerging standard. | Specific MCS taper models + vehicle-side max charge rate per config. |
| Port terminal operational data (dwell, appointment, chassis) | Medium-High for drayage fidelity | Configurable "port phase" with avg speed/aux penalty. User can adjust. | Integrate POLB or terminal APIs for live appointment windows or typical turn times (energy consumer). |

---

## 5. Cost & Operational Estimates (Low-Volume v1)

- **PostGIS hosting**: Self-managed on VPS (~$20-60/mo for modest DB) or RDS (~$50-100/mo starter).
- **Redis**: Small instance or managed (~$10-30/mo).
- **Elevation (if Google)**: <$10-50/mo with aggressive caching on popular corridors.
- **Weather API**: Free tier sufficient.
- **Routing self-host**: Small container or cheap VPS (~$10-20/mo).
- **Total incremental**: Likely under $150-300/mo for development + light internal use. Scales with simulation volume (compute) and any paid data.

**Main Cost Driver**: Engineer/analyst time for Phase 0 data work and ongoing validation tuning — not infrastructure.

---

## 6. Recommended Phase 0 Execution Order

1. **NHFN Ingest** (highest leverage for freight authenticity) — 2-3 days.
2. **Charger Ingest + Schema** — 2-3 days (including power parsing logic).
3. **Truck Config Seeding + Physics Param Schema** — 1-2 days.
4. **Elevation Cache Prototype** on one priority corridor (POLB to Inland Empire via known pass) — 2 days.
5. **Validation Test Cases Definition** (with domain input) + backtest script skeleton — 2-3 days.
6. **Data Pipeline Scripts + Basic Monitoring** — 1-2 days.
7. **Documentation** (this spec updated, assumptions log started) — ongoing.

**Total Phase 0 Data Effort**: ~2-3 weeks part-time or 1-1.5 weeks focused, depending on familiarity with PostGIS/GeoPandas.

---

## 7. References & Sources

- BTS NHFN: geodata.bts.gov or ops.fhwa.dot.gov/freight
- NREL AFDC: afdc.energy.gov/stations (download/API)
- Open-Elevation: github.com/Jorl17/open-elevation (or self-host)
- OSRM / Valhalla truck profiles: Project docs
- OEM spec sheets: Freightliner eCascadia, Kenworth T680E public resources (2025-2026)
- Relevant research: Drayage EV routing papers (e.g., USC/MFDRP studies on charging-aware mixed fleet drayage)

This spec ensures Phase 0 has a concrete, prioritized plan and that every data decision is traceable, auditable, and aligned with the goal of credible, infrastructure-aware EV freight modeling. Update as new sources or validation data emerge.