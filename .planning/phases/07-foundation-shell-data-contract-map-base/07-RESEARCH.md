# Phase 7: Foundation — Shell, Data Contract & Map Base - Research

**Researched:** 2026-07-06
**Researcher:** gsd-phase-researcher
**Confidence:** HIGH (stack/versions), MEDIUM-HIGH (data endpoints — several agency portals bot-block `curl -I` with 403 but resolve in browser; flagged per-source)

---

## User Constraints

> Copied VERBATIM from `07-CONTEXT.md`. These are LOCKED. Downstream planning MUST NOT contradict them.

### Locked Decisions

- **D-01:** Migrate the entire web app from the existing Mapbox stack (`react-map-gl` + `mapbox-gl` v3.25) to Google Maps JS API — not just `/pulse`. Single map library across the app. Chosen because the paid Google console + street-level Directions/Traffic were the whole rationale for the Google decision, and running two map libraries long-term is worse than one migration.
- **D-02:** Use `@vis.gl/react-google-maps` (per STACK research) with a **vector `mapId`** (required for AdvancedMarkerElement + cloud styling). Pin `version: 'quarterly'`.
- **⚠ SCOPE-EXPANSION NOTE (planner must size for this):** This pulls **shipped Phase 4 v1 work** into Phase 7's blast radius. `apps/web/src/components/map/route-map.tsx` (SoC-gradient route polyline, charger markers, hover sync), the map-token-missing banner, and any Mapbox styling must be ported to Google's vector map + AdvancedMarkers. This risks regressing a passing v1 UAT (Phase 4 map tests). Plan a dedicated migration wave + re-verify the Phase 4 map interactions after porting. Reversible via git if reconsidered.
- **D-03:** Write full ingest scripts for **all cataloged sources** (FAF5, Caltrans AADT/GIS, PeMS archive, FHWA parking, FMCSA, BTS port stats, POLB carrier Excel/PDTR, 511 events, drayage.com fallback) into Convex up front, rather than hand-curating 1–2 corridors or bundling static JSON.
- **D-04:** Apply the `data-review-gate` skill (raw review → 0–10 usefulness score → match plan) to EACH source at ingest; the score is an OUTPUT stored on the record, never the catalog's assumed pre-score (DINT-03).
- **D-05:** Every ingested record carries `provenance: {source, fetchedAt, usefulnessScore, matchMethod}` in Convex (DINT-01, SRC-01). Simulated/estimated values labeled distinctly from measured (SRC-04).
- **⚠ TIMELINE-RISK NOTE:** Full multi-source ingest is the heaviest single workstream in the milestone and the most likely place a 5-day demo slips. Planner should wave-parallelize source ingests and treat scraping sources (drayage.com) as ToS-checked fallback only. Live sources (PeMS real-time, 511) remain stretch (DINT-07) — the ingest here is of downloads/archives, not live feeds.
- **D-06:** Build `/pulse` **open inside the app shell** in Phase 7. WorkOS AuthKit (net-new, not yet installed) is deferred to Phase 10 polish so a login/SSO hiccup can't block the BD demo.
- **⚠ TRACEABILITY NOTE:** SHELL-01's "inside the WorkOS auth boundary" clause effectively **moves to Phase 10**. Phase 7 delivers the `/pulse` route + nav tab WITHOUT the auth boundary. Planner/roadmap traceability should reflect that the auth portion of SHELL-01 lands in Phase 10 alongside the WorkOS work.
- **D-07:** Because Convex queries run **unauthenticated** in Phase 7, `userFilters` cannot key on a WorkOS user id yet. Use an anonymous/local (e.g. session-scoped or singleton) filter-state approach until auth lands in Phase 10.
- **D-08:** Build the CAD shell strictly from the design MD: `TechnicalFrame`, `BlueprintGrid` (animated, rendered OFF the GL canvas per architecture research), `SkeuomorphicCard`, JetBrains Mono typography (already loaded via `next/font` in layout.tsx).
- **D-09:** Apply Google vector **cloud-based map styling** (via the Map ID) so default Google styling does not leak through the CAD aesthetic (FLOW-07, mitigates brand-fidelity pitfall).
- **D-10:** Port anchors (POLA, POLB, Port Hueneme, Oakland, SF, San Diego) rendered as `AdvancedMarkerElement`, map framed on the California coast on load, with a port selector in the control panel (FLOW-01/02, SHELL-06).

### Claude's Discretion

Exact Convex table field refinements beyond the research schema, control-panel component composition, and blueprint-grid animation technique (CSS vs canvas) are left to research/planning — the architecture research already proposes a concrete schema and layered-rendering approach to follow.

### Deferred (NOT in Phase 7)

- **Live real-time signals** (PeMS real-time, 511 events, Google Traffic live tint) — DINT-07 / TIME-02, stretch, Phase 10+; Phase 7 ingests downloads/archives only.
- **WorkOS auth boundary + Sentry monitoring** — Phase 10 (D-06). Sentry error-boundary wrapping of the map/engine also lands then.
- **Flow animation, encoding, truck marker** — Phase 8.
- **Hotspots, dimension-callout popups, market sizing, Data Quality Inspector drawer** — Phase 9 (DINT-04/05).

### ⚠ Conflict resolved here

- **Next.js version:** STACK.md recommends Next 15.5.x and warns Next 16 is "too fresh." **Repo is on Next 16.2.9 and stays there.** This research verifies Convex + `@vis.gl/react-google-maps` against Next 16 (see Architecture Patterns). Do NOT downgrade. WorkOS/Sentry verification is deferred to Phase 10 with the auth work.

