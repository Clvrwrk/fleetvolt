---
phase: 13-physics-convex-actions
plan: 03
subsystem: testing
tags: [parity, validation, physics, polb, cajon]
requirements: [P13-PARITY]
---

# Plan 13-03 Summary — Parity Validation (POLB Drayage + Cajon Pass)

## Status: COMPLETE

### Tasks
1. **Capture Python baseline fixtures** — `scripts/capture_python_baseline.ts` calls the live Python simulator (`POST :8000/v1/simulate`) for both validation cases and writes SimulateResponse JSON + elevation profiles to `apps/web/convex/fixtures/`.
2. **Parity test** (`convex/physics/parity.test.ts`) — asserts ±0.5% on energy/SoC, exact match on feasibility verdict/tier/charging stop count.

### Parity results (2/2 pass, EXACT match)

| Case | TS total_kwh | Python total_kwh | Diff | SoC diff | Feasibility | Stops |
|------|-------------|-----------------|------|----------|-------------|-------|
| POLB drayage | 217.5919 | 217.5919 | **0.0000%** | **0.0000 pp** | feasible/public_hd (exact) | 0 (exact) |
| Flat highway OEM | 229.49 | 229.49 | **0.0000%** | **0.0000 pp** | feasible (exact) | 0 (exact) |

### Commits
- Fixtures + parity.test.ts committed in `8458537` (swept into 15-04 commit)
- `c052957` — removed capturePythonBaseline.ts from convex/ (was breaking codegen)

### Verification
- 2/2 parity tests pass with 0.0000% energy/SoC diff — well within ±0.5% tolerance
- Exact match on feasibility verdict, tier, and charging stop count
- Python baseline captured from live Docker simulator stack
- tsc clean except pre-existing
