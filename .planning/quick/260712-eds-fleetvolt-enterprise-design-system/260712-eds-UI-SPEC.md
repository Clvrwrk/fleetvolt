---
quick_id: 260712-eds
status: in_progress
mode: quick-inline
date: 2026-07-12
issue: FLE-19
---

# FleetVolt Enterprise UI Specification

## Intent

Replace the mixed pale-CAD, generic-SaaS, and command-dark languages with one governed enterprise system. The first implementation wave establishes semantic tokens, shared shell behavior, a live component showroom, and a redesigned role-selection entry point.

## Visual contract

- Dark command center, not a consumer EV app.
- Arcline owns application typography; JetBrains Mono owns telemetry; Brokline remains campaign-only.
- Carbon canvas, gunmetal panels, electric-blue action, semantic green/amber/red.
- Square industrial geometry with restrained depth.
- Real route/map/data artifacts are the visual identity; no decorative generated imagery.

## Responsive contract

- Desktop 1440×900: persistent rail, wide evidence layouts.
- iPad 1024×1366: two-column where useful, drawers for secondary workbench controls.
- Mobile 390×844: one decision column, bottom sheets for supporting map controls, 44 px minimum targets.

## Accessibility contract

- WCAG 2.2 AA minimum.
- Visible focus, logical keyboard order, no color-only statuses.
- `prefers-reduced-motion` disables nonessential animation.
- Loading, empty, stale, unavailable, error, and verified states are explicit.

## First-wave acceptance

1. `/role-select` visually matches the public FleetVolt command direction, clearly exposes CaaS Alpha, and marks Fleet Manager and Driver Coming Soon.
2. The authenticated non-map shell uses Command Dark without changing map canvas behavior.
3. `/design-system` renders the live palette, type, controls, state, and decision-surface primitives.
4. The design-system governance document defines component, map, motion, accessibility, and migration rules.
5. Desktop, iPad, and mobile pass without horizontal overflow or unreadable content.