---

## Summary

Phase 7 lays the substrate for `/pulse`: a strict Technical-Brand-Geometry CAD shell, a Google **vector** base map (`mapId` + cloud styling) framed on the West Coast with port `AdvancedMarker`s, a **provenance-tagged Convex data layer** populated by full multi-source ingest, and an always-visible sources footer. It is additive — a new `/pulse` sibling route — but carries a **mandatory migration blast radius**: the shipped Phase 4 Mapbox map (`route-map.tsx`) is ported to Google in the same phase (D-01), so a passing v1 UAT must be re-verified.

The stack is confirmed installable and current as of 2026-07-06: **Convex 1.42.1**, **@vis.gl/react-google-maps 1.9.0**, **gsap 3.15.0** (+ `@gsap/react` 2.1.2), **@turf/turf 7.3.5** (already vendored), **simplify-js 1.2.4**, **@fontsource/jetbrains-mono 5.2.8** (optional — JetBrains Mono already loads via `next/font`). Convex's only React peer is `react: ^18 || ^19` (optional) — it is **framework-version-agnostic** and works with Next 16.2.9; there is no Next-version peer constraint. `@vis.gl/react-google-maps` peers `react >=16.8 || ^19` and bundles `@googlemaps/js-api-loader ^2.0.2` + `@types/google.maps ^3.64` — React 19.2.7 satisfies it.

Because auth is deferred (D-06/D-07), the Convex provider is the **plain unauthenticated** form: a `'use client'` `ConvexClientProvider` wrapping children in `ConvexProvider` with a module-level `new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)` — **not** `ConvexProviderWithAuth`. `userFilters` becomes a **singleton/session-scoped** row (anonymous key) until Phase 10 rekeys it to a WorkOS subject id.

