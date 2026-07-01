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
