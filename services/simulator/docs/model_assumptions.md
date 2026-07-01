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
