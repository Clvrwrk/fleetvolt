---
phase: 4
slug: analyst-dashboard-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test (`node --test`) in `@fleetvolt/api`; Node test or vitest in `@fleetvolt/web`; Playwright 1.61.1 (optional E2E) |
| **Config file** | none — Wave 0 installs web test runner + optional `playwright.config.ts` |
| **Quick run command** | `pnpm --filter @fleetvolt/web typecheck` + targeted `node --test` file |
| **Full suite command** | `pnpm test` (turbo) + `pnpm --filter @fleetvolt/web build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @fleetvolt/web typecheck` + relevant unit test file
- **After every plan wave:** Run `pnpm test` + `pnpm --filter @fleetvolt/web build`
- **Before `/gsd-verify-work`:** Full suite green + `scripts/verify_async_job.sh` + manual UAT checklist
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-00-01 | 00 | 0 | SCEN-04 | integration | `node --test services/api/src/simulations.test.ts` | ❌ W0 | ⬜ pending |
| 04-00-02 | 00 | 0 | SCEN-04 | grep | `grep routing/route services/api/src/app.ts` | ❌ W0 | ⬜ pending |
| 04-07-01 | 07 | 0 | SCEN-04 | typecheck | `pnpm --filter @fleetvolt/web typecheck` | ❌ W0 | ⬜ pending |
| 04-07-02 | 07 | 0 | MAP-01 | unit | `node --test apps/web/src/lib/*.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | SCEN-04 | unit | `node --test apps/web/src/lib/poll-job.test.ts` | ❌ W1 | ⬜ pending |
| 04-02-01 | 02 | 2 | MAP-01 | unit | `node --test apps/web/src/lib/segment-geojson.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | MAP-03 | unit | `node --test apps/web/src/lib/segment-lookup.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 4 | MAP-04 | unit | `node --test apps/web/src/lib/kpi.test.ts` | ❌ W0 | ⬜ pending |
| 04-06-01 | 06 | 6 | EXPR-01 | unit | `node --test apps/web/src/lib/export-csv.test.ts` | ❌ W6 | ⬜ pending |
| 04-06-02 | 06 | 6 | EXPR-02 | integration | `node --test services/api/src/exports.test.ts` | ❌ W6 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `GET /v1/simulations/{id}` with `inputs_hash`, `physics_version`, `charger_version`, `inputs` + OpenAPI codegen
- [ ] `apps/web/package.json` — map/chart/state deps + `@fleetvolt/shared-types`
- [ ] `apps/web/next.config.ts` — rewrites + transpilePackages
- [ ] `apps/web/src/lib/*.test.ts` — segment geojson, KPI, export helpers
- [ ] `services/api/src/exports.ts` + tests for PDF route
- [ ] shadcn init + Tailwind v4 postcss setup
- [ ] Playwright config (optional smoke)

---

## Phase Gate Checklist

- [ ] Analyst can run `polb_cajon_pass` scenario end-to-end from UI
- [ ] Map shows SoC gradient + charger markers; chart hover syncs
- [ ] Comparison tray holds 2+ scenarios with KPI diff
- [ ] CSV/JSON/PDF export downloads with audit metadata
- [ ] Assumptions panel shows disclaimer + model versions
