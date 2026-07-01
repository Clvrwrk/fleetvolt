# Pitfalls Research

**Domain:** Class 8 EV drayage & corridor energy modeling (POLB-focused freight simulation)
**Researched:** 2026-07-01
**Confidence:** HIGH (physics/infrastructure pitfalls); MEDIUM (POLB-specific operational quantification)

## Critical Pitfalls

### Pitfall 1: Validating Against OEM Range Claims Without Matching Their Hidden Assumptions

**What goes wrong:**
The physics model passes validation on "ideal flat highway" cases by tuning parameters to match Freightliner/Kenworth published ranges (155–230 mi), but real POLB drayage scenarios with full payload, port stop-go, and Cajon Pass grades produce 15–30% worse range than rated values. Stakeholders then treat all corridor outputs as equally credible.

**Why it happens:**
OEM specs explicitly assume diminishing load profiles, consistent regenerative braking, and regional duty cycles — not fully laden outbound drayage or sustained grade climbing. Developers naturally anchor validation to the only published numbers available. San Pedro Bay port assessments document trucks rated at 150 mi achieving ~120 mi under heavy loads and variable traffic.

**How to avoid:**
Define separate validation gates in Phase 0: (1) OEM ideal-case reproduction within 8–12% MAPE using documented assumptions, and (2) grade-heavy + full-payload drayage cases with conservative bounds, not OEM matching. Surface OEM assumption deltas in every report ("OEM range assumes diminishing load; your scenario uses constant 80k lb payload").

**Warning signs:**
- Ideal-case MAPE <5% but Cajon Pass scenario shows unexpectedly optimistic feasibility
- Validation test suite has only flat routes
- Users report "your tool says feasible but our pilot truck couldn't make it"
- Regen credit on descent nearly offsets all uphill energy on Cajon Pass routes

**Phase to address:**
Phase 0 (validation framework design); Phase 1 (calibration execution)

---

### Pitfall 2: Using Nominal Battery kWh Instead of Usable Energy and BMS Reserve

**What goes wrong:**
Simulations treat eCascadia "438 kWh" or T680E "375 kWh" as fully available, projecting SoC to 0% or using 100% nameplate for range calculations. Real trucks enforce BMS reserves (typically 5–10% bottom, sometimes top buffer), and usable capacity degrades with temperature and age. Routes appear feasible that would trigger limp-mode or refuse dispatch.

**Why it happens:**
Marketing specs publish nameplate pack sizes; usable kWh and reserve thresholds are buried in OEM technical docs or fleet telematics. Simulation code defaults to `battery_kwh` as a single number.

**How to avoid:**
Store `usable_kwh`, `min_soc_operating` (default 10–15%), and `max_soc_charge_target` (default 80–95% for fast-charge planning) as separate truck config fields with OEM source notes. Never project SoC below `min_soc_operating`; charge targets should default to 80% for dwell-time realism unless user overrides.

**Warning signs:**
- Simulation recommends arriving at destination with 3–5% SoC as "successful"
- Charge events add kWh exceeding nameplate capacity
- Range calculations use 100% of pack without reserve margin
- No distinction between gross and usable kWh in truck config schema

**Phase to address:**
Phase 0 (truck config schema); Phase 1 (SoC projection logic)

---

### Pitfall 3: Modeling Auxiliary Load as a Constant kW

**What goes wrong:**
Port drayage and corridor models use a fixed `aux_kw` (e.g., 3–5 kW) for the entire route. Real Class 8 BETs show highly variable auxiliary demand: HVAC and battery thermal management (BTMS) can consume 60–80% of total auxiliary power in cold weather, causing up to 50% range reduction at extreme temperatures. Hot-weather cab cooling and cold-weather battery conditioning dominate POLB-adjacent inland routes.

**Why it happens:**
FASTSim and similar tools trade detail for speed; constant aux is the default. Without telematics, teams pick a single "reasonable" number. Weather adjustment gets a scalar on drag but not on aux/BTMS.

**How to avoid:**
Implement scenario-based aux profiles: `aux_kw_port_idle`, `aux_kw_drayage_moving`, `aux_kw_highway`, plus temperature-dependent BTMS multiplier (documented from NREL/Volvo VNR studies). Default to conservative (high) aux for feasibility planning. Expose aux breakdown in assumptions audit trail.

