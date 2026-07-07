# Phase 7: Foundation — Shell, Data Contract & Map Base - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 7-Foundation — Shell, Data Contract & Map Base
**Areas discussed:** Map library, Data foundation depth, Auth boundary, Shell & map framing

---

## Map Library (Mapbox vs Google)

| Option | Description | Selected |
|--------|-------------|----------|
| Google for /pulse only | Add Google alongside existing Mapbox map on other tabs | |
| Reuse existing Mapbox stack | One map library; lose Google Traffic/Directions | |
| Migrate whole app Mapbox→Google | Bigger; risk to shipped Phase 4 map | ✓ |

**User's choice:** Migrate the whole app Mapbox→Google.
**Notes:** Scout discovered the app already ships a Mapbox stack (`react-map-gl` + `mapbox-gl` v3.25 in `route-map.tsx`) — the v2.0 plan had assumed a first-time Google integration. User opted for a full migration despite the flagged risk that this pulls shipped Phase 4 map work (SoC-gradient polyline, charger markers, token banner) into Phase 7. Recorded with an explicit scope-expansion note for the planner.

---

## Data Foundation Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Convex-native, 1–2 curated corridors | Schema + seed actions, hand-curate I-710/I-5 | |
| Static JSON now, seed Convex later | Fastest to a visible map; provenance still attached | |
| Full ingest scripts for all sources up front | Most complete, highest Phase-7 cost | ✓ |

**User's choice:** Full ingest scripts for all cataloged sources up front.
**Notes:** Flagged as the heaviest workstream and most likely timeline-slip point for a 5-day demo. `data-review-gate` skill applies per source; usefulness score is an output, not the catalog's assumed pre-score. Live feeds remain stretch (DINT-07) — this ingest is of downloads/archives.

---

## Auth Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Full WorkOS AuthKit now | /pulse behind real login, Convex authed via WorkOS token | |
| WorkOS wired + demo-accessible bypass | Feature-flag so demo can't be blocked by SSO | |
| Defer WorkOS to Phase 10 | Build /pulse open first, add auth boundary last | ✓ |

**User's choice:** Defer WorkOS to Phase 10.
**Notes:** WorkOS is net-new (not installed). Consequences recorded: SHELL-01's auth-boundary clause shifts to Phase 10; Convex queries run unauthenticated in Phase 7, so `userFilters` uses anonymous/local state until auth lands.

---

## Shell & Map Framing

| Option | Description | Selected |
|--------|-------------|----------|
| Strict design-MD CAD shell + Google vector styling | TechnicalFrame/BlueprintGrid/JetBrains Mono; ports as AdvancedMarkers, CA-coast framing | ✓ |
| Reuse existing app chrome + blueprint styling | Faster, less pixel-faithful | |
| Minimal shell now, CAD polish in Phase 10 | Protects schedule | |

**User's choice:** Strict design-MD CAD shell + Google vector cloud-styling.
**Notes:** Existing reusable chrome noted (screen-shell, app-action-bar, card, screen-header) but CAD shell built strictly from the design MD per user. JetBrains Mono already loaded in layout.tsx. Blueprint grid rendered off the GL canvas per architecture research.

## Claude's Discretion

- Convex table field refinements beyond the research schema, control-panel composition, blueprint-grid animation technique (CSS vs canvas).

## Deferred Ideas

- Live real-time signals (PeMS real-time, 511, Google Traffic tint) — DINT-07/TIME-02, Phase 10+
- WorkOS auth + Sentry monitoring — Phase 10
- Flow animation/encoding/truck marker — Phase 8
- Hotspots, dimension-callout popups, market sizing, Data Quality Inspector — Phase 9
