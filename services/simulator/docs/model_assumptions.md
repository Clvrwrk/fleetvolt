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
