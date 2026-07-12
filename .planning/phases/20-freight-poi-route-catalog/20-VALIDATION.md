---
phase: 20
slug: freight-poi-route-catalog
date: 2026-07-11
---

# Phase 20 Validation Strategy

## Automated

- Catalog policy tests: directional keys, newest-recent dedupe, grouping, manifest semantics.
- Phase-18/19 cache regression tests.
- Focused ESLint and Convex codegen.
- Docker production build and health.

## Live data

- Precompute five explicit generator routes one at a time.
- Catalog query returns five promoted Preconfigured entries with at least eight road points and request hashes.
- Each entry has route-intelligence freshness/coverage.
- Identical selection/list operations do not increase PTV refresh count.

## UI

- Default catalog loading/loaded state.
- Preconfigured optgroup and Recent optgroup when authenticated history exists.
- Selected route changes endpoints, uses cached road geometry, and renders ROAD/TRAFFIC/CHARGE only.
- Desktop 1440x900, iPad 1024x1366, Mobile 390x844.
- ScreenshotOne evidence for default and selected states requires approved temporary public exposure because ScreenshotOne cannot reach localhost.
