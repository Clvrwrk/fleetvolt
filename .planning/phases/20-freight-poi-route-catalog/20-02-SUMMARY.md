---
phase: 20-freight-poi-route-catalog
plan: 02
subsystem: ui
tags: [react, zustand, google-maps, responsive, route-catalog]
requires:
  - phase: 20-freight-poi-route-catalog
    provides: promoted and Recent route catalog query
provides:
  - grouped Preconfigured and Recent route selector
  - compact ROAD / TRAFFIC / CHARGE manifest
  - responsive cached-route focus without statewide marker clutter
affects: [caas-workbench, mobile-workbench, route-card]
tech-stack:
  added: []
  patterns: [shared draft selection identity, route-focus map remount bounds]
key-files:
  created:
    - apps/web/src/components/workbench/map-workbench/inputs/route-catalog-select.tsx
  modified:
    - apps/web/src/components/workbench/map-workbench/inputs/route-builder.tsx
    - apps/web/src/components/workbench/map-workbench/workbench-left-panel.tsx
    - apps/web/src/components/workbench/map-workbench/fleetvolt-map-canvas.tsx
key-decisions:
  - "A catalog choice temporarily focuses the map on the route only without overwriting the user's saved layer profile."
  - "Catalog selection identity lives in the shared workbench draft so desktop and mobile panels stay synchronized."
requirements-completed: [ROUTE-CATALOG-03, ROUTE-CATALOG-04, ROUTE-CATALOG-05]
coverage:
  - id: D1
    description: Grouped route selector replaces the five large quick-corridor cards while manual endpoints remain
    requirement: ROUTE-CATALOG-03
    verification:
      - kind: automated_ui
        ref: "In-app browser DOM: five Preconfigured options; manual Origin/Destination retained"
        status: pass
    human_judgment: false
  - id: D2
    description: Cached road selection applies road geometry and ROAD / TRAFFIC / CHARGE manifest without provider fetch
    requirement: ROUTE-CATALOG-04
    verification:
      - kind: automated_ui
        ref: "localhost:3000/caas — K-PAC manifest 5 mi / p90 14.9K / 1 Class 8"
        status: pass
    human_judgment: false
  - id: D3
    description: Route selector and focus behavior across desktop, iPad, and mobile
    requirement: ROUTE-CATALOG-05
    verification:
      - kind: automated_ui
        ref: "In-app browser 1440x900, 1024x768, 390x844; zero horizontal overflow and zero generator markers in route focus"
        status: pass
    human_judgment: true
    rationale: "Chris must visually approve ScreenshotOne evidence from the temporary public preview before Phase 20 closes."
completed: 2026-07-11
status: complete
---

# Phase 20 Plan 02 Summary

The workbench now offers a compact cached-route instrument that restores road truth immediately, summarizes traffic and Class-8 readiness, and stays synchronized across responsive layouts.

## Delivered

- Native grouped selector with Preconfigured routes first and authenticated Recent routes second.
- Compact three-cell ROAD / TRAFFIC / CHARGE strip; no amenity or carrier detail inside the selector.
- Removed the five large Quick corridors cards while retaining manual endpoint entry.
- Catalog choice restores cached geometry, opens the consistent route card with Close, filters statewide markers, and preserves the user's saved normal layer profile.
- Shared catalog selection survives desktop/mobile panel swaps; focused map bounds initialize correctly after responsive remounts.

## Commits

| Commit | Description |
| --- | --- |
| `8dc451b` | Grouped route selector, manifest, and quick-card removal |
| `de43501` | Route-focus filtering, synchronized breakpoint state, and responsive route bounds |

## Verification

- Focused ESLint: passed.
- Next production build: passed.
- Docker production build: passed; `fleetvolt-review-web` healthy on port 3000.
- Desktop: road route visible at zoom 12, manifest visible, zero generator markers.
- iPad: route selection and map focus retained, zero horizontal overflow.
- Mobile 390×844: selector and manifest synchronized, route focus centered at `33.7725,-118.2230`, zero horizontal overflow and zero generator markers.
- ScreenshotOne schema/connection: verified; capture awaits explicit temporary-tunnel approval because the service cannot reach private localhost.

## Deviations

- Local visual review exposed and fixed three integration gaps: statewide markers remained during route planning, catalog selection was component-local across responsive panels, and Google Maps reapplied statewide bounds after a mobile remount.
- The catalog-specific minimum focus pad was reduced so five-mile drayage routes remain inspectable; long corridors retain proportional padding.

## Self-Check

PASSED for implementation and local responsive verification. Human visual closure remains intentionally pending on ScreenshotOne evidence.