**Warning signs:**
- Energy consumption barely changes between "Ideal" and "Hot/Cold" weather scenarios
- Port terminal dwell segments show same kW draw as highway cruise
- Summer Inland Empire and winter Cajon Pass scenarios produce identical Wh/mi
- Validation passes at 70°F only

**Phase to address:**
Phase 0 (parameter schema); Phase 1 (physics engine); Phase 2 (weather scenario UI)

---

### Pitfall 4: Overestimating Regenerative Braking Recovery

**What goes wrong:**
Models apply a flat regen efficiency (e.g., 65%) to all deceleration and downhill segments. This over-credits energy on long descents (Cajon Pass eastbound), ignores SOC-dependent regen limits (BMS switches to friction braking above ~90% SOC), and misses that regen opportunity is directional — inbound vs outbound routes on the same corridor can differ dramatically. Net energy for POLB→Inland Empire vs return leg becomes symmetric when it shouldn't be.

**Why it happens:**
Regen is easy to implement as `% × kinetic energy recovered`. Published papers note "uniform regen efficiency" is the most common modeling error. Developers want optimistic results for stakeholder buy-in.

**How to avoid:**
Cap regen power at motor/battery limits; disable regen above configurable SOC threshold; apply regen probability factor (not every braking event recovers energy — traffic stop-go reduces effectiveness); model long downhill segments with blended friction + regen per OEM BMS behavior. Validate that Cajon Pass westbound (descent) shows regen credit but not full uphill offset.

**Warning signs:**
- Return trip energy ≈ 50% of outbound on same route
- Regen kWh exceeds 30% of gross consumption on any single route
- No SOC-based regen cutoff in code
- Grade profile shows recovery on gentle grades identical to steep grades

**Phase to address:**
Phase 1 (physics engine); Phase 0 (validation — Cajon Pass asymmetric test case)

---

### Pitfall 5: Using Low-Resolution or Unfiltered Elevation Data on Grade-Heavy Corridors

**What goes wrong:**
Open-Elevation or coarse SRTM (30 m) DEM data misses short steep grades, introduces 10–16% energy estimation errors on mountainous segments, and produces artifacts at bridges/overpasses (bare-earth models show valley depth instead of roadway). Cajon Pass profiles become smoothed — underestimating peak grade and therefore both uphill consumption and downhill regen.

**Why it happens:**
Elevation APIs are easy to integrate; high-resolution USGS 1/3 arc-second data requires local caching and filtering pipelines. Teams skip NREL GradeIT-style bridge correction and bilinear interpolation to ship faster.

**How to avoid:**
Use USGS 3DEP 1/3 arc-second DEM with bilinear sampling (NREL GradeIT pattern). Cache elevation profiles per corridor in PostGIS. Apply spike filtering for bridge/overpass artifacts. Validate segment resolution: max segment length ≤ 200 m on grades >3%. Document DEM source and resolution in every simulation output.

**Warning signs:**
- Cajon Pass peak grade in model <4% when published profiles show 6%+
- Energy results highly sensitive to segment discretization (doubling segments changes total kWh >5%)
- Elevation profile shows sudden 50+ ft drops at freeway overpasses
- Open-Elevation API used without local cache or version pinning

**Phase to address:**
Phase 0 (elevation pipeline); Phase 1 (segment discretization)

---

### Pitfall 6: Linear Charger Power → Linear Charge Time

**What goes wrong:**
Charge dwell estimates use `kWh_needed / charger_nameplate_kW`, producing implausible 20-minute full charges at 350 kW or underestimating time when SOC enters CV/taper zone. For Class 8 BETs, peak efficiency often extends to 80–95% SOC but tapers sharply near full. Combined with charger-vehicle negotiation (BMS limits < station max), reported dwell times are wrong by 30%+ — breaking dispatch feasibility and HOS planning.

**Why it happens:**
Linear models are simplest to implement. NREL AFDC lists station max power, not effective power to a specific truck at a specific SOC. MCS (megawatt charging) adds another layer — short burst at 1 MW, then rapid taper.

**How to avoid:**
Implement bilinear or piecewise charge curves per truck model (CCS peak kW, taper start SOC, minimum SOC for fast charge). Use `min(station_kW, truck_max_accept_kW, BMS_limit(SOC))` per timestep. Default charge target to 80% SOC for planning; show taper disclaimer. Never assume nameplate = delivered power.

