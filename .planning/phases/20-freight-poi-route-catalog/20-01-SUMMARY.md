---
phase: 20-freight-poi-route-catalog
plan: 01
subsystem: routes
tags: [convex, ptv, route-cache, route-intelligence, catalog]
requires:
  - phase: 19-road-level-route-intelligence
    provides: persistent road geometry and independently refreshed intelligence snapshots
provides:
  - promoted freight-route catalog referenced by request hash
  - directional authenticated Recent-route policy
  - five individually seeded Alpha routes with geometry and intelligence receipts
affects: [workbench, route-selector, overlapping-route-chooser]
tech-stack:
  added: []
  patterns: [request-hash repository references, one-route-at-a-time provider action]
key-files:
  created:
    - apps/web/convex/routes/catalog.ts
    - apps/web/convex/routes/catalogPolicy.ts
    - apps/web/convex/routes/catalogPolicy.test.ts
  modified:
    - apps/web/convex/schema.ts
    - apps/web/convex/_generated/api.d.ts
key-decisions:
  - "Catalog rows reference route geometry and intelligence by requestHash; provider payloads are never duplicated."
  - "The provider action accepts one generator only so every PTV/cache operation has an individual receipt."
requirements-completed: [ROUTE-CATALOG-01, ROUTE-CATALOG-02, ROUTE-CATALOG-03]
coverage:
  - id: D1
    description: Directional catalog and Recent-route policy
    requirement: ROUTE-CATALOG-01
    verification:
      - kind: unit
        ref: apps/web/convex/routes/catalogPolicy.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Five promoted freight routes with road geometry and intelligence receipts
    requirement: ROUTE-CATALOG-02
    verification:
      - kind: integration
        ref: "Convex routes/catalog:precomputeFreightPoi — five individual invocations"
        status: pass
    human_judgment: false
  - id: D3
    description: Grouped catalog query with authenticated directional Recents
    requirement: ROUTE-CATALOG-03
    verification:
      - kind: integration
        ref: "Convex routes/catalog:list"
        status: pass
    human_judgment: false
completed: 2026-07-11
status: complete
---

# Phase 20 Plan 01 Summary

Five curated freight-generator routes now resolve to associated ports, reuse the 90-day PTV repository, attach Phase-19 intelligence, and appear through one catalog contract.

## Delivered

- `routeCatalogEntries` stores curation metadata and request-hash references without copying geometry or intelligence payloads.
- Directional Recent-route identity, newest-use deduplication, and ROAD / TRAFFIC / CHARGE summary policy have focused unit coverage.
- `precomputeFreightPoi` deliberately accepts one generator per invocation; there is no mass PTV action.
- Alpha catalog receipts:
  - POLB → Konoike Pacific (K-PAC): 190 points, `bf77ea9492f2f51d7e2dcd9f0cdf45e1974a49e478604795375976bb909966ea`
  - POLB → A & R Transport San Bernardino: 800 points, `e364a348a432992f27f279b0e1eab25b7f75ccf6da3de903f93a97bb99b94891`
  - Oakland → Westway Terminal Stockton: 800 points, `b7bdac6c2a7d464f0274157b9513f94f9f2f6d573d9dbc8be8ed189e202ee0fa`
  - Port Hueneme → Bakersfield QDC: 800 points, `914a0b6a4de8ca889f71a88b4af93938ff5d999ab14310668c46f46efb9a99c0`
  - Port of San Diego → Plastic Express: 419 points, `37aa2293ff78af304af7f3ca76fb9b31317be8972b97af6b9979bd3ba26a69b3`

## Commits

| Commit | Description |
| --- | --- |
| `2b235d2` | Catalog schema, repository, policies, and tests |
| `dfbc404` | Backward-compatible place normalization |

## Verification

- Catalog policy tests: 3 passed, 0 failed.
- Focused ESLint: passed.
- Convex deployment: passed on `sensible-oriole-832`.
- Five explicit geometry receipts and five intelligence `database-miss-write` receipts: passed.
- Public catalog query returned all five promoted routes; anonymous Recents correctly returned empty.

## Deviations

- The first K-PAC row used the pre-normalization `traffic-generator` place kind. Storage remains backward-compatible and the workbench normalizes catalog places at its typed boundary, avoiding a destructive migration.

## Self-Check

PASSED. All backend requirements have code, test, deployment, and live data receipts.
