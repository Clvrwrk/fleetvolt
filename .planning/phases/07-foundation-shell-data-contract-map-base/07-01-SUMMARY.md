---
phase: 07-foundation-shell-data-contract-map-base
plan: 01
subsystem: infra
tags: [convex, provenance, next15, playwright, tsx-test, supply-chain]

requires:
  - phase: none (Wave 0 — foundation infra; parallel /pulse stack)
provides:
  - Convex data layer scaffold (6-table schema + shared provenance validator + typed _generated)
  - Unauthenticated ConvexClientProvider wired into the Next 16 App Router layout (D-06)
  - ports/userFilters queries (anonymous filterKey, no auth — D-07)
  - Phase dependencies installed at pinned versions (convex, @vis.gl/react-google-maps, gsap, @gsap/react, simplify-js)
  - Provenance contract unit test + 6 /pulse Playwright spec stubs (Nyquist signal scaffolds)
  - Env template + Convex bootstrap README
affects: [07-02 shell, 07-03 map, 07-04 migration, 07-05 ingest]

tech-stack:
  added: [convex@1.42.1, "@vis.gl/react-google-maps@1.9.0", gsap@3.15.0, "@gsap/react@2.1.2", simplify-js@1.2.4]
  patterns: [shared-convex-validator-for-provenance, unauthenticated-convex-provider, anonymous-filterkey-state]

key-files:
  created:
    - apps/web/convex/lib/provenance.ts
    - apps/web/convex/schema.ts
    - apps/web/convex/ports.ts
    - apps/web/convex/userFilters.ts
    - apps/web/convex/_generated/ (codegen output)
    - apps/web/convex/README.md
    - apps/web/src/app/ConvexClientProvider.tsx
    - apps/web/src/lib/provenance-contract.test.ts
    - apps/web/tests/pulse-{map,ports,shell,footer,provenance,responsive}.spec.ts
    - apps/web/.env.local.example
  modified:
    - apps/web/package.json (deps + widened test script)
    - apps/web/src/app/layout.tsx (ConvexClientProvider wrap)

key-decisions:
  - "Convex runs UNAUTHENTICATED (plain ConvexReactClient + ConvexProvider, never ConvexProviderWithAuth) — D-06; auth deferred to Phase 10"
  - "userFilters keyed by anonymous localStorage UUID (filterKey), rekeyed to WorkOS subject id in Phase 10 — D-07"
  - "Every data record carries a shared provenance {source, fetchedAt, usefulnessScore, matchMethod} validator — DINT-01/SRC-01"
  - "usefulnessScore is a rubric output at ingest (data-review-gate), never a hardcoded catalog value — DINT-03"

patterns-established:
  - "Convex codegen succeeds non-interactively against dev deployment sensible-oriole-832 (cached login present)"
  - "Playwright /pulse stubs use test.fixme with testid + requirement TODOs so they list but do not fail before their wave ships"
---

# Phase 7 Plan 01 — Foundation Infra Scaffolds — Summary

**Requirements addressed:** DINT-01, SRC-01, SRC-03 (foundation portions; full satisfaction lands in 07-05 ingest).

## What was built

Wave 0 established the parallel `/pulse` data-layer foundation without any UI or map yet:

1. **Dependencies** (`da0df9d`) — installed convex 1.42.1, @vis.gl/react-google-maps 1.9.0, gsap 3.15.0, @gsap/react 2.1.2, simplify-js 1.2.4 (all pinned; @turf/turf already present). No React 19 peer conflicts.
2. **Provenance validator** (`2c95028`) — `convex/lib/provenance.ts`, the shared `{source, fetchedAt, usefulnessScore, matchMethod}` contract reused across every data table (DINT-01/SRC-01 type-level invariant).
3. **Schema** (`e78ab9b`) — `convex/schema.ts` with 6 tables (ports, highwaySegments, freightFlows, hotspots, marketSizing, userFilters) + indexes per 07-RESEARCH § Convex Data Model. `convex codegen` succeeded and wrote `_generated/`.
4. **Queries** (`fa77e4a`) — `ports.ts` (list, getByCode), `userFilters.ts` (get-by-filterKey, upsert). No `ctx.auth` anywhere (D-06); filterKey documented as anonymous (D-07).
5. **Provider** (`75735d3`) — `ConvexClientProvider.tsx` (`'use client'`, plain client, NOT WorkOS-aware) wired into `layout.tsx`.
6. **Unit test** (`d49d62c`) — `provenance-contract.test.ts`, 9 assertions on the provenance shape.
7. **Test scaffolds** (`d267337`) — widened `node --test` glob to `src/lib`, `src/stores`, `convex/**`; 6 Playwright `/pulse` stubs mapping to Nyquist signals.
8. **Docs** (`4a0eeb3`) — `.env.local.example` (placeholders only) + `convex/README.md` (bootstrap, D-06/D-07, provenance).

## Verification (real results)

- `node --import tsx --test 'src/lib/*.test.ts' 'convex/**/*.test.ts'` → **31 pass, 0 fail** (incl. 9 provenance-contract).
- `npx playwright test --list` → **8 tests in 7 files** (6 new pulse stubs + Phase 4 `scenario-run` baseline intact).
- `convex codegen` → succeeded, `_generated/` present (api.d.ts, dataModel.d.ts, server.*).
- Phase 4 regression baseline (`scenario-run.spec.ts`) unmodified and still lists.

## Deviations / notes

- **Executor iteration-limit close-out:** the spawned executor completed Tasks 1–6 and stalled mid-Task 7 (illegal partial state — commits without SUMMARY). Orchestrator completed Tasks 7–8 mechanically and wrote this SUMMARY to reconcile per the GSD atomic-close-out invariant.
- **Credentials:** `apps/web/.env.local` holds real values (git-ignored, mode 600), sourced from `~/.config/cleverwork/master.env`. Never printed or committed. `.gitignore` was fixed first (it previously did not cover `.env.local`).
- **Rotation reminders:** the Google Maps browser key (flagged in master.env) and the `sensible-oriole-832` Convex deploy key (partial value surfaced in an earlier terminal read) should be rotated.
- **Referrer allowlist (external, for map to render):** add `http://localhost:3000/*` and `http://127.0.0.1:3000/*` (+ `https://fleetvolt.network/*`, `https://*.fleetvolt.network/*`) to the Maps key in Google Cloud Console.

## Output

Wave 0 complete. Next: Wave 1 (07-02) — `/pulse` route + nav tab + CAD shell.
