---
phase: 7
slug: foundation-shell-data-contract-map-base
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-06
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `07-RESEARCH.md` § Validation Architecture. Per-task map is completed by the planner once PLAN.md tasks exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node built-in test runner (`node --import tsx --test`) for unit; Playwright 1.61 for e2e |
| **Config file** | `apps/web` package scripts; `playwright.config` (e2e); Convex `convex/` codegen |
| **Quick run command** | `pnpm --filter web test` |
| **Full suite command** | `pnpm --filter web test && pnpm --filter web test:e2e` |
| **Estimated runtime** | ~60–120 seconds (unit fast; e2e includes map render) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test`
- **After every plan wave:** Run `pnpm --filter web test && pnpm --filter web test:e2e`
- **Before `/gsd-verify-work`:** Full suite must be green, including the Phase 4 map regression specs
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

*Populated by the planner from the 5 PLAN.md files (waves 0–3). Each signal maps to the plan/task whose `<automated>` line covers it. Every task in every plan carries an `<automated>` verify (tsc/eslint/node --test/playwright) — no MISSING references remain because Wave 0 (07-01) creates the Convex schema, provenance validator, and all six Playwright /pulse spec stubs before any dependent wave runs.*

| Signal (Nyquist) | Requirement | Plan / Wave | Test Type | Automated Command | Status |
|------------------|-------------|-------------|-----------|-------------------|--------|
| Provenance validator + contract test exist | DINT-01, SRC-01 | 07-01 / W0 | unit | `pnpm --filter web test` (provenance-contract.test.ts) | ⬜ pending |
| Convex schema + unauthenticated provider round-trip | SRC-03, D-06, D-07 | 07-01 / W0 | unit + codegen | `npx convex codegen && pnpm --filter web test` | ⬜ pending |
| CAD shell fidelity (frame/shadow/L-brackets/grid/JBM) | SHELL-02, SHELL-03 | 07-02 / W1 | e2e | `playwright test tests/pulse-shell.spec.ts` | ⬜ pending |
| /pulse route + nav tab (open, no auth per D-06) | SHELL-01 | 07-02 / W1 | e2e | `playwright test tests/pulse-shell.spec.ts` | ⬜ pending |
| Responsive: desktop frame; tablet accordion | SHELL-04 | 07-02 / W1 | e2e | `playwright test tests/pulse-responsive.spec.ts` | ⬜ pending |
| Vector map renders with mapId, CAD cloud style, CA framing | FLOW-01, FLOW-07 | 07-03 / W2 | e2e | `playwright test tests/pulse-map.spec.ts` | ⬜ pending |
| Port anchors present & selectable (6 AdvancedMarkers) | FLOW-02, SHELL-06 | 07-03 / W2 | e2e | `playwright test tests/pulse-ports.spec.ts` | ⬜ pending |
| CA framing helper correctness | FLOW-01 | 07-03 / W2 | unit | `pnpm --filter web test` (ca-framing.test.ts) | ⬜ pending |
| SoC gradient → segmented polylines fidelity | FLOW-01 (D-01) | 07-04 / W2 | unit | `pnpm --filter web test` (soc-segments.test.ts) | ⬜ pending |
| **Phase 4 map still works post-migration** | D-01 regression | 07-04 / W2 | e2e | `playwright test tests/scenario-run.spec.ts` | ⬜ pending |
| Provenance populated on every ingested record | DINT-01, SRC-01 | 07-05 / W3 | unit (ingest assert) | `pnpm --filter web test` (ingest-provenance.test.ts) | ⬜ pending |
| usefulnessScore = rubric output, not catalog value | DINT-03 | 07-05 / W3 | unit + notebook artifact | `pnpm --filter web test` + `.planning/data-review/*.md` | ⬜ pending |
| Sources footer always-visible with citations | SRC-02 | 07-05 / W3 | e2e | `playwright test tests/pulse-footer.spec.ts` | ⬜ pending |
| Simulated ≠ measured (distinct orange badge) | SRC-04 | 07-05 / W3 | e2e | `playwright test tests/pulse-provenance.spec.ts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Convex project init + `convex/schema.ts` (6 tables with shared `provenance` validator) — new infra
- [ ] `@vis.gl/react-google-maps` + Google vector `mapId` provisioned (env: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID`) — new infra
- [ ] Playwright specs scaffolded for `/pulse` signals (pulse-map, pulse-ports, pulse-footer, pulse-shell, pulse-provenance, pulse-responsive)
- [ ] Phase 4 regression spec confirmed runnable (`scenario-run.spec.ts`) before the Mapbox→Google port begins
- [ ] `data-review-gate` notebook harness per ingested source (usefulnessScore assertion)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CAD brand fidelity vs design MD | SHELL-02/03, FLOW-07 | Pixel/aesthetic judgment vs `Design/technical-brand-geometry-1.html` | Visual compare `/pulse` frame, shadow depth, grid, JetBrains Mono against the design HTML |
| Google cloud map style (default POIs stripped) | FLOW-07 | Requires Google Cloud console Map ID style config | Confirm the vector Map ID style is applied and default Google POI/road styling does not leak |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner completes per-task map)

**Approval:** pending
