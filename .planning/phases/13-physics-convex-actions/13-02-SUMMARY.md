---
phase: 13-physics-convex-actions
plan: 02
subsystem: physics
tags: [charging-planner, feasibility, orchestrator, simulate-action, convex]
---

# Plan 13-02 Summary — Charging Planner + Feasibility + Orchestrator + Simulate Action

## Status: COMPLETE

### Tasks
1. **chargeCurve.ts** — integrateChargeCurve (step-wise SOC band dwell)
2. **portDrayage.ts** — POLB polygon baked in, segmentInPort, applyPortDrayage
3. **detourValidator.ts** — Google Directions-based detourSeconds
4. **chargingPlanner.ts** — planGreedyStops with ChargerSearchCtx abstraction
5. **feasibility.ts** — classifyFeasibility, shadowPassDepotAtOrigin, 3-tier verdict
6. **orchestrator.ts** — runSimulation 15-step pipeline (port of orchestrator.py)
7. **simulate.ts** — Convex action + queries + mutation for simulations table access
8. **inputsHash split** — sync (node:crypto, tests-only, outside convex/) + async (Web Crypto, Convex-safe). Convex bundler rejects node:crypto; the sync version lives at `apps/web/test-utils/inputsHashSync.ts`.

### Commits
- `97e4bae` feat(13-02): charging planner + feasibility + orchestrator + simulate action

### Key fix
Convex bundler rejects `node:crypto` + `require("module")` in files under `convex/`. Split: sync hash (tests) → `test-utils/inputsHashSync.ts` using `createRequire`; async hash (Convex) → `convex/physics/inputsHash.ts` using Web Crypto `crypto.subtle.digest`. Also fixed `brief.ts` import paths (`../_generated` → `./_generated`).

### Verification
- 26/26 physics tests pass (including hash parity with Python reference)
- Convex codegen clean
- tsc clean except pre-existing
