---
quick_id: 260712-j2t
status: complete
issue: FLE-5
date: 2026-07-12
verification: human_needed
---

# FleetVolt.Network desktop split and CaaS reset — Summary

## Delivered

- Removed the authenticated mobile bottom navigation and mobile workbench sheet from the desktop runtime.
- Deleted the two now-unreferenced mobile-only components and their active desktop test expectations.
- Converted protected-surface compliance to a desktop gate while retaining responsive checks for public marketing surfaces.
- Narrowed workbench E2E and screenshot coverage to CaaS and Fleet Manager.
- Restored the independent TypeScript gate by fixing deterministic catalog, spatial, shared scenario, and test-contract errors.
- Split deployment-dependent Convex parity checks into `pnpm --filter @fleetvolt/web test:live`; the default unit gate is now deterministic.
- Codified mandatory work-branch + pull-request delivery in `AGENTS.md`; direct main commit/push/merge is prohibited without separate approval.
- Reoriented the existing Linear project instead of duplicating it: `FleetVolt.Network — CaaS Desktop & Demo`.
- Added three Linear gates: CaaS production-ready tonight, Monday 09:30 live demo, and secondary Fleet Manager desktop Alpha.
- Moved the old Driver desktop issue into the mobile project as canceled/superseded and created FLE-33 for Fleet Manager.

## Verification

- Focused ESLint: PASS (0 errors; existing advisory warnings only).
- TypeScript `tsc --noEmit`: PASS.
- Deterministic unit suite: PASS — 246/246.
- Production build: PASS — 31 routes.
- Desktop CaaS/Fleet Manager Playwright: PASS — 7 passed, 1 live-map interaction skipped because map credentials were intentionally absent.
- Desktop screenshot scenarios: PASS — 4/4 captured and inspected.
- Local review server: `http://localhost:3110` using the production build and isolated E2E review session.

## Honest remaining gates

- The four live Convex parity suites require a reachable deployment and live ingested layers; they are intentionally not counted as unit passes.
- Deterministic screenshots show the map in its honest loading state because the isolated review build has no live Google map credential/referrer gate.
- The in-app browser became stuck on a transient localhost connection-error interstitial after the server restart; Playwright completed the local verification instead.
- ScreenshotOne still requires a reachable branch/PR preview. Local screenshots are not a substitute.
- No production deploy, main merge, or main push occurred. [Draft PR #1](https://github.com/Clvrwrk/fleetvolt/pull/1) is open from `wip/2026-07-09-session` into `master` for review.

## Linear floor

- FLE-5: active CaaS production deploy task — Agent Working, due 2026-07-12.
- FLE-7: CaaS report export + saved demo scenario — Agent Todo, due 2026-07-12.
- FLE-8: CaaS click-to-provenance — Agent Todo, due 2026-07-13.
- FLE-9: production demo rehearsal/release blockers — Agent Todo, due 2026-07-13.
- FLE-19: design/physical review gate — Agent Needs Input, M2.
- FLE-33: Fleet Manager desktop Alpha — Agent Todo, secondary M3.