**Warning signs:**
- 0–80% charge in exactly `(0.8 × usable_kwh) / station_kW` minutes
- 350 kW station always delivers 350 kW regardless of truck or SOC
- MCS stations modeled at full 1 MW for entire session
- No charge curve documentation in truck config

**Phase to address:**
Phase 1 (charging logic v0.5); Phase 2 (enhanced charging planner)

---

### Pitfall 7: Treating NREL AFDC Data as "Truck-Ready" Public Charging Truth

**What goes wrong:**
Simulation finds "feasible" routes using AFDC-listed 150–350 kW stations that are passenger-car pull-in spots, require fleet credentials, lack MCS/CCS compatibility for Class 8, or are permanently offline. MD/HD accessibility is self-reported for non-API sites. Routes through Barstow/Victorville appear chargeable when no pull-through HD-capable station exists within range.

**Why it happens:**
AFDC is the best free national dataset — so teams treat it as ground truth. Atlas EV Hub analysis shows MD/HD suitability requires manual filtering (pull-through, site type, power level). AFDC does not track queue times, depot-only access, or connector type reliably for HD.

**How to avoid:**
Ingest AFDC with explicit `hd_accessible` flag derived from power ≥150 kW + pull-through/site-type heuristics + manual POLB corridor curation. Default planner to `hd_accessible=true` only. Show data freshness timestamp. Separate "technically reachable charger" from "operationally usable for Class 8." Maintain corridor override table for known POLB-area sites (Forum Mobility, EV Realty, WattEV, etc.).

**Warning signs:**
- Recommended stops include shopping-center Level 2 or 50 kW non-pull-through sites
- No `data_as_of` date in UI or exports
- Charger count for I-15 corridor seems high until inspected — mostly LD-only
- Users report "that charger doesn't fit our truck"

**Phase to address:**
Phase 0 (charger ingest + HD filtering); Phase 1 (charger search); Phase 2 (gap analysis)

---

### Pitfall 8: Routing Class 8 Freight on Passenger/Vehicle Profiles

**What goes wrong:**
OSRM/Mapbox default car profiles route BETs through parkways, weight-restricted bridges, or non-NHFN roads unsuitable for 80,000 lb GCW combinations. Distance and grade profiles don't match actual freight paths. POLB drayage routes miss terminal ingress/egress patterns (e.g., SR-47, I-710 connectors).

**Why it happens:**
Car routing APIs are easier than configuring Valhalla/OSRM truck profiles with weight, height, hazmat, and NHFN preferences. NHFN shapefile integration is deferred as "Phase 2."

**How to avoid:**
Configure heavy-vehicle routing profile (weight, height, length) from Phase 1. Snap/post-filter routes against NHFN layer. Provide POLB terminal → preset inland yard corridors as validated polylines. Flag routes that leave NHFN or exceed known restrictions.

**Warning signs:**
- Simulated route uses surface streets a Class 8 combination wouldn't take
- Route distance differs >10% from known drayage paths (POLB → San Bernardino)
- No truck profile parameters in routing config
- NHFN layer exists in DB but isn't consulted by router

**Phase to address:**
Phase 0 (NHFN ingest); Phase 1 (routing integration); Phase 2 (NHFN preference layer)

---

### Pitfall 9: Ignoring Port Drayage Stop-Go and Dwell Dynamics

**What goes wrong:**
POLB pickup phase modeled as steady-speed driving at 35 mph, missing terminal queue time, stop-go acceleration penalties, and high idle aux draw during chassis pickup, TWIC gates, and crane waits. Energy underestimate for port-adjacent segments reaches 18–22% in congested conditions — the exact segment where drayage BETs spend disproportionate time.

**Why it happens:**
Routing engines output road-network speeds; port terminals aren't in the graph. "Port drayage profile" gets deferred as a toggle. Constant-speed segment physics miss kinetic-intensity effects.

**How to avoid:**
Implement explicit `port_phase` segment type: low average speed (10–25 mph equivalent), stop-go kinetic intensity factor, elevated idle aux kW, configurable dwell minutes at origin terminal. Validate POLB → first highway segment separately from highway corridor. Document terminal-specific assumptions.

**Warning signs:**
- Port origin to I-710/I-405 connector shows same Wh/mi as open highway
- No time spent at zero speed in profile unless user manually adds dwell
- Total trip time matches Google Maps car estimate for same route
- "Port drayage profile" toggle exists but doesn't change energy >5%

