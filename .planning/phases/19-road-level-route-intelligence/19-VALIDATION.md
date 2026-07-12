---
phase: 19
slug: road-level-route-intelligence
date: 2026-07-11
---

# Phase 19 Validation Strategy

## Automated checks

1. Pure enrichment policy tests: seven-day freshness boundary, lease contention, route sampling, bbox expansion, AADT stats, stable dedupe, and unavailable-vs-zero semantics.
2. Phase-18 cache and PTV adapter regressions remain green.
3. Focused ESLint passes for all Phase-19 modules and touched repository code.
4. Convex codegen/deployment accepts schema and actions.
5. Docker production build succeeds and health reports Convex + Google Maps available.

## Live proof

Using request hash `29241a81c5496c3c27c99aca9805605258c48d62d42e6785dc06b670693e55ac`:

1. First enrichment call returns `database-miss-write` or `database-refreshed` with category coverage and provenance.
2. Identical second call returns `database-hit`, access count increases, refresh count does not.
3. Phase-18 geometry call remains `database-hit` with the same geometry expiry.

## Browser safety check

Phase 19 has no intended visual changes. Rebuild the shared Docker review app, allow the map to settle, and confirm `/caas` remains intact at 1440x900, 1024x1366, and 390x844 with no horizontal overflow. This is a regression receipt, not evidence that the backend snapshot is visible yet.
