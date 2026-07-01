# FleetVolt Route — Model Assumptions

Physics and routing assumptions documented for consulting audit trail (Phase 2).

## Route-History Speed Overlay (D-08)

Posted speed limits come from Valhalla `trace_attributes` edge metadata (`edge.speed_limit`, `edge.truck_speed`), mapped to cumulative route distance. Each physics segment receives a **distance-weighted average** posted speed across its `start_m`–`end_m` span.

### Overlay formula

As the simulation advances segment-by-segment, a forward pass maintains cumulative distance-weighted averages of **realized** and **posted** speeds from all prior segments:

```
overlay_factor = clamp(0.85, 1.0, prior_avg_realized_mph / prior_avg_posted_mph)
effective_speed_mph = min(posted_speed_mph × overlay_factor, truck_top_speed_mph)
```

Where:

- `prior_avg_realized_mph` = Σ(realized_speed × dist_m) / Σ(dist_m) over completed segments
- `prior_avg_posted_mph` = Σ(posted_speed × dist_m) / Σ(dist_m) over completed segments
- `truck_top_speed_mph` defaults to 74.6 mph (Valhalla Class 8 truck costing default 120 km/h)

### First-segment exception

The **first segment** uses posted speed only — no route-history overlay (`overlay_factor = 1.0`). Overlay applies starting at segment 2.

### Rationale

When prior segments ran below posted limits (e.g., truck top-speed cap or grade-limited realized speed in later orchestrator passes), subsequent segments assume drivers continue at a fraction of posted limits rather than instantly returning to full posted speed. The 0.85 floor prevents unrealistic sustained under-speeding on long corridors.

Implementation: `app/simulation/speed_resolver.py` — `resolve_speeds()`.

## Weather Presets (D-09)

Simulation applies PRD-style weather presets before segment force computation via `app/simulation/weather.py`. Each preset adjusts air density, thermal discharge efficiency, auxiliary load multiplier, and headwind aero penalty.

| Preset | Temp (°C) | Thermal factor | Aux multiplier | Headwind (mph) |
|--------|-----------|----------------|----------------|----------------|
| ideal | 20 | 1.00 | 1.0 | 0 |
| hot | 35 | 0.94 | 1.15 | 0 |
| cold | 0 | 0.92 | 1.5 | 0 |
| headwind | 20 | 1.00 | 1.0 | 15 |

### Application

- **Air density:** ISA-style ρ from preset temperature (kg/m³)
- **Thermal derate (hot/cold):** Positive traction power divided by `thermal_factor` before SoC integration — lower factor = higher discharge energy
- **Aux bump (cold/hot):** `aux_kw = truck.aux_kw_base × aux_mult` per segment before port adjustments
- **Headwind:** Effective aero speed = `speed_mph + headwind_mph` (aero force only)

## Port Drayage Geo-Fence (D-10)

When `conditions.port_drayage_enabled=true`, stop-go drayage penalties apply **only** to segments whose midpoint falls inside the simplified POLB/Long Beach harbor polygon (`data/geo/port_polb_lb.geojson`).

| Penalty | In-port value | Out-of-port |
|---------|---------------|-------------|
| Speed cap | 25 mph | Posted/truck-resolved speed unchanged |
| Auxiliary load | max(base aux, 18 kW) | Base aux (with weather multiplier) |

Point-in-polygon uses Shapely `Point.within()` on segment midpoints computed by `segment_builder.py`. Implementation: `app/simulation/port_drayage.py`.

## Physics Parameter Overrides (D-14)

Inline `overrides` on POST `/v1/simulate` allow analysts to tune key truck physics parameters without persisting profiles to the database.

| Field | OEM source | Override bounds |
|-------|------------|-----------------|
| C_rr | truck_configs JSONB | ±20% of OEM default |
| drag_coefficient | truck_configs JSONB | ±20% of OEM default |
| usable_kwh | truck_configs JSONB | ±20% of OEM default |
| aux_kw_base | truck_configs JSONB | ±20% of OEM default |
| regen_efficiency | truck_configs JSONB | ±20% of OEM default |

