# Project Research Summary

**Project:** FleetVolt — v2.0 Freight Pulse Network Visualizer
**Domain:** Animated Google-Maps freight-flow / market-opportunity visualization (parallel surface on an existing Next.js app)
**Researched:** 2026-07-06
**Confidence:** MEDIUM-HIGH

## Executive Summary

Freight Pulse is a new `/pulse` tab that layers an animated freight-movement visualization (pulsing R/Y/G volume flows on real highway geometry, a leading Class-8 truck marker, clickable hotspots, TAM/SAM/SOM overlays, a 5yr/1yr/Live time filter) over a Google Map, styled in a skeuomorphic "Technical Brand Geometry" CAD aesthetic. It is a **parallel visualization stack** that shares only the existing FleetVolt app shell (nav, layout, WorkOS auth, Sentry, Tailwind/Shadcn theme) and intentionally does **not** touch the shipped Docker/PostGIS/Valhalla/FastAPI simulation backend. Its purpose is a BD/sales demo that proves market size and pinpoints mobile-solar-charger deployment sites — success = a BD user can interact and say "we can sell this tomorrow" in under 30 seconds. Hard deadline: an interactive demo on Friday July 11 (5-day build) via an autonomous agent pipeline gated by Coderabbit + Greptile reviews.

The recommended approach is a lean, demo-first build on a locked stack: Next.js 15.5.x (App Router) + React 19 on Vercel, `@vis.gl/react-google-maps` 1.9 for the map, Convex 1.42 for reactive data + user-filter state, WorkOS AuthKit for auth, Sentry v10 for monitoring, and GSAP 3.15 (all plugins now free) for CAD-style chrome/reveal animation. Data is **precomputed and curated** into Convex from public sources (BTS/FAF freight flows, Caltrans AADT/GIS + PeMS traffic, FHWA parking, FMCSA HQs, port stats) — no live pipelines, no calling Directions per render.

The dominant risk is **not** technical difficulty; it is (1) credibility — the stakeholder demanded accuracy, so simulated volumes framed as real, or a "Live" mode implying GPS tracking, is a demo-killer that must be defused with a provenance data contract and a sources footer before any render code; and (2) scope — the non-negotiable demo core is small, and several attractive features ("Live" sim, last-mile street reveal, multi-type hotspots) are explicitly cuttable if the week slips.

## Key Findings

### Recommended Stack

Locked stack, verified against the live npm registry on 2026-07-06. Stay on the mature Next 15.5.x line (not 16.x) for Convex/WorkOS/Sentry integration stability.

**Core technologies:**
- **Next.js 15.5.20 + React 19.2.7** on Vercel — app framework; App Router; peer baseline for the map lib and Convex.
- **`@vis.gl/react-google-maps` 1.9.0** — primary map wrapper (hooks-first, React 19 / App Router native, best fit for imperative overlay/animation). Explicitly preferred over `@react-google-maps/api` (community-maintained, React 19/StrictMode friction, component-only API fights per-frame animation).
- **Convex 1.42.1** (+ `@convex-dev/workos` bridge) — reactive DB/state; date-filter (5yr/1yr/Live) implemented as reactive query args; wired via a `'use client'` `ConvexProviderWithAuth`.
- **GSAP 3.15.0** — animation; since v3.13 all plugins (MotionPath, DrawSVG) are 100% free. Use `@gsap/react` `useGSAP` for React 19.
- **Google Maps JS API** — pin `version: 'quarterly'` in `<APIProvider>` (never `weekly` in prod); vector `mapId` mandatory for WebGL overlays + AdvancedMarkerElement.
- **`@workos-inc/authkit-nextjs` 4.2.0**, **`@sentry/nextjs` 10.63.0** (instrumentation-hook model), **Tailwind 4.3.2 + Shadcn/ui**, **`@fontsource/jetbrains-mono`** for CAD typography.
- Supporting: `@turf/turf` (along/bearing for marker heading), `simplify-js` (thin dense polylines), `@googlemaps/markerclusterer` (dense hotspots).

### Expected Features

**Must have (table stakes):** interactive West-Coast-framed Google Map; named port anchors (POLA/POLB/Hueneme/Oakland/SF/San Diego); volume-flow lines on real highway geometry; R/Y/G volume encoding + legend; click/hover detail popups; TAM/SAM/SOM readout with real figures; 5yr/1yr time filter; responsive laptop layout; **data-source transparency footer**.

**Should have (differentiators):** pulsing/animated flow lines (the namesake "wow"); leading Class-8 truck SVG marker riding the flow; solar-charger site-recommendation hotspots (the sales thesis); technical dimension-callout popup styling; TAM/SAM/SOM overlay toggles fused with the map; "Live" simulation mode; last-mile street-level route reveal; hotspot taxonomy.

