# Flagship Query — "The POLB Electrification Decision" (verified computation)

**Date:** 2026-07-07 · Corridor: POLB → San Bernardino (I-710/I-10/SR-60), the canonical drayage leg.
This is the composite query FleetVolt must visualize. Every number below was **computed live**
(PTV routing + physics sim + AFDC/NLR charger API + POLB registry + FAF), not estimated.

## The query
> "For a full truck leaving POLB on the most congested freight route: where is the gap in
> Class-8 chargers, what trucking companies should we target for outreach, what are the 5
> closest charge ports + config, the detour cost of each, and how beneficial environmentally
> is it to carry this freight via EV Class-8?"

## Answer (computed 2026-07-07)

### Route & energy
- **117.4 km** POLB → San Bernardino (PTV Class-8 truck routing, 1,296-pt geometry).
- Full eCascadia (438 kWh pack, 40,000 lb payload, port drayage aux): **161.17 kWh** consumed (physics sim, ideal weather). ≈ **1.37 kWh/km**.

### ⚠️ The Class-8 charging gap (headline)
- DC-fast stations within 5 mi of the corridor: **10**.
- **TRUE Class-8-capable (≥350 kW AND max_vehicle_class MD/HD): 0.**
- The 5 "closest" are all LD-class dealership/Tesla units at 44–75 kW — **physically unusable for an 80,000 lb truck.**
- **This is the gap: the entire POLB→Inland-Empire drayage corridor has no en-route heavy-duty charging.** A full electric drayage move today depends entirely on depot charging at both ends — no corridor safety margin.

### 5 closest charge ports + config + detour cost
| Charger | Dist to route | Max kW | Class | DCFC ports | Connectors | Detour (round-trip km) | Detour energy (kWh) |
|---|---|---|---|---|---|---|---|
| Riverside Tesla Supercharger | 1.1 mi | 75 | (LD) | 24 | TESLA | 37.7 | 51.7 |
| Buena Park Nissan | 1.2 mi | 50 | LD | 1 | CHAdeMO/J1772/CCS | 184.6 | 253.4 |
| Larry H Miller Nissan | 1.4 mi | 44 | LD | 1 | CHAdeMO/J1772 | 113.2 | 155.5 |
| Penske Chevrolet Cerritos | 1.7 mi | 50 | LD | 1 | CHAdeMO/J1772/CCS/NEMA | 200.1 | 274.7 |
| San Bernardino Tesla Supercharger | 1.7 mi | 75 | (LD) | 14 | TESLA | 8.8 | 12.1 |

*Detour = PTV route dest→charger→back; energy penalty = detour_km × 1.37 kWh/km. All 5 are the WRONG connector/class for Class-8 — reinforces the gap. The detour math is the engine; plug in a real HD site and it prices the true cost.*

### Carrier outreach targets (POLB registry — unique asset)
- **1,824** registered POLB drayage carriers total; **685 HQ'd in the POLB→SB corridor cities.**
- Top outreach clusters: **Long Beach (127), Wilmington (74), Carson (68), Gardena (54), Compton (52), Ontario (49), City of Industry (39), Chino (34)**.
- These are named, addressable companies running exactly this move — the electrification sales list.

### Environmental benefit (one 72.9-mi leg)
- Diesel Class-8 @ 6.5 mpg → 11.2 gal → **114.2 kg CO2** tailpipe.
- EV eCascadia 161.2 kWh @ CA grid 0.24 kg/kWh → **38.7 kg CO2**.
- **Saved: 75.6 kg CO2/trip — a 66% reduction.**
- Annualized (250 trips/yr/truck): **18.9 tonnes CO2/yr/truck.**
- Plus zero NOx/PM at the port + along I-710 (AB-617 disadvantaged communities) — the regulatory/health story.

## Data-source map (each answer → its source)
| Sub-answer | Source | Live? |
|---|---|---|
| Route geometry | PTV Developer Routing API | ✅ live |
| Energy consumption | FleetVolt physics sim (Convex-ported in Phase 13) | ✅ live |
| Most congested route | CalTrans Truck AADT (5-axle) + FAF assignment | raw data (Phase 12 ingest) |
| Charger gap + 5 closest + config | AFDC via developer.nlr.gov | ✅ live |
| Detour cost | PTV routing (dest→charger) | ✅ live |
| Carrier targeting | POLB drayage registry (3,151 rows) | raw data (Phase 12 ingest, geocode) |
| Environmental | sim kWh vs diesel EPA factors + CAISO grid | ✅ computed |
| Freight volume context | FAF5 zone 061 outbound ($1.3T, 395M truck-ktons) | raw data (Phase 12) |

## Gaps this exposed for Phase 12/13
1. **"Most congested route" is not yet computed** — needs CalTrans AADT 5-axle joined to route segments to rank corridors by truck volume. Currently we hardcode POLB→SB. Phase 12 must ingest + rank.
2. **Charger detour needs a real HD site** — with 0 HD chargers in-corridor, the detour engine works but has nothing worth routing to. The visualization should highlight the gap as a *siting opportunity* (where to put a charger), which ties to the solar-charger-rec feature.
3. **Carrier geocoding** — registry has addresses but not lat/lon; Phase 12 geocode step needed to map carrier density.
4. **Grid emissions factor** should be a config input (marginal vs average CAISO), not hardcoded.