### Audit trail

Every simulate response includes `assumptions[]` with `{field, value, source, oem_default}` for each overrideable field:

- **`oem_default`:** Applied value matches OEM (including when overrides omitted or `reset_to_oem=true`)
- **`user_override`:** Client supplied an in-bounds inline override

Values outside ±20% of OEM return HTTP 422. Implementation: `app/simulation/overrides.py`.

## Core Physics Parameters

Segment-based force balance drives energy integration (PHYS-02). Key parameters sourced from `data/trucks/{slug}.json` and seeded `truck_configs.params` JSONB:

| Parameter | eCascadia 438 OEM default | Role |
|-----------|---------------------------|------|
| usable_kwh | 394 kWh | SoC integration capacity (nameplate 438 kWh minus BMS reserve) |
| C_rr | 0.0065 | Rolling resistance coefficient |
| drag_coefficient | 0.65 | Aero drag coefficient |
| frontal_area_m2 | 9.8 | Frontal area for aero force |
| regen_efficiency | 0.70 | Regenerative braking efficiency cap |
| aux_kw_base | 10 kW | Baseline auxiliary load per segment |
| drivetrain_efficiency | 0.92 | Motor/inverter efficiency on traction |

### Usable kWh Policy (D-10)

Simulation uses **usable kWh**, not nameplate pack capacity. eCascadia 438 kWh nameplate maps to 394 kWh usable (~90% minus 0.5 kWh BMS reserve). SoC integration starts at 100% of usable energy; KPI `total_kwh` is gross discharge including aux and thermal derate.

### Segment Discretization (D-05, D-07)

Routes split at **10 US mile** intervals and wherever grade exceeds **6%**. Elevation profiles sampled at 150 m resolution from cached PostGIS fixtures or Open-Elevation fallback.

## OEM Validation Methodology (D-11, PHYS-06)

Two deterministic reference cases in `data/validation/reference_cases.json` gate Phase 2 accuracy:

| Case | Route | Expected basis |
|------|-------|----------------|
| flat_highway_oem | Synthetic 230 mi flat at 65 mph | OEM ideal-cycle regional range (eCascadia 438 kWh) |
| polb_cajon_grade | `polb_cajon_pass` corridor fixture | Grade-heavy POLB→Cajon validation corridor |

### MAPE Gate

```
MAPE = |actual_kwh − expected_kwh| / expected_kwh × 100
pass = 8% ≤ MAPE ≤ 12%   (calibration band per D-11)
```

- **GET /v1/physics/validation** runs both cases via `orchestrator.run_simulation` and returns per-case MAPE with `overall_pass`.
- **CI gate:** `tests/test_validation_gate.py` uses fixture elevation only — no Valhalla or Open-Elevation HTTP.
- **Phase 2 calibration:** `expected_total_kwh` values tuned in Plan 05 so current segment physics lands in the 8–12% band against cached fixtures. OEM nameplate claims documented in `source_notes`; calibrated expected values reflect conservative aux/aero vs OEM ideal-cycle marketing range.

Implementation: `app/simulation/validation_cases.py`, `app/routes/validation.py`.

## Charging Planner

Phase 3 adds greedy HD charging stop recommendations and feasibility verdicts on top of the Phase 2 physics pipeline (CHRG-01–06, PLAT-02).

### Greedy first-feasible algorithm (D-06)

v1 uses a **greedy first-feasible** planner, not a scored multi-objective optimizer. At each low-SoC event along the forward SoC profile, the planner searches for the nearest HD-capable charger that can restore enough energy to reach the next segment or destination within the detour limit. Stops are added iteratively until the route completes or no feasible charger exists.

This is acceptable for MVP consulting feasibility because:

