---
phase: 7
slug: foundation-shell-data-contract-map-base
status: draft
nyquist_compliant: false
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

*Populated by the planner from PLAN.md tasks. Seeded below with the research validation signals (07-RESEARCH.md § Validation Architecture) that every task map must ultimately cover.*

| Signal (Nyquist) | Requirement | Test Type | Automated Command | Status |
|------------------|-------------|-----------|-------------------|--------|
| Vector map renders with mapId, CAD cloud style, CA framing | FLOW-01, FLOW-07 | e2e | `playwright test pulse-map` | ⬜ pending |
| Port anchors present & selectable (6 AdvancedMarkers) | FLOW-02, SHELL-06 | e2e | `playwright test pulse-ports` | ⬜ pending |
| Convex query round-trips; userFilters re-fires | SRC-03, D-07 | unit+e2e | `pnpm --filter web test` | ⬜ pending |
| Provenance populated on every ingested record | DINT-01, SRC-01 | unit (ingest assert) | `pnpm --filter web test` | ⬜ pending |
| usefulnessScore = rubric output, not catalog value | DINT-03 | unit + notebook artifact | `pnpm --filter web test` | ⬜ pending |
| Simulated ≠ measured (distinct badge) | SRC-04 | e2e | `playwright test pulse-provenance` | ⬜ pending |
| Sources footer always-visible with citations | SRC-02 | e2e | `playwright test pulse-footer` | ⬜ pending |
| CAD shell fidelity (frame/shadow/L-brackets/grid/JBM) | SHELL-02, SHELL-03 | e2e (visual) | `playwright test pulse-shell` | ⬜ pending |
| Responsive: desktop frame; tablet accordion | SHELL-04 | e2e | `playwright test pulse-responsive` | ⬜ pending |
| **Phase 4 map still works post-migration** | D-01 regression | e2e | `playwright test scenario-run` | ⬜ pending |

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
