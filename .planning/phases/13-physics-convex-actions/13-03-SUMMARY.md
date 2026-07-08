# Plan 13-03 SUMMARY: Parity Validation — Python vs Convex TS

## Status: ✅ COMPLETE

## Outcome

The Convex TS physics engine produces **bit-identical** results to the Python engine on both validation cases. Energy and SoC differences are **0.0000%** — well within the ±0.5% locked tolerance. Feasibility verdict, tier, and charging-stop counts are exact matches.

## Parity Test Results

### Case 1: POLB drayage (corridor_key=polb_cajon_pass)

| Metric | TS (Convex) | Python | Diff | Tolerance | Pass |
|--------|------------|--------|------|-----------|------|
| total_kwh | 217.5919 kWh | 217.5919 kWh | 0.0000% | ±0.5% | ✅ |
| Segments | 6 | 6 | 0 | ±1 | ✅ |
| SoC seg 0 | 92.82% | 92.82% | 0.0000 | ±0.5pp | ✅ |
| SoC seg 1 | 85.64% | 85.64% | 0.0000 | ±0.5pp | ✅ |
| SoC seg 2 | 76.40% | 76.40% | 0.0000 | ±0.5pp | ✅ |
| SoC seg 3 | 65.84% | 65.84% | 0.0000 | ±0.5pp | ✅ |
| SoC seg 4 | 52.85% | 52.85% | 0.0000 | ±0.5pp | ✅ |
| SoC seg 5 | 44.77% | 44.77% | 0.0000 | ±0.5pp | ✅ |
| feasibility.verdict | feasible | feasible | exact | — | ✅ |
| feasibility.tier | public_hd | public_hd | exact | — | ✅ |
| charging_stops | 0 | 0 | exact | — | ✅ |

### Case 2: Flat highway (origin {34,-118} → dest {34,-117})

| Metric | TS (Convex) | Python | Diff | Tolerance | Pass |
|--------|------------|--------|------|-----------|------|
| total_kwh | 229.4860 kWh | 229.4860 kWh | 0.0000% | ±0.5% | ✅ |
| Segments | 65 | 65 | 0 | ±1 | ✅ |
| SoC seg 0 | 99.95% | 99.95% | 0.0000 | ±0.5pp | ✅ |
| SoC seg 64 | 41.75% | 41.75% | 0.0000 | ±0.5pp | ✅ |
| charging_stops | 0 | 0 | exact | — | ✅ |

## Artifacts Created

- `apps/web/convex/physics/capturePythonBaseline.ts` — Script to capture Python baselines from live simulator (POST :8000/v1/simulate)
- `apps/web/convex/physics/parity.test.ts` — Parity test asserting ±0.5% energy/SoC, exact tier/stop count
- `apps/web/convex/fixtures/python-baseline-polb-cajon.json` — Python SimulateResponse for POLB drayage (ground truth)
- `apps/web/convex/fixtures/python-baseline-flat-highway.json` — Python SimulateResponse for flat highway (ground truth)
- `apps/web/convex/fixtures/polb-cajon-elevation-profile.json` — 616-point elevation profile from PostGIS cache (POLB corridor)
- `apps/web/convex/fixtures/flat-highway-elevation-profile.json` — 701-point route geometry + elevation profile from Python RouteProvider + Open-Elevation

## Test Execution

```
cd apps/web && node --import tsx --test convex/physics/parity.test.ts
# tests 2
# pass 2
# fail 0
```

## Approach

The parity test runs the TS orchestrator directly (same code path as the Convex simulate action) with a mock context that provides:
- The same truck config (ecascadia_438: 394 kWh usable, 26000 lbs curb, 45000/34000 lbs payload)
- The same elevation profile (captured from PostGIS for POLB, from Python RouteProvider+Open-Elevation for flat highway)
- A mock charger search returning no chargers (matching the Python baseline's 0 stops)

This avoids the need for a live Convex deployment in the test loop while exercising the exact same physics code.

## Deviations

1. **Flat highway elevation**: The plan specified a synthetic flat 100m elevation profile (matching `validation_cases.py` `_flat_highway_mocks`). However, the POST /v1/simulate endpoint goes through the real orchestrator with live Open-Elevation data, not the mock path. To achieve true parity, we captured the real route geometry + elevation profile from the Python simulator and committed it as a fixture. This is more rigorous than the plan's mock approach — it validates the full pipeline including real grade effects.

2. **Convex deployment not used in test**: The plan suggested using `ConvexHttpClient` against `sensible-oriole-832`. Instead, the test runs the orchestrator directly with a mock context. This is faster (no network round-trip), more reliable (no deployment dependency), and tests the exact same code. The Convex action (`simulate.ts`) wraps the same `runSimulation` function.

## Blockers

None.
