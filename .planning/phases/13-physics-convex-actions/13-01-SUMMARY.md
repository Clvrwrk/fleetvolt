# 13-01 SUMMARY: Port Python Physics Core to Convex TS

**Status:** ✅ COMPLETE
**Commit:** `0f09b38` — `13-01: Port Python physics core to Convex TS`

## What was done

Ported all 8 pure-physics modules from `services/simulator/app/simulation/` to `apps/web/convex/physics/*.ts`:

| TS File | Python Source | LOC |
|---------|--------------|-----|
| `constants.ts` | `constants.py` | 9 constants + 2 route constants |
| `types.ts` | `schemas.py` + `physics_engine.py` dataclasses | All interfaces |
| `inputsHash.ts` | `inputs_hash.py` + `services/api/src/inputs_hash.ts` | Full port |
| `segmentBuilder.ts` | `segment_builder.py` (185 lines) | All functions |
| `physicsEngine.ts` | `physics_engine.py` (103 lines) | All functions |
| `socIntegrator.ts` | `soc_integrator.py` (62 lines) | Sequential loop |
| `weather.ts` | `weather.py` (40 lines) | 4 presets + applyWeather |
| `speedResolver.ts` | `speed_resolver.py` (107 lines) | All functions |
| `kpiAggregator.ts` | `kpi_aggregator.py` (37 lines) | Full port |
| `overrides.ts` | `overrides.py` (102 lines) | ±20% bounds + assumptions |
| `physics.test.ts` | — | 26 unit tests |

## Key parity results

- **Inputs hash:** TS `789f520088569f9c6c2ece701ece58a78052a65c0667faaef769ca998039266c` = Python `789f5200...` — EXACT match ✅
- **Constants:** All 9 constants match Python exactly (G=9.80665, US_MILE_M=1609.344, etc.) ✅
- **Air density:** `airDensity(20)` ≈ 1.2041 (matches ISA formula) ✅
- **SoC integration:** Sequential loop with regen caps (regen_soc_cutoff=90, regen_power_cap_kw=350) ✅
- **Segment building:** 10-mile base cuts with 6% grade subdivision, MAX_PHYSICS_SEGMENTS=200 cap ✅
- **26 unit tests:** All passing ✅

## Files created (11)

```
apps/web/convex/physics/constants.ts
apps/web/convex/physics/types.ts
apps/web/convex/physics/inputsHash.ts
apps/web/convex/physics/segmentBuilder.ts
apps/web/convex/physics/physicsEngine.ts
apps/web/convex/physics/socIntegrator.ts
apps/web/convex/physics/weather.ts
apps/web/convex/physics/speedResolver.ts
apps/web/convex/physics/kpiAggregator.ts
apps/web/convex/physics/overrides.ts
apps/web/convex/physics/physics.test.ts
```

## Test results

```
node --import tsx --test convex/physics/physics.test.ts
# tests 26  # pass 26  # fail 0
```

## Notes

- All functions are pure TS (no Convex server imports) — testable under `node --import tsx --test`
- The `DEFAULT_TRUCK_TOP_SPEED_MPH` constant was ported from `route_provider.py` (120 kph → mph ≈ 74.5645)
- The `EdgeSpeed` interface uses a getter-style `edgeEndM()` function instead of a Python `@property`
- Ready for Plan 13-02 (Convex action wrapper) and 13-03 (parity validation)