**Phase to address:**
Phase 1 (physics — port phase); Phase 2 (POLB terminal presets)

---

### Pitfall 10: Static Payload When Drayage Loads Change Mid-Route

**What goes wrong:**
Simulation assumes constant mass for entire trip (e.g., 80k lb outbound, or empty return). Real drayage has load pickup at port, drop at inland yard, and often different return weight. Rolling resistance and regen scale with mass — a loaded outbound + empty return trip is not symmetric to average payload.

**Why it happens:**
Single payload input field is simplest UX. Without telematics, actual weight is unknown. NREL's approach (microtrip mass estimation via fuel/energy optimization) is complex to implement.

**How to avoid:**
Support at minimum: `payload_outbound` and `payload_return` (or segment-level mass). Default return to empty/tare for round-trip scenarios. Document that single-payload mode assumes constant mass. Phase 3+: optional mass profile from waypoints.

**Warning signs:**
- Round-trip simulation uses same payload both directions
- Empty return from Inland Empire to POLB shows same Wh/mi as loaded outbound
- No mass term in per-segment physics output
- Sensitivity slider for payload doesn't affect regen on descent

**Phase to address:**
Phase 1 (payload in physics); Phase 2 (round-trip scenarios)

---

### Pitfall 11: Declaring Routes "Feasible Today" Without Surfacing Infrastructure Reality

**What goes wrong:**
Tool shows green feasibility for POLB → Phoenix or POLB → Dallas because a 150 kW charger exists within 200 miles — but MCS network is sparse, depot charging is required, and operational dwell exceeds HOS windows. Stakeholders commit to contracts based on simulation without understanding 2026 infrastructure gaps.

**Why it happens:**
Feasibility = SoC stays above zero mathematically. Product pressure to show EV works. Sparse MCS is uncomfortable news for consulting deliverables.

**How to avoid:**
Multi-tier feasibility classification: `feasible_public_hd`, `feasible_with_depot`, `requires_infrastructure`, `infeasible`. Always show corridor gap segments (miles without ≥150/350 kW HD-accessible charger). Default POLB MVP to regional corridors where public HD charging exists. Prominent "2026 infrastructure reality" panel in UI and PDF.

**Warning signs:**
- Long-haul routes return feasible with 4+ charging stops none of which are MCS
- No visual gap analysis on map
- Users can't distinguish public vs depot-only chargers
- Feasibility boolean has no infrastructure tier

**Phase to address:**
Phase 2 (gap analysis, feasibility tiers); Phase 3 (corridor maturity labels)

---

### Pitfall 12: Skipping the Empty vs Laden Weight Penalty (~8,000 lb Battery Overhead)

**What goes wrong:**
Energy model uses GCW correctly but doesn't account for reduced cargo capacity — BETs weigh ~8,000 lb more than diesel equivalents. Planners assume same ton-mile payload as diesel fleet, overestimating freight capacity and underestimating effective fleet size needed (Caltrans drayage study: up to 47% fleet size increase for BET substitution under 2022 battery tech).

**Why it happens:**
Energy simulation scope is truck-leg only; business metrics are Phase 2+. Weight delta is "fleet planning" not "physics."

**How to avoid:**
Include `tare_weight_delta_vs_diesel` in truck config. Show effective max payload and ton-miles in Phase 2 emissions/TCO module. Note fleet sizing implications in limitations for drayage substitution analysis.

**Warning signs:**
- Payload slider goes to same max lbs as diesel Class 8 without weight penalty
- TCO/ton-mile comparisons use diesel-equivalent load assumptions
- No mention of battery weight in assumptions log

