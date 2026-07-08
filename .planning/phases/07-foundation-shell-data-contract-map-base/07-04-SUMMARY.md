---
phase: 07-foundation-shell-data-contract-map-base
plan: 04
status: superseded
superseded_by: Phase 11 (google-maps-app-wide-routing-migration)
completed: 2026-07-08
---

# Plan 07-04 — SUPERSEDED (not executed)

## Original intent

Migrate the Phase 4 route map from Mapbox (`react-map-gl` + `mapbox-gl`) to `@vis.gl/react-google-maps` on a vector `mapId`, and re-verify MAP-01/02/03 UAT after the port.

## Why superseded

v3.0 full-platform migration (2026-07-07) replaced the narrow `/pulse`-only Google Maps path with **app-wide** Google Maps + Routes. That work shipped as **Phase 11** (`11-01`–`11-03` SUMMARYs), which retired Mapbox and Valhalla routing for the live product surface.

Executing 07-04 now would duplicate Phase 11 and fight the current `@vis.gl` + workbench map stack (Phase 17).

## Disposition

- **Do not execute** this plan.
- Treat Mapbox → Google port as **done via Phase 11**.
- Remaining Phase 7 demo items (08–10 Freight Pulse flow engine) remain deferred / superseded by v3.0 hotspot + workbench product direction.

## Evidence

- `.planning/phases/11-google-maps-app-wide-routing-migration/11-01-SUMMARY.md`
- `.planning/phases/11-google-maps-app-wide-routing-migration/11-02-SUMMARY.md`
- `.planning/phases/11-google-maps-app-wide-routing-migration/11-03-SUMMARY.md`
- `.planning/PROJECT.md` — Milestone v3.0 supersedes v2.0 parallel-stack decisions