**Defer / anti-features (out of scope for Friday):** live external data ingestion (AIS/BTS-live/TMS); editable what-if sliders; nationwide/global coverage; accounts/saved scenarios/PDF-PPT export; full WCAG AA audit (keep basics); mobile-phone layout; deep nested drill-down overlays; a backend service/DB for `/pulse` beyond Convex; audited historical-accuracy guarantees (label data as illustrative).

**Six feature categories (seed the REQ categories):** 1. Map & Flow Engine · 2. Hotspots & Recommendations · 3. Market Sizing · 4. Time Controls · 5. Data & Sourcing · 6. Shell / Chrome.

### Architecture Approach

A parallel surface sharing only the app shell. The map is a single Vector-mode `google.maps.Map` (vector `mapId` required); bespoke visuals are layered on top rather than fighting the base map. The blueprint grid is DOM/CSS/GSAP **behind/around** the map frame (off the GL canvas to avoid contention). A single `requestAnimationFrame` clock drives pulse + moving-marker, pushing updates without React re-renders; GSAP is reserved for DOM chrome (grid, callout entrances, panel transitions). Hotspots use `AdvancedMarkerElement` + React-portalled `DimensionCallout`. Last-mile routes use Directions fetched **once and cached in Convex**, never per-frame.

**Major components:** `FreightPulseTab` (route/nav), `PulseMap` (map host), `VolumeFlowEngine` (volume→color/width + animation clock + truck marker), `HotspotLayer`, `MarketSizingPanel`, `TimeFilterBar`, plus shared `TechnicalFrame`, `DimensionCallout`, `SkeuomorphicCard`, `BlueprintGrid`. **Convex tables:** `ports`, `highwaySegments` (geometry), `freightFlows` (by date range, with `source` + `congestion`), `hotspots`, `marketSizing`, `userFilters`.

### ⚠ Open Technical Decision — flow rendering approach

The research produced a genuine fork to resolve during Phase planning:
- **ARCHITECTURE.md** recommends **deck.gl `GoogleMapsOverlay`** (interleaved WebGL2, `PathLayer`/`TripsLayer`/`IconLayer`) as primary — one GPU draw call for many segments; scales to hundreds/thousands.
- **STACK.md** recommends **native `google.maps.Polyline` + animated symbol/dashed-offset + GSAP** for a *curated* corridor set ("dozens, not thousands"), treating deck.gl as overkill and noting native Polyline better matches the CAD look with a lighter footprint; adds a new dependency (deck.gl) not in the locked stack.

**Resolution guidance:** For a CA-first, curated-corridor Friday demo (dozens of segments), the native-Polyline + GSAP path is lower-risk, lighter, and dependency-free — recommend it as the default and treat deck.gl as the scale-up path if corridor count explodes post-demo. Confirm during Phase 7 (flow engine) planning.

### Critical Pitfalls

1. **Simulated data framed as real** — stakeholder demanded accuracy; a "Live" mode implying real-time GPS or unsourced volumes kills the demo. Adopt a provenance-first data contract (every quantity carries `source` + `year`), rename to "Live **Simulation**" with an always-visible badge, and ship a persistent sources footer (FAF5/PeMS). **Address first, before render code.**
2. **Deprecated `google.maps.Marker`** (dead Feb 2024) — build the truck + hotspots on `AdvancedMarkerElement` from day 1; requires a vector `Map ID` (which also unlocks blueprint cloud styling).
3. **Live Directions API calls** — paid legacy SKU; dynamic map loads $7/1k. Precompute + cache all last-mile routes in Convex so the demo issues zero live Directions calls (no `OVER_QUERY_LIMIT` mid-presentation).
4. **Animation jank / React in the frame loop** — advance via one rAF clock + imperative updates; never `setState` per frame; keep the blueprint grid off the GL canvas.
5. **Google Maps default styling leaking through the CAD aesthetic** — apply cloud-based vector map styling via the Map ID; verify brand fidelity against the design MD as an explicit acceptance check.

## Implications for Roadmap

Phases continue numbering from **Phase 7** (v1 Phases 5–6 remain deferred). Suggested structure, dependency-ordered and demo-protective:

### Phase 7: Foundation — Shell, Data Contract & Map
**Rationale:** The credibility pitfall and the map/auth/Convex plumbing must exist before any visualization. Front-load the provenance data contract.
**Delivers:** `/pulse` route under the WorkOS auth boundary + nav tab; `TechnicalFrame`/`SkeuomorphicCard`/`BlueprintGrid` static shell; Convex schema (all 6 tables) + seed ingestion for ≥1 corridor with `source`/`year` provenance fields; Vector Google Map (`mapId`) with West-Coast framing + port anchors; sources footer.
**Addresses:** Shell/Chrome, Data & Sourcing (table stakes). **Avoids:** pitfalls #1, #2, #5.