The biggest risk is the **Mapbox→Google migration regressing Phase 4** while simultaneously standing up net-new Convex + map infra under a demo deadline. Second risk is **data credibility** — the DINT usefulness gate and provenance object must be real (scored from actual bytes, not the catalog's assumed scores) or the "accuracy" stakeholder sinks the demo. Demo-ready data sources are the **downloads** (FAF5, Caltrans AADT GIS, FHWA truck parking ArcGIS, BTS port stats, POLB carrier Excel); **approval/registration/scrape-gated** sources (PeMS real-time, Port Optimizer, drayage.com, 511 live) are stretch-only per the demo-safety rule.

---

## Architectural Responsibility Map

| Requirement | Owner component / artifact | Notes |
|---|---|---|
| SHELL-01 | `app/pulse/page.tsx` (server) → client shell; nav entry in `components/design/app-action-bar.tsx` `NAV_ITEMS` | Route + nav tab ONLY. Auth boundary clause → Phase 10 (D-06). |
| SHELL-02 | `TechnicalFrame` + `BlueprintGrid` (off-GL DOM/canvas layer) | Blueprint = light #EFEFF5 grid per UI-SPEC, NOT dark. |
| SHELL-03 | JetBrains Mono treatment across labels/metrics; `MetadataBlock` | Font already in `layout.tsx` via `next/font/google`. |
| SHELL-04 | Responsive container rules (desktop primary, tablet accordions) | `min-w-[1024px]` already on `<body>`; laptop/large-display target. |
| SHELL-06 | Control panel chrome + port selector (radix `Select` under CAD skin) | Time filter + overlay toggles are P10/P9 slots; P7 ships shell + port selector. |
| SRC-01 / DINT-01 | Convex `provenance` object on every record | `{source, fetchedAt, usefulnessScore, matchMethod}`. |
| SRC-02 | Persistent `SourcesFooter` component | Always-visible, JetBrains Mono, illustrative-data disclaimer. |
| SRC-03 | Convex ingest actions/scripts (`convex/ingest/*`) | Downloads → Convex tables; no live pipeline for demo. |
| SRC-04 | `source` enum discriminating `SIMULATED`/`ESTIMATE` vs measured | Distinct styling reserved (orange `Simulated` badge). |
| DINT-03 | `data-review-gate` per source → stored `usefulnessScore` | Score is an OUTPUT of the rubric on actual bytes, not assumed. |
| FLOW-01 | `PulseMap` (`@vis.gl/react-google-maps` `<Map>` vector + `mapId`) | West-Coast framing on load (CA coast bounds). |
| FLOW-02 | Port `AdvancedMarker`s + port selector | POLA/POLB/HUE/OAK/SF/SD. |
| FLOW-07 | Cloud-based vector map styling via `mapId` | Default Google style must not leak (D-09). |
| (migration) | Port `route-map.tsx` Mapbox→Google | D-01 scope expansion; re-verify Phase 4 MAP-01…03 after. |

---

## Standard Stack

### Core (verified against npm registry 2026-07-06)

| Package | Version (latest) | Purpose | Verified |
|---|---|---|---|
| `next` | 16.2.9 (installed) | App framework, App Router | [VERIFIED: apps/web/package.json] |
| `react` / `react-dom` | 19.2.7 (installed) | UI runtime | [VERIFIED: package.json] |
| `convex` | 1.42.1 | Reactive DB + client + React bindings + codegen | [VERIFIED: registry.npmjs.org/convex/latest → 1.42.1] |
| `@vis.gl/react-google-maps` | 1.9.0 | React wrapper for Google Maps JS API | [VERIFIED: registry → 1.9.0] |
| Google Maps JS API | channel `quarterly` | Vector base map, AdvancedMarkers, cloud styling | [CITED: developers.google.com/maps/documentation/javascript/advanced-markers/overview — Map ID required] |
| `@types/google.maps` | 3.65.2 (peer of visgl, bundled ^3.64) | TS types for `google.maps.*` | [VERIFIED: registry → 3.65.2] |

### Supporting

| Package | Version | Purpose | When |
|---|---|---|---|
| `gsap` | 3.15.0 | Blueprint-grid drift, frame/panel reveals, DrawSVG (all plugins free ≥3.13) | SHELL-02 grid animation + motion tokens |
| `@gsap/react` | 2.1.2 | `useGSAP()` hook for React 19 cleanup-safe timelines | Client components only |
| `@turf/turf` | 7.3.5 (already installed as 7.3.5) | bbox/lineString for West-Coast framing; reused from Mapbox code | FLOW-01 framing; migration helpers already use `bbox` |
| `simplify-js` | 1.2.4 | Douglas-Peucker thinning of dense highway geometry before Convex store | DINT geometry / Convex doc-size guard (Phase 8 mostly; seed in P7) |
| `@fontsource/jetbrains-mono` | 5.2.8 | OPTIONAL self-host (canvas text contexts) | Not needed — `next/font/google` already loads JetBrains Mono |
| `@googlemaps/markerclusterer` | 2.6.2 | Cluster dense markers | NOT needed in P7 (≤6 ports); Phase 9 hotspots |

### Alternatives Considered

| Chosen | Alternative | Why not the alternative |
|---|---|---|
| `@vis.gl/react-google-maps` 1.9 | `@react-google-maps/api` 2.20.x | Community-maintained, React 19/StrictMode double-mount friction, component-only API fights imperative overlay work. [CITED: STACK.md] |
| Plain `ConvexProvider` (unauth) | `ConvexProviderWithAuth` | Auth deferred to P10 (D-06); no WorkOS token exists in P7. |
| CSS/Canvas 2D blueprint grid | Three.js `WebGLBackground` (design MD suggestion) | For a static light #EFEFF5 grid at opacity 0.15–0.25, a CSS `repeating-linear-gradient` (static) or a single 2D `<canvas>` with a GSAP-driven offset (drift) is far lighter and avoids a second WebGL context competing with the map's GL canvas. Three.js is overkill and adds context-loss risk. [ASSUMED: design intent; UI-SPEC calls it "BlueprintGrid (WebGLBackground)" but explicitly permits off-GL DOM/canvas] |
| Google vector `mapId` cloud styling | Inline `styles[]` array on the Map | Inline JSON styles are **ignored** on vector/`mapId` maps — cloud styling via the Map ID is the supported path and is required anyway for AdvancedMarkers. [CITED: developers.google.com/maps/documentation/javascript/advanced-markers/overview] |
| Native migration (port each layer) | deck.gl `GoogleMapsOverlay` now | deck.gl is a Phase 8 scale-up decision (the open flow-rendering fork). P7 needs only base map + ≤6 markers + one migrated route polyline — native `google.maps.Polyline`/`AdvancedMarkerElement` is lighter and dependency-free. [CITED: SUMMARY.md open decision] |

---

## Package Legitimacy Audit

New packages beyond `apps/web/package.json`. Download counts = npm last-month, fetched 2026-07-06.

| Package | Latest | Downloads/mo | Verdict | Disposition |
|---|---|---|---|---|
| `convex` | 1.42.1 | 3,677,297 | ✅ Legitimate — first-party (Convex Inc.), single package ships client+React+codegen | ADD (core) |
| `@vis.gl/react-google-maps` | 1.9.0 | 7,782,691 | ✅ Legitimate — vis.gl/OpenJS + Google-team maintained | ADD (core) |
| `gsap` | 3.15.0 | 15,212,003 | ✅ Legitimate — Webflow-owned, all plugins free ≥3.13 | ADD (supporting) |
| `@gsap/react` | 2.1.2 | 4,206,910 | ✅ Legitimate — official GSAP React adapter | ADD (supporting) |
| `@turf/turf` | 7.3.5 | 5,303,470 | ✅ Legitimate — **already installed at 7.3.5** | KEEP (no change) |
| `simplify-js` | 1.2.4 | 613,909 | ✅ Legitimate — mourner (Leaflet author); stable/low-churn by design | ADD (seed/geometry) |
| `@fontsource/jetbrains-mono` | 5.2.8 | 2,393,573 | ✅ Legitimate — Fontsource org | SKIP — `next/font/google` already covers it; add only if canvas text needs it |
| `@types/google.maps` | 3.65.2 | (DefinitelyTyped) | ✅ Legitimate — bundled as visgl dep (^3.64) | TRANSITIVE (pin dev dep if desired) |
| `@googlemaps/markerclusterer` | 2.6.2 | 13,283,208 | ✅ Legitimate — Google Maps team | DEFER to Phase 9 |

No typosquats, no abandoned/one-download packages. All core additions are 3M+/mo, first-party or foundation-maintained.

---

## Architecture Patterns

### 1. Convex provider for Next 16 App Router — UNAUTHENTICATED (D-06/D-07)

Convex has **no Next-version peer dependency** [VERIFIED: registry convex@1.42.1 peerDependencies = `{react: ^18||^19 (optional), @auth0, @clerk...}`], so Next 16.2.9 is fine. The App Router boundary rule is identical to Next 15: React hooks (`useQuery`/`useMutation`) are client-only, so the provider must be a `'use client'` component imported by the server `layout.tsx`. [CITED: docs.convex.dev/client/react/nextjs — established pattern; live scrape blocked by Firecrawl outage this session, tag confidence HIGH from stable public API]

```tsx
// apps/web/src/app/ConvexClientProvider.tsx
"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

```tsx
// apps/web/src/app/layout.tsx  (server component — unchanged font setup)
import { ConvexClientProvider } from "./ConvexClientProvider";
// ...
<body className={`${inter.className} min-w-[1024px] antialiased`}>
  <ConvexClientProvider>{children}</ConvexClientProvider>
</body>
```

Gotchas / notes:
- Use **plain `ConvexProvider`**, NOT `ConvexProviderWithAuth` — no WorkOS token exists in P7. Swapping to the auth variant is a Phase 10 change touching only this file.
- `NEXT_PUBLIC_CONVEX_URL` must be public (client needs it). Run `npx convex dev` alongside `pnpm dev` for codegen into `convex/_generated`.
- Server components / server actions that need Convex data use `fetchQuery`/`preloadQuery` from `convex/nextjs` — **not** the React hooks. P7's map/panels are all `'use client'` so hooks are correct there.
- Convex client instantiated at **module scope** (once), not per-render, to avoid reconnect storms. [CITED: PITFALLS.md #6 redraw/remount]
- React 19 StrictMode double-mounts in dev are handled by Convex's client; no special guard needed.

**userFilters without a user id (D-07):** key the singleton by a stable anonymous string. Two viable approaches:
- **Singleton row:** `userFilters` with a fixed `filterKey: "anonymous"` (or `"demo"`); all reads/writes target it. Simplest; fine for a single-viewer demo.
- **Session-scoped:** generate a `crypto.randomUUID()` on first client mount, persist to `localStorage`, pass as `filterKey`. Survives reloads, isolates concurrent demo viewers.
Recommend the **session-scoped `localStorage` key** — trivially rekeys to a WorkOS subject id in Phase 10 by swapping the key source. Schema uses `filterKey: v.string()` with `.index("by_key", ["filterKey"])` (rename to `userId` at P10, or keep `filterKey` and store the subject id in it).

### 2. Mapbox → Google migration (D-01) — concrete port

Current `route-map.tsx` uses `react-map-gl/mapbox`: `<Map>` + `<Source>`/`<Layer>` GeoJSON, a `line-gradient` SoC expression, `circle` charger layer, native `<Popup>`, and turf-based hover sync via `onMouseMove`. Target: `@vis.gl/react-google-maps`.

| Mapbox construct | Google / vis.gl replacement | Migration note |
|---|---|---|
| `<Map mapboxAccessToken mapStyle>` | `<APIProvider apiKey>` + `<Map mapId defaultBounds>` | `mapId` (vector) replaces `mapStyle`; cloud styling replaces `light-v11`. |
| `initialViewState` bbox fit | `defaultBounds={{north,south,east,west}}` from turf `bbox` | Reuse existing `bbox(lineString(...))`; convert `[w,s,e,n]` → bounds object. |
| `<Source>`+`<Layer type="line" line-gradient>` (SoC gradient) | `google.maps.Polyline` **segmented by color** OR deck.gl `PathLayer` | ⚠ Google Polyline has **no per-vertex gradient**. For the SoC gradient, split the route into N short polylines each with a solid `strokeColor` sampled from the gradient (LOD-cheap for a single route), or defer smooth gradient to a deck.gl `PathLayer` (`getColor` per-vertex). For P7 re-verify, segmented solid-color polylines preserve the visual. |
| `<Layer type="circle">` charger markers | `AdvancedMarkerElement` (via `useMapsLibrary('marker')`) with sized DOM/SVG content | Legacy `google.maps.Marker` is deprecated (Feb 2024) — use AdvancedMarker; requires `mapId`. Size/color-by-power reproduced with CSS on the marker DOM. |
| `<Popup>` | `InfoWindow` from vis.gl, OR custom `AdvancedMarkerElement` content | Native Google InfoWindow is nearly unstyleable — for CAD fidelity later use custom OverlayView, but a plain InfoWindow is acceptable for the P7 charger popup parity check. |
| `onMouseMove` → turf `nearestPointOnLine` → `setActiveDistanceM` | `map.addListener('mousemove', ...)` → same turf call | Hover-sync logic (the store update) is map-agnostic; only the event plumbing changes. `event.latLng.lat()/lng()`. |
| `MapTokenMissingBanner` (checks `NEXT_PUBLIC_MAPBOX_TOKEN`) | Rename → checks `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (+ `NEXT_PUBLIC_GOOGLE_MAP_ID`) | Keep the graceful "key missing" fallback. |

**Re-verification of Phase 4 (MAP-01/02/03):** after porting, re-run the Phase 4 map UAT — route polyline renders with SoC coloring, charger markers sized/colored by power with working popups, and hover syncs the SoC/energy chart (`activeDistanceM` store still updates). Treat this as an explicit acceptance gate in the migration wave; it is the single most likely regression.

### 3. Blueprint grid off the GL canvas (SHELL-02)

The UI-SPEC names it `BlueprintGrid (WebGLBackground)` but explicitly allows an off-GL DOM/canvas layer. For a **light #EFEFF5** grid at opacity 0.15–0.25 with a slow drift:
- **Static:** CSS `repeating-linear-gradient` (two, at 0°/90°) on a `pointer-events:none; z-index:0` div behind the `TechnicalFrame`. Zero JS, zero GL.
- **Drift (motion token "very slow, sin(time)"):** a single 2D `<canvas>` sized to container (DPR cap 2), grid lines redrawn with a GSAP-driven offset; **pause on `visibilitychange`** (hidden tab) to save battery.
- Do **NOT** use Three.js/WebGL — a second GL context competes with the map's WebGL2 canvas and risks context-loss. The grid sits *behind/around* the framed map, never on it. [CITED: ARCHITECTURE.md layered rendering; PITFALLS.md #4]

### 4. Component structure (P7 scope)

```
apps/web/src/
  app/
    ConvexClientProvider.tsx        # 'use client', plain ConvexProvider  [NEW]
    layout.tsx                      # wrap children in provider           [EDIT]
    pulse/
      page.tsx                      # server: renders <PulseSurface/>     [NEW]
  components/
    pulse/
      pulse-surface.tsx             # 'use client' shell orchestrator     [NEW]
      pulse-map.tsx                 # APIProvider + Map(vector,mapId)      [NEW]
      port-anchors.tsx              # AdvancedMarker per port              [NEW]
      control-panel.tsx             # port selector (radix Select/CAD)     [NEW]
      sources-footer.tsx            # SRC-02 persistent footer             [NEW]
      provenance-badge.tsx          # {SOURCE}·{year}·usefulness n/10      [NEW]
      data-quality-drawer.tsx       # collapsed shell only (radix Collapsible) [NEW]
    design/                         # shared CAD primitives
      technical-frame.tsx           # rounded-3xl, layered shadow, brackets [NEW]
      blueprint-grid.tsx            # off-GL CSS/canvas grid               [NEW]
      skeuomorphic-card.tsx         # gradient border + inner shadow       [NEW]
      metadata-block.tsx            # abs corner JetBrains Mono labels     [NEW]
      app-action-bar.tsx            # add {href:'/pulse',label:'Freight Pulse'} [EDIT]
    map/
      route-map.tsx                 # PORT Mapbox→Google (D-01)            [EDIT/REWRITE]
      map-token-missing-banner.tsx  # rename token check to Google key     [EDIT]
convex/
  schema.ts                         # 6 tables + provenance                [NEW]
  ports.ts / flows.ts / ...         # queries                             [NEW]
  ingest/*.ts                       # per-source ingest actions (D-03)     [NEW]
```

The `/pulse` nav tab is added to `NAV_ITEMS` in `app-action-bar.tsx` (the existing nav list — verified location). Radix `Select`/`Collapsible`/`Slider` are already installed and skinned under the CAD library per UI-SPEC Registry Safety.

---

## Data Source Catalog

Per-source access verified 2026-07-06. Note: several federal portals (`bts.gov`, `pdtr.cleanairactionplan.org`) return **HTTP 403 to `curl -I`** due to Akamai bot protection — this is NOT a dead endpoint; they resolve in a browser. Flagged where relevant.

| # | Source | Real URL | Format | Auth / lead-time | Demo-ready? |
|---|---|---|---|---|---|
| 1 | **FAF5** (BTS/FHWA Freight Analysis Framework) | `https://faf.ornl.gov/faf5/` (ORNL data-extraction tool + downloadable CSV/zip); landing `https://www.bts.gov/faf` | CSV / zip (OD tonnage & value by region, commodity, mode; 2017–2022 + 2050 forecast) | None — direct download | ✅ **DEMO-READY** [VERIFIED: `curl -I faf.ornl.gov/faf5/` → HTTP 200; `www.bts.gov/faf` 403 = Akamai bot-block, live in browser] |
| 2 | **Caltrans AADT / Traffic Census** | Portal `https://dot.ca.gov/programs/traffic-operations/census`; GIS `https://gisdata-caltrans.opendata.arcgis.com/` (Traffic Volumes AADT dataset) | ArcGIS Feature Service / GeoJSON / shapefile; includes truck AADT % | None on open-data portal | ✅ **DEMO-READY** [VERIFIED: census page HTTP 200; opendata portal & AADT dataset page HTTP 200] |
| 3 | **Caltrans PeMS** (archive + real-time) | `https://pems.dot.ca.gov/` | Web export / bulk archive (detector volumes/speeds) | **Free account, approval ~1–2 days** | ⚠ **STRETCH** — archive download is possible but account-gated; real-time is DINT-07. Do NOT gate demo on it. [VERIFIED: HTTP 200; account requirement per catalog] |
| 4 | **FHWA Truck Parking** (Jason's Law survey / truck stop parking) | ArcGIS: `https://geo.dot.gov/server/rest/services` (USDOT BTS/FHWA ArcGIS); public feature services under `services.arcgis.com/.../arcgis/rest/services` | ArcGIS Feature Service / shapefile (parking site points, 2019 authoritative) | None — public feature service | ✅ **DEMO-READY** [VERIFIED: `geo.dot.gov/server/rest/services` HTTP 200; arcgis services host HTTP 200] |
| 5 | **FMCSA SAFER / Company Snapshot** | `https://safer.fmcsa.dot.gov/CompanySnapshot.aspx`; bulk `https://mobile.fmcsa.dot.gov/QCDevsite/docs/apiRegistration` (webkey) | HTML query snapshot; QC API (webkey) for structured | Public query; webkey for API | ⚠ **STRETCH for bulk** — on-click carrier lookup / HQ validation is fine; bulk needs webkey. Not on critical path. [VERIFIED: SAFER HTTP 200] |
| 6 | **BTS Port Performance / Freight Statistics** | `https://www.bts.gov/browse-statistical-products-and-data/port-performance/...` and `https://data.bts.gov/` | CSV / dashboards (throughput baseline) | None — direct download | ✅ **DEMO-READY** [CITED: catalog; `www.bts.gov` returns 403 to curl = Akamai bot-block, resolves in browser — treat as live] |
| 7 | **POLB Authorized Carriers** (Excel) + PDTR | Monthly Excel from POLB; PDTR `https://pdtr.cleanairactionplan.org/` | XLSX list → parse → geocode HQs | None (public monthly file) | ✅ **DEMO-READY** (parse+geocode offline) [CITED: catalog; `pdtr.cleanairactionplan.org` 403 to curl = bot-block] |
| 8 | **511.org** (CA events) | `https://511.org/developers/list/apis/` | Events REST API (JSON) | **Free API key** | ⚠ **STRETCH** — live layer only (DINT-07); not P7. [VERIFIED: HTTP 303 redirect to API list = live] |
| 9 | **POLA/POLB Port Optimizer** | `https://portoptimizer.com/` | Portal / daily CSV export | **Registration (free) required** | ⚠ **STRETCH** — registration-gated real-time; daily CSV fallback. Not P7. [CITED: catalog] |
| 10 | **drayage.com directory** | `https://www.drayage.com/` | Scrape-only carrier list | Public web — **ToS check required** | ⚠ **STRETCH / FALLBACK ONLY** — verify ToS before scraping; prefer official sources (POLB Excel #7). [CITED: catalog + D-03] |

**Demo-safe core (download-now, no gate):** FAF5 (#1), Caltrans AADT GIS (#2), FHWA truck parking ArcGIS (#4), BTS port stats (#6), POLB carrier Excel (#7). These five ground the P7 seed. **Approval/registration/scrape-gated → `[stretch]`:** PeMS (#3), FMCSA bulk (#5), 511 (#8), Port Optimizer (#9), drayage.com (#10) — per the `data-review-gate` demo-safety rule and D-03's "treat scraping as ToS-checked fallback."

**DINT-03 gate per source:** for each ingested source, run the `data-review-gate` (raw ~100-row review → 0–10 usefulness score on the actual bytes → match plan) and store the resulting `usefulnessScore` on every record. Never persist the catalog's *asserted* score — it is a hypothesis to verify.

---

## Convex Data Model

Refined from ARCHITECTURE.md for P7's six tables, with the DINT-01 `provenance` object attached to every record and D-07 anonymous `userFilters`.

```ts
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Reusable provenance validator (DINT-01 / SRC-01) — on EVERY data record.
const provenance = v.object({
  source: v.union(                       // discriminates measured vs simulated (SRC-04)
    v.literal("FAF5"), v.literal("Caltrans_AADT"), v.literal("Caltrans_PeMS"),
    v.literal("FHWA_Parking"), v.literal("FMCSA"), v.literal("BTS_Port"),
    v.literal("POLB_Carriers"), v.literal("SIMULATED"), v.literal("ESTIMATE"),
  ),
  year: v.optional(v.number()),          // dataset vintage
  fetchedAt: v.number(),                 // epoch ms of ingest
  usefulnessScore: v.number(),           // 0–10, OUTPUT of data-review-gate (DINT-03)
  matchMethod: v.string(),               // e.g. "FAF_region_join", "geocoded", "manual"
});

export default defineSchema({
  ports: defineTable({
    name: v.string(),
    code: v.string(),                    // POLA/POLB/HUE/OAK/SF/SD
    location: v.object({ lat: v.number(), lng: v.number() }),
    annualTEU: v.optional(v.number()),
    metrics: v.optional(v.any()),
    provenance,
  }).index("by_code", ["code"]),

  highwaySegments: defineTable({
    segmentId: v.string(),               // Caltrans/FAF route id
    route: v.string(),                   // "I-710","I-110","I-5","US-101"
    path: v.array(v.object({ lat: v.number(), lng: v.number() })), // simplify-js thinned
    aadt: v.optional(v.number()),
    truckAADT: v.optional(v.number()),   // keep truck % distinct (FAF vs PeMS non-conflation)
    bbox: v.object({ minLat: v.number(), minLng: v.number(),
                     maxLat: v.number(), maxLng: v.number() }),
    provenance,
  }).index("by_route", ["route"]).index("by_segmentId", ["segmentId"]),

  freightFlows: defineTable({
    segmentId: v.string(),               // FK → highwaySegments.segmentId
    periodStart: v.number(),
    periodEnd: v.number(),
    granularity: v.union(v.literal("year"), v.literal("month"), v.literal("hour")),
    tons: v.optional(v.number()),        // FAF annual tonnage (explicit unit)
    volume: v.number(),                  // normalized → width (Phase 8)
    congestion: v.number(),              // 0..1 → R/Y/G (Phase 8)
    provenance,
  }).index("by_segment_period", ["segmentId", "periodStart"])
    .index("by_period", ["periodStart"]),

  hotspots: defineTable({                // seeded in P7, rendered P9
    kind: v.union(v.literal("parking"), v.literal("congestion"),
                  v.literal("truckingHQ"), v.literal("solarCharger")),
    location: v.object({ lat: v.number(), lng: v.number() }),
    title: v.string(),
    dimensions: v.array(v.object({ label: v.string(), value: v.string() })),
    meta: v.optional(v.any()),
    provenance,
  }).index("by_kind", ["kind"]),

  marketSizing: defineTable({            // seeded in P7, rendered P9
    tier: v.union(v.literal("TAM"), v.literal("SAM"), v.literal("SOM")),
    regionPolygon: v.array(v.object({ lat: v.number(), lng: v.number() })),
    valueUSD: v.number(),
    label: v.string(),
    provenance,                          // source: "ESTIMATE" — never presented as measured
  }).index("by_tier", ["tier"]),

  userFilters: defineTable({             // D-07: anonymous, NOT WorkOS-keyed in P7
    filterKey: v.string(),               // localStorage UUID or "anonymous" singleton
    timeMode: v.union(v.literal("5yr"), v.literal("1yr"), v.literal("live")),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    overlays: v.object({ tam: v.boolean(), sam: v.boolean(), som: v.boolean() }),
    selectedPort: v.optional(v.string()),   // P7 port selector state
    selectedFlowPath: v.optional(v.string()),
  }).index("by_key", ["filterKey"]),        // rename/rekey to WorkOS subject id in P10
});
```

Notes:
- `provenance` is a **shared validator reused on every table** — enforces DINT-01/SRC-01 at the type level; you cannot insert a record without it.
- Keep FAF (annual tons) and PeMS (sensor counts/speeds) in **separate fields with explicit units** — never blend into one scalar (PITFALLS.md #7). `truckAADT` kept distinct from `aadt`.
- Geometry stored as **simplify-js-thinned** lat/lng arrays, split per-corridor, to stay well under Convex's ~1 MB document / read ceilings (PITFALLS.md #11).
- `marketSizing.provenance.source = "ESTIMATE"` always — figures are estimates with a methodology basis, never measured (PITFALLS.md #9).

---

## Don't Hand-Roll

- **Bounds/geometry math** → `@turf/turf` (already vendored): `bbox`, `lineString`, `nearestPointOnLine` (reuse from `route-map.tsx`). Don't compute West-Coast framing manually.
- **Polyline simplification** → `simplify-js` (Douglas-Peucker). Don't write your own thinning.
- **Marker rendering** → `AdvancedMarkerElement` via `useMapsLibrary('marker')`. Don't use deprecated `google.maps.Marker`; don't hand-roll OverlayView for simple markers.
- **Map styling** → Google **cloud-based styling** via `mapId`. Don't ship an inline `styles[]` array (ignored on vector maps) or restyle by CSS-hacking the canvas.
- **Reactive data + filter state** → Convex `useQuery`/`useMutation`. Don't build SSE/polling; don't put filter state in a bespoke store when Convex reactivity is free.
- **Animation lifecycle** → `@gsap/react` `useGSAP()` (auto cleanup). Don't manually manage `gsap.context()`/`cancelAnimationFrame` teardown by hand.
- **Font loading** → existing `next/font/google` JetBrains Mono. Don't add `@fontsource` unless a canvas text context needs it.
- **CAD primitives** → author in-repo from the design MD (TechnicalFrame/BlueprintGrid/etc.). Don't pull a third-party registry (UI-SPEC Registry Safety).

---

## Common Pitfalls

1. **AdvancedMarker / mapId not provisioned day 1** → vector map + AdvancedMarkers **won't render at all** without a valid vector `mapId`. Provision `NEXT_PUBLIC_GOOGLE_MAP_ID` + cloud style before any marker code. [CITED: PITFALLS.md #2, Google Advanced Markers docs]
2. **Inline map styles ignored on vector maps** → all CAD styling MUST go through the cloud Map ID; an inline `styles[]` silently no-ops. Verify the style is attached to the ID used (D-09).
3. **Google Polyline has no per-vertex gradient** → the Phase 4 SoC gradient can't port 1:1. Use segmented solid-color polylines (or deck.gl PathLayer later). Plan for this in the migration wave or the SoC visual regresses.
4. **Convex hook in a Server Component** → `useQuery` throws. Provider is `'use client'`; all consumers `'use client'`; server reads use `fetchQuery`/`preloadQuery`. [CITED: PITFALLS.md #10]
5. **Convex client re-instantiated per render** → reconnect storms/flicker. Instantiate `ConvexReactClient` at module scope once.
6. **Map remount on filter change** → keep the `<Map>` mounted; drive changes by data/props, not remount; debounce. [CITED: PITFALLS.md #6]
7. **Migration regresses Phase 4** (D-01 blast radius) → the single biggest risk. Dedicate a migration wave and re-run MAP-01/02/03 UAT after porting `route-map.tsx`. Keep the change git-reversible.
8. **Data-provenance credibility** → the stakeholder demanded accuracy. `usefulnessScore` MUST be the rubric's output on real bytes (DINT-03), not the catalog's assumed number; every rendered quantity carries `source`+`year`; simulated ≠ measured styling (SRC-04); sources footer always visible (SRC-02). A single unsourced number sinks trust.
9. **Blueprint grid on a second GL context** → don't use Three.js; render the light grid as off-GL CSS/canvas or it fights the map's WebGL2 canvas / risks context loss.
10. **Google attribution/logo can't be removed** → reserve layout space in the `TechnicalFrame` so the required Google logo + ToS text doesn't look broken against the CAD frame. [CITED: PITFALLS.md #15]
11. **BTS/PDTR 403 to curl** → these are Akamai bot-blocks, not outages; download in a browser / with a UA header during ingest. Don't mark them dead.

---

## Validation Architecture (Nyquist)

Testable signals that must pass before Phase 7 is "done":

| Signal | How to test | Requirement |
|---|---|---|
| Vector map renders with mapId | `/pulse` loads a Google vector map framed on CA coast; no "map failed"; cloud CAD style applied (default POIs stripped) | FLOW-01, FLOW-07 |
| Port anchors present & selectable | 6 `AdvancedMarker`s (POLA/POLB/HUE/OAK/SF/SD) visible; port selector focuses/frames a port | FLOW-02, SHELL-06 |
| Convex query round-trips | A seeded `ports`/`freightFlows` `useQuery` returns data reactively in the client; changing `userFilters` re-fires the query | SRC-03, D-07 |
| Provenance on every record | Assert in ingest tests: no `ports`/`highwaySegments`/`freightFlows`/`hotspots`/`marketSizing` row lacks a fully-populated `provenance{source,fetchedAt,usefulnessScore,matchMethod}` | DINT-01, SRC-01 |
| usefulnessScore is real | Per-source `data-review-gate` notebook exists; stored score matches the rubric output, not the catalog's asserted value | DINT-03 |
| Simulated ≠ measured | A record with `source:"SIMULATED"`/`"ESTIMATE"` renders with the distinct (orange) badge/label, never as measured | SRC-04 |
| Sources footer visible | `SourcesFooter` present and always-visible on `/pulse`, cites FAF5/Caltrans/FHWA/FMCSA/ports + illustrative-data disclaimer | SRC-02 |
| CAD shell fidelity | `TechnicalFrame` (rounded-3xl, layered shadow, L-brackets), light #EFEFF5 `BlueprintGrid` off-GL, JetBrains Mono labels — matches UI-SPEC tokens | SHELL-02, SHELL-03 |
| Responsive | Desktop full frame; tablet collapses control panel to accordion; laptop demo target intact | SHELL-04 |
| **Phase 4 map still works** | Re-run Phase 4 MAP-01/02/03 UAT after Mapbox→Google port: SoC route polyline, charger markers+popups, hover→chart sync all functional | D-01 regression gate |

Signals are behavioral (render/query/assert), not implementation-coupled — they hold regardless of CSS-vs-canvas grid choice or segmented-vs-deck.gl polyline choice.

---

## Sources

- **npm registry** `registry.npmjs.org/<pkg>/latest` + `api.npmjs.org/downloads/point/last-month/<pkg>` — live versions & download counts, fetched 2026-07-06 — [VERIFIED] — HIGH (convex 1.42.1/3.68M, @vis.gl/react-google-maps 1.9.0/7.78M, gsap 3.15.0/15.2M, @gsap/react 2.1.2/4.21M, @turf/turf 7.3.5/5.30M, simplify-js 1.2.4/0.61M, @fontsource/jetbrains-mono 5.2.8/2.39M, @googlemaps/markerclusterer 2.6.2/13.3M, @types/google.maps 3.65.2)
- **npm registry** convex@1.42.1 & @vis.gl/react-google-maps@1.9.0 peerDependencies — [VERIFIED] — HIGH (convex peer react ^18||^19 optional, NO next constraint; visgl peer react >=16.8||^19, bundles js-api-loader ^2.0.2 + @types/google.maps ^3.64)
- **apps/web/package.json** — installed Next 16.2.9, React 19.2.7, Tailwind 4.3.2, @turf/turf 7.3.5, mapbox-gl 3.25.0, react-map-gl 8.1.1 — [VERIFIED: file read]
- **apps/web/src/components/map/route-map.tsx** — current Mapbox implementation (line-gradient SoC, circle chargers, turf hover sync, Popup) — [VERIFIED: file read]
- **apps/web/src/components/design/app-action-bar.tsx** — nav `NAV_ITEMS` location for `/pulse` tab — [VERIFIED: file read]
- **Google Maps Platform — Advanced Markers overview** developers.google.com/maps/documentation/javascript/advanced-markers/overview — Map ID required; vector rendering; inline styles superseded by cloud styling — [CITED] — HIGH (curl 200, content confirms Map ID requirement)
- **Data endpoint liveness** (curl -I, 2026-07-06): faf.ornl.gov/faf5/ → 200 [VERIFIED]; dot.ca.gov/.../census → 200 [VERIFIED]; gisdata-caltrans.opendata.arcgis.com → 200 [VERIFIED]; pems.dot.ca.gov → 200 [VERIFIED]; geo.dot.gov/server/rest/services → 200 [VERIFIED]; safer.fmcsa.dot.gov/CompanySnapshot.aspx → 200 [VERIFIED]; 511.org/developers → 303 [VERIFIED]; www.bts.gov/faf & pdtr.cleanairactionplan.org → 403 Akamai bot-block, live in browser [CITED, MEDIUM]
- **data-review-gate skill** + `references/ca-freight-source-catalog.md` — source catalog, access notes, demo-safety rule, 0–10 rubric — [CITED] — HIGH
- **Convex Next.js App Router integration** docs.convex.dev/client/react/nextjs — `'use client'` ConvexProvider, ConvexReactClient, NEXT_PUBLIC_CONVEX_URL, fetchQuery/preloadQuery server-side — [CITED] — HIGH from stable public API (live scrape blocked by Firecrawl auth outage this session; pattern is version-stable and corroborated by PITFALLS.md #10)
- **.planning/research/{STACK,ARCHITECTURE,PITFALLS,SUMMARY}.md** — milestone research (schema baseline, layered rendering, pitfalls, open flow-render fork) — [CITED] — HIGH
- **07-CONTEXT.md / 07-UI-SPEC.md** — locked decisions + approved UI contract/tokens — [VERIFIED: file read] — HIGH

**Confidence:** HIGH on stack/versions/provider pattern/map migration; MEDIUM-HIGH on data endpoints (5 verified 200; BTS/PDTR bot-blocked but well-known; PeMS/511/Port Optimizer correctly classified stretch). Firecrawl web tooling was down — compensated via direct curl + npm registry + verified local files.

---
*Phase 7 research — Foundation: Shell, Data Contract & Map Base*
*Researched: 2026-07-06*
