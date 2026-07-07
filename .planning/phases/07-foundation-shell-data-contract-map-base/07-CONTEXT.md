# Phase 7: Foundation — Shell, Data Contract & Map Base - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 delivers the foundation for the Freight Pulse `/pulse` surface: the Technical Brand Geometry app shell, a base map with West-Coast framing + port anchors, a provenance-tagged Convex data layer with full multi-source ingest, and a persistent sources footer. This is the substrate the flow engine (Phase 8) and interaction layers (Phases 9–10) build on.

**In scope:** SHELL-01 (route + nav; see auth note below), SHELL-02 (TechnicalFrame + blueprint grid), SHELL-03 (JetBrains Mono CAD treatment), SHELL-04 (responsive), SHELL-06 (control panel chrome), SRC-01/02/03/04 (provenance, sources footer, curated ingest, simulated-vs-real labeling), FLOW-01 (vector map, West-Coast framed), FLOW-02 (port anchors + selector), FLOW-07 (CAD map styling), DINT-01 (provenance object), DINT-03 (usefulness rubric at ingest).

**Not in scope (later phases):** flow animation/encoding (Phase 8), hotspots/market sizing (Phase 9), time controls/live mode/auth boundary (Phase 10).
</domain>

<decisions>
## Implementation Decisions

### Map Library — FULL migration Mapbox → Google
- **D-01:** Migrate the entire web app from the existing Mapbox stack (`react-map-gl` + `mapbox-gl` v3.25) to Google Maps JS API — not just `/pulse`. Single map library across the app. Chosen because the paid Google console + street-level Directions/Traffic were the whole rationale for the Google decision, and running two map libraries long-term is worse than one migration.
- **D-02:** Use `@vis.gl/react-google-maps` (per STACK research) with a **vector `mapId`** (required for AdvancedMarkerElement + cloud styling). Pin `version: 'quarterly'`.
- **⚠ SCOPE-EXPANSION NOTE (planner must size for this):** This pulls **shipped Phase 4 v1 work** into Phase 7's blast radius. `apps/web/src/components/map/route-map.tsx` (SoC-gradient route polyline, charger markers, hover sync), the map-token-missing banner, and any Mapbox styling must be ported to Google's vector map + AdvancedMarkers. This risks regressing a passing v1 UAT (Phase 4 map tests). Plan a dedicated migration wave + re-verify the Phase 4 map interactions after porting. Reversible via git if reconsidered.

### Data Foundation — FULL ingest up front
- **D-03:** Write full ingest scripts for **all cataloged sources** (FAF5, Caltrans AADT/GIS, PeMS archive, FHWA parking, FMCSA, BTS port stats, POLB carrier Excel/PDTR, 511 events, drayage.com fallback) into Convex up front, rather than hand-curating 1–2 corridors or bundling static JSON.
- **D-04:** Apply the `data-review-gate` skill (raw review → 0–10 usefulness score → match plan) to EACH source at ingest; the score is an OUTPUT stored on the record, never the catalog's assumed pre-score (DINT-03).
- **D-05:** Every ingested record carries `provenance: {source, fetchedAt, usefulnessScore, matchMethod}` in Convex (DINT-01, SRC-01). Simulated/estimated values labeled distinctly from measured (SRC-04).
- **⚠ TIMELINE-RISK NOTE:** Full multi-source ingest is the heaviest single workstream in the milestone and the most likely place a 5-day demo slips. Planner should wave-parallelize source ingests and treat scraping sources (drayage.com) as ToS-checked fallback only. Live sources (PeMS real-time, 511) remain stretch (DINT-07) — the ingest here is of downloads/archives, not live feeds.

### Auth Boundary — deferred to Phase 10
- **D-06:** Build `/pulse` **open inside the app shell** in Phase 7. WorkOS AuthKit (net-new, not yet installed) is deferred to Phase 10 polish so a login/SSO hiccup can't block the BD demo.
- **⚠ TRACEABILITY NOTE:** SHELL-01's "inside the WorkOS auth boundary" clause effectively **moves to Phase 10**. Phase 7 delivers the `/pulse` route + nav tab WITHOUT the auth boundary. Planner/roadmap traceability should reflect that the auth portion of SHELL-01 lands in Phase 10 alongside the WorkOS work.
- **D-07:** Because Convex queries run **unauthenticated** in Phase 7, `userFilters` cannot key on a WorkOS user id yet. Use an anonymous/local (e.g. session-scoped or singleton) filter-state approach until auth lands in Phase 10.

### Shell & Map Framing — strict design-MD fidelity
- **D-08:** Build the CAD shell strictly from the design MD: `TechnicalFrame`, `BlueprintGrid` (animated, rendered OFF the GL canvas per architecture research), `SkeuomorphicCard`, JetBrains Mono typography (already loaded via `next/font` in layout.tsx).
- **D-09:** Apply Google vector **cloud-based map styling** (via the Map ID) so default Google styling does not leak through the CAD aesthetic (FLOW-07, mitigates brand-fidelity pitfall).
- **D-10:** Port anchors (POLA, POLB, Port Hueneme, Oakland, SF, San Diego) rendered as `AdvancedMarkerElement`, map framed on the California coast on load, with a port selector in the control panel (FLOW-01/02, SHELL-06).