### Phase 8: Flow Engine — Pulsing Volume Flows + Truck Marker
**Rationale:** The animated flow is the demo's heartbeat and highest-risk/highest-reward item; give it a dedicated phase.
**Delivers:** corridor polylines with R/Y/G + width volume encoding; pulse animation; leading Class-8 truck SVG marker riding a flow path; legend/key. Resolve the flow-rendering fork (native Polyline+GSAP default) here.
**Uses:** `@vis.gl/react-google-maps`, GSAP, `@turf/turf`, `simplify-js`. **Implements:** `VolumeFlowEngine`. **Avoids:** pitfalls #2, #4.

### Phase 9: Interaction — Hotspots, Callouts & Market Sizing
**Rationale:** With a stable animated map, add the clickable sales narrative.
**Delivers:** `HotspotLayer` (queue/parking, congestion, HQ proximity, solar-charger recs) with dimension-callout popups; `MarketSizingPanel` TAM/SAM/SOM overlay toggles + dimension-style figures.
**Addresses:** Hotspots & Recommendations, Market Sizing. **Implements:** `DimensionCallout` (shared).

### Phase 10: Time, Live Mode & Demo Polish
**Rationale:** Time controls, the cuttable "Live" mode, and demo hardening land last so the core is safe first.
**Delivers:** `TimeFilterBar` (5yr/1yr) → Convex `userFilters` reactive re-query; "Live Simulation" mode (labeled); optional last-mile Directions reveal (precached); GSAP chrome polish; Sentry context-loss handling; responsiveness; accessibility basics; brand-fidelity check vs design MD.
**Addresses:** Time Controls + polish. **Avoids:** pitfall #3.

### Phase Ordering Rationale
- Data contract + auth + map shell are hard prerequisites → Phase 7 first.
- The flow animation is isolated in Phase 8 because it is the single biggest schedule and "wow" risk — protect its time.
- Interaction (Phase 9) needs stable map anchors; polish and cuttable features (Phase 10) come last so a slip drops Live-mode/last-mile, not the core.
- Demo core that must survive any slip: framed map + pulsing R/Y/G flows on real corridors + truck marker + clickable charger-rec hotspots + TAM/SAM/SOM readout + sources footer.

### Research Flags
- **Phase 7:** verify exact public data endpoints (FAF5, Caltrans GIS/AADT, PeMS, FHWA parking, FMCSA) and licensing at ingestion time — MEDIUM confidence on exact fields.
- **Phase 8:** resolve deck.gl-vs-native-Polyline fork with a quick spike before committing the flow engine.
- **Phases 9–10:** standard patterns (Shadcn panels, Convex reactivity, GSAP chrome) — lighter research need.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified live against npm registry 2026-07-06 |
| Features | MEDIUM | Leaned on X Search synthesis + domain reasoning; web_extract backend was down |
| Architecture | HIGH | Grounded in Google WebGL Overlay + deck.gl + Convex docs (curl-verified) |
| Pitfalls | HIGH | Highest-stakes claims curl-verified against Google/Convex docs |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address
- **Exact public-data endpoints & fields** (FAF5/Caltrans/PeMS/FHWA/FMCSA) — confirm during Phase 7 ingestion; treat volumes as illustrative + sourced, not audited.
- **Flow-rendering approach** (deck.gl vs native Polyline) — resolve with a Phase 8 spike.
- **Firecrawl/web_extract outage during research** — Stack/Architecture/Pitfalls compensated via direct curl (HIGH); Features leaned on X Search (MEDIUM). Re-verify any MEDIUM data-source specifics before relying on them in client deliverables.

## Sources

### Primary (HIGH confidence)
- npm registry (`registry.npmjs.org/<pkg>/latest`) — live package versions, 2026-07-06
- Google Maps Platform docs — WebGL Overlay View lifecycle, AdvancedMarkerElement, `Marker` deprecation, Polyline symbol animation, version channels
- deck.gl docs — `GoogleMapsOverlay` interleaved WebGL2, `PathLayer`/`TripsLayer`/`IconLayer`
- Convex docs — schema/indexes/pagination, App Router `ConvexProviderWithAuth`, `@convex-dev/workos`
- WorkOS AuthKit Next.js SDK docs; Sentry Next.js v10 docs; GSAP/Webflow free-plugin announcement

### Secondary (MEDIUM confidence)
- xAI X Search synthesis — animated freight-flow dashboards (node sizing, R/Y/G, width-by-volume, trip animation, time-scrub) and TAM/SAM/SOM market-map UX
- Public agency data portals (FAF/BTS, Caltrans GIS/AADT + PeMS, FHWA parking, FMCSA, port stats) — existence/fields from domain knowledge; endpoints to verify at ingestion

### Tertiary (LOW confidence)
- None material — outages noted inline; affected findings flagged MEDIUM above.

---
*Research completed: 2026-07-06*
*Ready for roadmap: yes*
