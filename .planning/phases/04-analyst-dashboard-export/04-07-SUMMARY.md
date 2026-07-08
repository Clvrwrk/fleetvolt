---
phase: 04-analyst-dashboard-export
plan: 07
subsystem: ui
tags: [nextjs, tailwind, shadcn, mapbox, recharts, zustand, node-test]

requires:
  - phase: 03-charging-job-pipeline
    provides: Simulation outputs schema and API endpoints for stack health fetches
provides:
  - Web visualization dependencies and Tailwind v4 brand tokens
  - Next.js API rewrites to Fastify
  - Stack health page at /status
  - segment-geojson, kpi, segment-lookup pure libs with tests
affects: [04-01, 04-02, 04-03, 04-04, 04-05, 04-06]

tech-stack:
  added: [mapbox-gl@3.25.0, react-map-gl@8.1.1, recharts@3.9.1, zustand@5.0.14, tailwindcss@4.3.2, shadcn config, tsx]
  patterns: [Next rewrites /api/v1/*, --fv-* brand tokens, node:test with tsx loader]

key-files:
  created:
    - apps/web/src/app/status/page.tsx
    - apps/web/src/lib/segment-geojson.ts
    - apps/web/src/lib/kpi.ts
    - apps/web/src/lib/segment-lookup.ts
    - apps/web/components.json
    - apps/web/postcss.config.mjs
  modified:
    - apps/web/package.json
    - apps/web/next.config.ts
    - apps/web/src/app/globals.css
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx

key-decisions:
  - "Test runner uses node --import tsx --test (matches @fleetvolt/api pattern) because plain node --test cannot load TypeScript sources"
  - "SoC gradient colors use UI-SPEC hex values (#16A34A, #D97706, #DC2626) rather than RESEARCH example palette"

patterns-established:
  - "Pattern: buildSocGradientExpression returns Mapbox line-gradient step expression from segment dist_m / totalDistM"
  - "Pattern: deriveKpiSummary reads only @fleetvolt/shared-types SimulateResponse schemas"

requirements-completed: [SCEN-04]

coverage:
  - id: D1
    description: Web app has map/chart/state deps, Next rewrites, shadcn/Tailwind brand tokens
    requirement: SCEN-04
    verification:
      - kind: unit
        ref: "pnpm --filter @fleetvolt/web typecheck"
        status: pass
      - kind: other
        ref: "grep rewrites apps/web/next.config.ts && grep --fv-bg apps/web/src/app/globals.css"
        status: pass
    human_judgment: false
  - id: D2
    description: Stack health page relocated to /status; root page is workspace placeholder
    verification:
      - kind: other
        ref: "test -f apps/web/src/app/status/page.tsx && grep fetchStackMeta apps/web/src/app/status/page.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: segment-geojson, kpi, segment-lookup libs with node:test coverage
    requirement: SCEN-04
    verification:
      - kind: unit
        ref: "node --import tsx --test apps/web/src/lib/*.test.ts"
        status: pass
    human_judgment: false

duration: 12 min
completed: 2026-07-01
status: complete
---

# Phase 4 Plan 07: Web Foundation Summary

**Next.js dashboard foundation with Tailwind v4 brand tokens, API rewrites, /status relocation, and tested segment/KPI/map-sync utilities**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-01T20:12:33Z
- **Completed:** 2026-07-01T20:24:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Installed map/chart/state dependencies, Tailwind v4, shadcn config, and `--fv-*` brand tokens with Inter font and 1024px desktop guard
- Added Next.js rewrites `/api/v1/:path*` → Fastify and relocated stack health page to `/status`
- Implemented `segment-geojson`, `kpi`, and `segment-lookup` pure libs with passing node:test coverage

## Task Commits

Each task was committed atomically:

1. **Task 1: Install web dashboard foundation** - `8a5e51c` (feat)
2. **Task 2: Unit test scaffolds (RED)** - `cb5c023` (test)
3. **Task 2: Unit test scaffolds (GREEN)** - `ab845ed` (feat)

**Plan metadata:** `69fcb70` (docs: complete plan)

## Files Created/Modified

- `apps/web/next.config.ts` - transpilePackages + API rewrites to Fastify
- `apps/web/src/app/globals.css` - Tailwind v4 + `--fv-*` brand tokens and shadcn CSS variables
- `apps/web/src/app/status/page.tsx` - Stack health diagnostics (relocated from `/`)
- `apps/web/src/lib/segment-geojson.ts` - Mapbox SoC gradient step expression builder
- `apps/web/src/lib/kpi.ts` - KPI summary derivation from SimulateResponse
- `apps/web/src/lib/segment-lookup.ts` - Nearest segment lookup by cumulative distance

## Decisions Made

- Test runner uses `node --import tsx --test` matching the API service pattern; plain `node --test` cannot resolve TypeScript modules
- SoC gradient colors follow UI-SPEC hex values, not the alternate palette in RESEARCH Pattern 2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript tests require tsx loader**
- **Found during:** Task 2 verification
- **Issue:** Plan verify command `node --test` fails on `.ts` imports without a loader
- **Fix:** Added `tsx` devDependency and test script `node --import tsx --test src/lib/*.test.ts`
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Verification:** All 4 tests pass via tsx loader
- **Committed in:** ab845ed

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for TypeScript test execution; no scope change.

## Issues Encountered

- `pnpm --filter` triggers workspace install hooks that fail in non-TTY CI/sandbox; direct `./node_modules/.bin/tsc` used for verification instead

## User Setup Required

**External services require manual configuration.** See [04-USER-SETUP.md](./04-USER-SETUP.md) for:
- `NEXT_PUBLIC_MAPBOX_TOKEN` for Mapbox map rendering in Plan 02

## Next Phase Readiness

- Plans 04-01 through 04-06 can proceed with branded shell, deps, rewrites, and lib utilities in place
- Map token must be configured before Plan 04-02 map components

## Self-Check: PASSED

- FOUND: apps/web/src/app/status/page.tsx
- FOUND: apps/web/src/lib/segment-geojson.ts
- FOUND: apps/web/src/lib/kpi.ts
- FOUND: apps/web/src/lib/segment-lookup.ts
- FOUND: apps/web/src/lib/segment-geojson.test.ts
- FOUND: 8a5e51c, cb5c023, ab845ed

---
*Phase: 04-analyst-dashboard-export*
*Completed: 2026-07-01*