**Phase to address:**
Phase 0 (truck config); Phase 2 (emissions/TCO); documentation in Phase 1 reports

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Constant aux kW for all segments | Ships physics engine faster | 20–50% error in hot/cold drayage | Never for client-facing feasibility; OK for internal flat-route prototype only |
| Single payload field | Simple UX | Wrong round-trip and regen modeling | MVP demo with one-way routes only; must fix before Phase 2 comparison |
| Open-Elevation API without cache | No DEM hosting | Rate limits, version drift, coarse data | Phase 0 spike only; replace with cached 3DEP before Phase 1 gate |
| Linear charge time model | Charging logic in one function | 30%+ dwell errors, bad HOS planning | Phase 1 alpha with explicit "charge time is rough estimate" disclaimer |
| AFDC ingest without HD filter | Higher charger count looks good | False feasibility on corridors | Never — filter at ingest |
| Car routing profile | Faster route integration | Wrong distance/grade for Class 8 | Never for POLB validation corridors |
| Skip port stop-go model | One less segment type | Systematic underestimate on drayage legs | Internal highway-only demos only |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| NREL AFDC | Treat all DCFC as HD-accessible | Filter ≥150 kW + pull-through/site-type; manual corridor overrides; weekly refresh with `data_as_of` |
| Open-Elevation / DEM | Nearest-neighbor sampling on SRTM | USGS 3DEP 1/3 arc-sec, bilinear interpolation, bridge filtering, per-corridor cache |
| OSRM/Valhalla | Default car profile | Heavy truck profile (weight, height, length); NHFN post-filter |
| Mapbox Directions | Ignore truck restrictions | Prefer self-hosted Valhalla with truck costing or validate against known freight paths |
| OpenWeatherMap | Apply only to air density | Also drive aux/BTMS multiplier and rolling resistance (temperature) |
| OEM spec sheets | Use marketing range as usable kWh | Separate gross/usable kWh; document OEM test conditions; cite source URL in config |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| On-demand elevation API per simulation | p95 >10s; API timeouts | Pre-cache POLB corridor profiles in PostGIS; batch fetch for new routes | >5 concurrent users or routes >300 mi |
| 1-second physics loop | Multi-minute sim times | Segment-based discretization (100–500 m flat, ≤200 m grades) | Any optimization or sensitivity batch |
| Full route re-sim on stop edit | UI lag on what-if | Partial re-sim from edited stop index | Phase 3 interactive editing |
| Unindexed spatial charger queries | Slow stop search | GIST index on chargers; route buffer pre-computed | >10k charger records or complex corridors |
| No simulation result caching | Repeated identical runs | Hash inputs; return cached result | Scenario comparison with 4+ variants |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Positioning as real-time dispatch system | Liability if driver runs out of charge; HOS violations | Persistent "planning tool only" disclaimers; no "navigate now" language; audit trail |
| Storing client route/contracts without auth | Competitive data leak | Phase 3 auth before save/share; org-scoped data |
| Unvalidated user truck params | Garbage-in → client deliverable with absurd range | Sane bounds validation; warn when params deviate >20% from OEM defaults |
| Simulation API without rate limits | DoS on compute-heavy Python service | Job queue + per-user concurrency cap |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Single "feasible/infeasible" boolean | False confidence on infrastructure gaps | Tiered feasibility + gap map + "requires depot" label |
| Hiding assumptions in technical export only | Analysts miss limitations in client meetings | Prominent assumptions panel on results; PDF page 1 summary |
| OEM range shown alongside simulation without context | "Your tool matches spec sheet so it must be right" | Side-by-side with OEM conditions annotated; highlight deltas |
| Charger pins sized by power only | Users pick 50 kW urban site for Class 8 | Filter/size by HD accessibility; gray out incompatible |
| No data freshness indicator | Plans based on stale AFDC | "Charger data as of [date]" on map and exports |
| Academic physics jargon | Dispatch planners disengage | Glossary tooltips: SoC, regen, MCS, Wh/mi |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Physics validation:** Often missing grade-heavy + full-payload case — verify Cajon Pass asymmetric outbound/return energy, not just flat OEM range
- [ ] **Charger integration:** Often missing HD accessibility filter — verify recommended stops are pull-through ≥150 kW or manually curated
- [ ] **Elevation pipeline:** Often missing bridge artifact handling — verify no phantom 50 ft drops at overpasses on I-15/I-10
- [ ] **Charge time estimates:** Often missing taper model — verify 10→80% time exceeds `(0.7 × usable_kwh) / peak_kW`
- [ ] **Port drayage profile:** Often missing idle dwell energy — verify origin segment kWh > open highway Wh/mi
- [ ] **Weather scenarios:** Often missing aux/BTMS — verify cold scenario increases consumption ≥15% vs ideal on same route
- [ ] **Export/PDF:** Often missing limitations page — verify OEM assumptions, data freshness, and feasibility tier appear
- [ ] **Round-trip modeling:** Often missing return-leg payload — verify empty return differs from loaded outbound

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| OEM-anchored validation (Pitfall 1) | HIGH | Add grade+payload test cases; retune with conservative bias; re-validate; issue model version bump + changelog |
| AFDC false feasibility (Pitfall 7) | MEDIUM | Add HD filter + manual overrides; re-run reference corridors; notify users of charger DB update |
| Elevation artifacts (Pitfall 5) | MEDIUM | Swap to 3DEP + GradeIT filters; invalidate cached profiles; re-sim affected corridors |
| Linear charge model (Pitfall 6) | LOW–MEDIUM | Add piecewise curves; recalibrate dwell only (physics unchanged) |
| Missing port phase (Pitfall 9) | MEDIUM | Add segment type + terminal presets; re-validate POLB routes |
| Overestimated regen (Pitfall 4) | HIGH | Add SOC caps + probability factor; retune; expect feasibility to decrease on mountain corridors |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| OEM validation mismatch (1) | Phase 0 | Two-tier test cases pass: ideal OEM + Cajon full payload |
| Usable kWh / BMS reserve (2) | Phase 0 | SoC never projects below configured min; charge kWh ≤ usable |
| Constant aux load (3) | Phase 0–1 | Cold/hot scenarios change Wh/mi ≥15%; port idle > highway aux |
| Regen overestimate (4) | Phase 1 | Cajon return ≠ 50% outbound; regen disabled above SOC threshold |
| Elevation data quality (5) | Phase 0 | Peak grade within 0.5% of reference; no bridge spikes |
| Linear charge time (6) | Phase 1–2 | Charge time increases nonlinearly above 80% SOC target |
| AFDC HD filtering (7) | Phase 0 | Zero recommended stops at non-HD sites on test routes |
| Passenger routing (8) | Phase 1 | POLB→San Bernardino distance within 5% of known drayage path |
| Port stop-go (9) | Phase 1 | Port segment Wh/mi ≥ 1.3× highway segment |
| Static payload (10) | Phase 1–2 | Round-trip scenarios show mass-dependent regen |
| Infrastructure reality (11) | Phase 2 | Long-haul routes show gap segments; tier labels in UI |
| Battery weight penalty (12) | Phase 0, 2 | Truck config shows tare delta; max payload reduced vs diesel |
| Performance (elevation cache) | Phase 0–1 | p95 sim <10s on POLB corridor |
| UX feasibility tiers | Phase 2 | User testing: analysts distinguish public vs depot feasibility |