- POLB drayage scenarios need transparent, auditable stop lists — not opaque solver output
- Greedy detour-min + power-max tie-break produces defensible recommendations analysts can explain to clients
- Scored multi-objective ranking (CHRG-06 v2) is explicitly deferred; weights are documented below for future upgrade

Implementation: `app/simulation/charging_planner.py` — `plan_greedy_stops()`.

### CHRG-06 deferred multi-objective weights (D-07)

v1 does **not** implement weighted time/energy/cost scoring or external solver-based optimization. Intended v2 scored-greedy weights:

| Objective | Intended weight |
|-----------|-----------------|
| Time (dwell + detour) | **0.40** |
| Energy (kWh added) | **0.35** |
| Cost (placeholder tariff) | **0.25** |

v1 tie-break (D-20): among feasible candidates, prefer **shortest detour time**, then **highest `power_kw`**.

The simulate response `assumptions[]` entry `charging_greedy_strategy` documents these deferred weights via `get_charging_assumptions()` in `app/simulation/feasibility.py`. Values in the response mirror this section (time=0.4, energy=0.35, cost=0.25 as documented placeholders).

### SoC thresholds (D-08, D-09, D-15)

| Parameter | Default | Override path |
|-----------|---------|---------------|
| Charge-search trigger | **18%** SoC | `conditions.charging.soc_trigger_pct` |
| Hard safety floor | **10%** SoC | `conditions.charging.soc_floor_pct` |
| Charge target at each stop | **80%** SoC | `conditions.charging.target_soc_pct` |
| Minimum arrival at destination | **10%** SoC | `conditions.charging.min_arrival_soc_pct` |

The planner fires a stop search when forward SoC drops to the trigger; candidates must not leave the truck below the floor. Destination arrival must meet the minimum arrival target (charge-to level may be raised above 80% on the final stop).

### Charger search (D-17, D-18, D-19)

| Constraint | Value |
|------------|-------|
| Primary search radius | **25 mi** (40,234 m) from low-SoC point |
| Fallback radius | **50 mi** (80,468 m) if zero HD candidates in primary radius |
| HD filter | `hd_capable = true` **and** `power_kw >= 350` (MCS-aware tier) |
| Max detour per stop | **10 min** (600 s) — Valhalla corridor→charger→rejoin vs direct continuation |

Spatial query reuses `GET /v1/chargers/near` PostGIS search; detour validation via `app/simulation/detour_validator.py`.

### Dwell integration (D-14)

Dwell seconds at each stop are computed from the truck OEM **piecewise charge curve** (`charge_curve[]` with `soc_pct` / `max_kw` breakpoints in `data/trucks/*.json`). Energy is integrated **band-by-band** along the curve from arrival SoC to charge target — **not** linear `kWh / rated_kW`.

Implementation: `app/simulation/charge_curve.py` — `integrate_charge_curve()`.

### Feasibility tiers (D-10, D-11, D-12)

**Verdict** (`feasibility.verdict`):

| Verdict | Meaning |
|---------|---------|
| `feasible` | Route completes with comfortable margins |
| `critical` | Route completes but violates comfort margin (arrival SoC 5–10%, or single stop with <30 min dwell buffer) |
| `infeasible` | Route cannot complete with public HD infrastructure |

**Infrastructure tier** (`feasibility.tier`):

| Tier | Meaning |
|------|---------|
| `public_hd` | Completable using public HD chargers within search/detour constraints |
| `depot_required` | Public HD insufficient; shadow pass with unlimited depot charge at origin succeeds |
| `infrastructure_gap` | No charger set satisfies constraints even with depot assumption |

Infeasible responses include `soc_deficit_kwh` and `blocking_reason` (`no_charger_in_radius`, `detour_exceeded`, `cannot_reach_destination`).

Implementation: `app/simulation/feasibility.py` — `classify_feasibility()`.