### Claude's Discretion
- Exact Convex table field refinements beyond the research schema, control-panel component composition, and blueprint-grid animation technique (CSS vs canvas) are left to research/planning — the architecture research already proposes a concrete schema and layered-rendering approach to follow.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design / Brand (strict adherence required per D-08)
- `Design/UI_UX_Screen_PRDs_Technical_Brand_Geometry.md` — the authoritative brand/screen spec the shell must follow
- `Design/Technical_Brand_Geometry_Component_Library_Spec.md` — component-library spec (TechnicalFrame, SkeuomorphicCard, DimensionCallout, etc.)
- `Design/technical-brand-geometry-1-DESIGN.md` + `Design/technical-brand-geometry-1.html` — reference design/markup

### Research (this milestone)
- `.planning/research/SUMMARY.md` — synthesis + roadmap implications (read first)
- `.planning/research/STACK.md` — locked stack + versions (note: repo is on Next 16.2.9, not the 15.5.x the doc recommended — see conflict note below)
- `.planning/research/ARCHITECTURE.md` — component + Convex schema + layered rendering (blueprint grid off GL canvas)
- `.planning/research/PITFALLS.md` — AdvancedMarkerElement, Directions caching, data-credibility

### Project docs
- `.planning/PROJECT.md` — v2.0 milestone + key decisions
- `.planning/REQUIREMENTS.md` — v2.0 requirements (FLOW/SRC/SHELL/DINT for this phase)
- `.planning/ROADMAP.md` — Phase 7 goal + success criteria

### Skill
- `data-review-gate` (Hermes skill, category data-science) — the raw-review → usefulness-score → match-plan gate applied per source at ingest (D-04)

### ⚠ Conflicts to resolve at planning time
- **Next.js version:** STACK.md recommends pinning Next 15.5.x and warns Next 16 is "too fresh" for Convex/WorkOS/Sentry guides. **Repo is already on Next 16.2.9.** Planner must verify Convex + (later) WorkOS/Sentry integration against Next 16 rather than downgrading. Do not blindly follow the 15.5.x pin.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/screens/screen-shell.tsx`, `components/design/app-action-bar.tsx`, `components/design/screen-header.tsx`, `components/ui/card.tsx` — existing chrome; may inform (but per D-08 the CAD shell is built strictly from the design MD, layering over these where sensible)
- `apps/web/src/app/layout.tsx` — already loads Inter + JetBrains_Mono via `next/font/google` (JetBrains Mono available for D-08)
- Radix primitives already installed (checkbox, collapsible, dropdown-menu, label, select, slider, slot) — usable for the control panel / Data Quality Inspector drawer
- Existing routes: `planner`, `status`, `network`, `driver`, `load`, `unit`, `home` — `/pulse` is a new sibling route

### Established Patterns
- **Map stack is Mapbox** (`react-map-gl/mapbox` + `mapbox-gl`) in `components/map/route-map.tsx` — this is what D-01 migrates away from
- Monorepo: pnpm workspaces (`apps/*`, `services/*`, `packages/*`), `pnpm@11.9.0`; web app is Next **16.2.9** + React 19.2.7 + Tailwind 4.3.2
- Convex / WorkOS / Sentry are NOT yet installed — net-new in this milestone

### Integration Points
- New `/pulse` route under `apps/web/src/app/pulse/`, added to whatever nav lists the existing tabs
- Convex client provider added to `apps/web/src/app/layout.tsx` (client provider component, `'use client'`)
- Map migration touches `components/map/route-map.tsx` and every consumer of the Mapbox map (Phase 4 workspace)
</code_context>

<specifics>
## Specific Ideas

- Curated priority corridors for the West-Coast framing should include the POLB drayage arteries already central to v1 (I-710, I-110, I-5, US-101), consistent with the existing corridor work.
- The "we can sell this tomorrow in 30s" bar means the base map + framing + ports + sources footer should read as credible and on-brand immediately, even before flows land in Phase 8.
</specifics>

<deferred>
## Deferred Ideas

- **Live real-time signals** (PeMS real-time, 511 events, Google Traffic live tint) — DINT-07 / TIME-02, stretch, Phase 10+; Phase 7 ingests downloads/archives only.
- **WorkOS auth boundary + Sentry monitoring** — Phase 10 (D-06). Sentry error-boundary wrapping of the map/engine also lands then.
- **Flow animation, encoding, truck marker** — Phase 8.
- **Hotspots, dimension-callout popups, market sizing, Data Quality Inspector drawer** — Phase 9 (DINT-04/05).

None of these were scope-creep attempts — they are already-mapped later-phase items surfaced during discussion and kept in their phases.
</deferred>

---

*Phase: 7-Foundation — Shell, Data Contract & Map Base*
*Context gathered: 2026-07-06*