## Sources

- NREL, "Estimating Electrification Potential for Class 8 Regional-Haul Trucks" (FASTSim calibration, mass estimation, charging tradeoffs) — HIGH confidence
- NREL, "Drive Cycles, Battery Pack Design, and Usage Considerations for Long-Haul and Regional-Haul Electric Trucks" (aux, grade, mass bounds) — HIGH confidence
- NACFE Run on Less Mountains, 2026 (BEV 50–70% terrain efficiency variation vs diesel 30%) — HIGH confidence
- Caltrans/UC, "Routing of Battery Electric Heavy-Duty Trucks for Drayage Operations" (70–100 mi range, fleet size +47%, off-port charging) — HIGH confidence
- San Pedro Bay Ports ZE Drayage Feasibility Assessment, 2024 (rated vs real range 15–30% shortfall) — HIGH confidence
- GGRF Zero-Emission Drayage Truck Deployment Final Report (temperature, operator, route impacts on range) — HIGH confidence
- NREL GradeIT / USGS 3DEP (elevation sampling, bridge filtering) — HIGH confidence
- Graser & Asamer, "Impact of DEM Quality on EV Energy Estimates" (SRTM 15.8% error vs high-res) — HIGH confidence
- IET Generation, Transmission & Distribution, "Assessing influence of EV charging profile modelling methods" (linear model 2–31% RMSE) — HIGH confidence
- Atlas EV Hub, MD/HD charging infrastructure analysis (AFDC MD/HD filtering limitations) — MEDIUM confidence
- NREL AFDC Station Locator documentation (data fields, MD/HD self-reporting) — HIGH confidence
- Volvo/NREL VNR telematics project final report (BTMS 60–80% aux in cold; ML for aux prediction) — HIGH confidence
- Assessing Geographical and Seasonal Influences on Electric Drayage Trucks (regen directionality, seasonal aux) — MEDIUM confidence
- Freightliner eCascadia public specs (usable kWh, range conditions, charge power) — HIGH confidence

---
*Pitfalls research for: FleetVolt Route — Class 8 EV drayage & corridor energy modeling*
*Researched: 2026-07-01*
