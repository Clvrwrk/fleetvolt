# Architecture Research

**Domain:** Animated Google-Maps freight-flow overlay on Next.js 15 + Convex
**Researched:** 2026-07-06
**Confidence:** HIGH

## Architecture Overview

The `/pulse` surface is a **parallel, self-contained visualization stack** that shares only the existing FleetVolt app shell (nav, layout, WorkOS auth boundary, Sentry, Tailwind/Shadcn theme). It does **not** touch the existing Docker/PostGIS/Valhalla/FastAPI simulation backend. Instead, precomputed freight datasets (BTS/FAF flows, Caltrans AADT/GIS, PeMS traffic, FHWA parking, FMCSA HQs, port stats) are ingested into **Convex**, which serves them to the browser via reactive queries and stores user filter state. The map itself is a single `google.maps.Map` in **Vector rendering mode** (a `mapId` with vector tiles is mandatory for WebGL overlays), and every piece of bespoke visual content is layered on top of it rather than fighting the base map.

The rendering strategy is deliberately layered: (1) an HTML/CSS/GSAP **blueprint grid** sits *behind/around* the map frame (not on the GL canvas) to avoid GL contention; (2) freight polylines, the animated truck, and flow "pulse" effects are drawn through a **single deck.gl `GoogleMapsOverlay`** (which internally implements `WebGLOverlayView` in interleaved mode, sharing the map's WebGL2 context) so that hundreds of segments render in one GPU draw call instead of hundreds of DOM `Polyline` objects; (3) hotspot markers and InfoWindows use native `AdvancedMarkerElement` + React-portalled `DimensionCallout` content; (4) last-mile routes use the Directions API rendered as lightweight overlay geometry. A single animation clock drives color/width/pulse and the moving marker by pushing new `layers` into the deck overlay via `setProps`, keeping React out of the hot path.

## Major Components

1. **FreightPulseTab** — Nav entry + route segment (`app/(app)/pulse/page.tsx` server component that renders the client shell). *New.*
2. **PulseMap** — Client component (`'use client'`) that mounts the Google Map via `@vis.gl/react-google-maps` `APIProvider`/`Map` (Vector mode + `mapId`), owns the map instance, and hosts all overlay children. *New.*
3. **VolumeFlowEngine** — Core engine that takes Convex freight-flow records + highway geometry, maps volume→color (R/Y/G) and volume→width, builds deck.gl `PathLayer`/`TripsLayer` layer configs, and runs the animation clock. Exposes the moving Class-8 truck marker along a chosen flow path. *New.*
4. **HotspotLayer** — Renders clickable `AdvancedMarkerElement` hotspots (queue/parking, congestion, HQ proximity, solar-charger recs) and mounts `DimensionCallout` InfoWindows on click. *New.*
5. **MarketSizingPanel** — Shadcn panel with TAM/SAM/SOM overlay toggles that add/remove tinted region layers + display sizing figures. *New.*
6. **TimeFilterBar** — Date/time filter (5yr / 1yr / **Live** sim). Writes selection to Convex user-filter state; drives which flow dataset the engine loads and switches the engine into live-simulation mode. *New.*
7. **BlueprintGrid** — Animated CSS/SVG blueprint grid background rendered *outside* the GL canvas, animated with GSAP. *New (shared).*
8. **TechnicalFrame** — Skeuomorphic bezel/frame wrapping the map + panels (blueprint aesthetic). *New (shared).*
9. **DimensionCallout** — Reusable callout/InfoWindow content component (labeled measurement style). *New (shared).*
10. **SkeuomorphicCard** — Shared card primitive for panels/callouts. *New (shared).*
11. **App shell / nav** — Existing layout gets one new nav tab + route registration under the auth boundary. *Modifies existing.*
12. **Convex client provider** — `ConvexProviderWithAuth` wired to WorkOS in root providers (if not already present for other surfaces). *New or modifies existing.*

## Data Flow

```
[Ingestion (offline)]  BTS/FAF, Caltrans GIS/AADT, PeMS, FHWA, FMCSA, port stats
      │  (Convex actions / scheduled import scripts, one-time + periodic)
      ▼
[Convex tables]  ports · highwaySegments(geometry) · freightFlows(byDateRange)
                 · hotspots · marketSizing · userFilters
      │  reactive useQuery (real-time)
      ▼
[PulseMap (client)]  reads userFilters + selected freightFlows + highwaySegments
      │
      ├─► VolumeFlowEngine: join flows→segment geometry → {path, color, width, ts}
      │        │  build deck.gl layer configs
      │        ▼
      │   [deck.gl GoogleMapsOverlay (interleaved WebGLOverlayView)]
      │        │  one requestAnimationFrame clock advances t → setProps({layers})
      │        ▼  PathLayer (static geometry) + TripsLayer (pulse/flow anim) + truck IconLayer
      │   Google Map Vector canvas (shared WebGL2 context)
      │
      ├─► HotspotLayer: AdvancedMarkerElement + DimensionCallout InfoWindow on click
      ├─► MarketSizingPanel: toggles add/remove TAM/SAM/SOM PolygonLayers
      └─► TimeFilterBar: onChange → Convex mutation(userFilters) → re-query flows
```

**Request/render:** Server component renders the auth-guarded shell; the client `PulseMap` boots the map and Convex reactive queries. Changing a filter is a Convex mutation → all subscribed queries re-fire → engine rebuilds layer data.

**Animation:** A single `requestAnimationFrame` loop (managed by VolumeFlowEngine) advances a normalized time `t`. For **static** styling (color/width from volume) layers are computed once per data change. For **pulse + moving truck**, deck.gl `TripsLayer`/`currentTime` and an `IconLayer` position are updated each frame via `overlay.setProps({layers})` — this mutates GPU uniforms/attributes without React re-renders. GSAP is reserved for **DOM chrome** (BlueprintGrid, callout entrances, panel transitions), not per-frame map geometry.

## Convex Data Model

```ts
// convex/schema.ts (defineSchema / defineTable + validators + indexes)

ports: defineTable({
  name: v.string(),
  code: v.string(),
  location: v.object({ lat: v.number(), lng: v.number() }),
  annualTEU: v.optional(v.number()),
  metrics: v.optional(v.any()),      // throughput/dwell stats
}).index("by_code", ["code"]),

highwaySegments: defineTable({
  segmentId: v.string(),             // Caltrans/FAF route id
  route: v.string(),                 // e.g. "I-5", "SR-99"
  path: v.array(v.object({ lat: v.number(), lng: v.number() })), // encoded/decoded polyline
  aadt: v.optional(v.number()),      // Caltrans annual avg daily traffic
  bbox: v.object({ minLat: v.number(), minLng: v.number(),
                   maxLat: v.number(), maxLng: v.number() }),
}).index("by_route", ["route"])
  .index("by_segmentId", ["segmentId"]),

freightFlows: defineTable({
  segmentId: v.string(),             // FK → highwaySegments.segmentId
  periodStart: v.number(),           // epoch; supports 5yr/1yr slicing
  periodEnd: v.number(),
  granularity: v.union(v.literal("year"), v.literal("month"),
                       v.literal("hour")),   // hour used for Live sim
  tons: v.optional(v.number()),
  volume: v.number(),                // normalized flow used for width
  congestion: v.number(),            // 0..1 → R/Y/G color
  source: v.string(),                // "FAF" | "PeMS" | ...
}).index("by_segment_period", ["segmentId", "periodStart"])
  .index("by_period", ["periodStart"]),

hotspots: defineTable({
  kind: v.union(v.literal("parking"), v.literal("congestion"),
                v.literal("truckingHQ"), v.literal("solarCharger")),
  location: v.object({ lat: v.number(), lng: v.number() }),
  title: v.string(),
  dimensions: v.array(v.object({ label: v.string(), value: v.string() })), // DimensionCallout rows
  meta: v.optional(v.any()),         // FHWA/FMCSA raw fields
}).index("by_kind", ["kind"]),

marketSizing: defineTable({
  tier: v.union(v.literal("TAM"), v.literal("SAM"), v.literal("SOM")),
  regionPolygon: v.array(v.object({ lat: v.number(), lng: v.number() })),
  valueUSD: v.number(),
  label: v.string(),
}).index("by_tier", ["tier"]),

userFilters: defineTable({
  userId: v.string(),                // WorkOS subject id
  timeMode: v.union(v.literal("5yr"), v.literal("1yr"), v.literal("live")),
  periodStart: v.optional(v.number()),
  periodEnd: v.optional(v.number()),
  overlays: v.object({ tam: v.boolean(), sam: v.boolean(), som: v.boolean() }),
  selectedFlowPath: v.optional(v.string()), // truck animation route
}).index("by_user", ["userId"]),
```

Notes: geometry stored as decoded lat/lng arrays (deck.gl consumes `[lng,lat]`); large `freightFlows` reads use **paginated queries** (`paginationOpts`) and are scoped by the `by_segment_period` index so the client only pulls the active window. Live-mode `hour`-granularity rows enable the simulated ticker.

## Integration Points (with existing app)

- **Nav tab:** add "Freight Pulse" entry to the existing shared nav/sidebar → `FreightPulseTab` links to `/pulse`.
- **Layout & theme:** route lives under the existing `(app)` group so it inherits header/footer, Tailwind config, and Shadcn tokens. `TechnicalFrame`/`SkeuomorphicCard` extend the existing design system.
- **Auth boundary:** `/pulse` sits inside the existing WorkOS-protected segment; Convex queries authenticate via `ConvexProviderWithAuth` using the WorkOS token. `userFilters` keyed by WorkOS user id.
- **Convex:** new tables/functions added to the same Convex deployment; no dependency on PostGIS/Valhalla/FastAPI. Ingestion runs as Convex actions/scripts, fully separate from the sim backend.
- **Sentry:** wrap `PulseMap`/engine in the existing Sentry error boundary; report WebGL context-loss events.
- **Env:** add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `NEXT_PUBLIC_GOOGLE_MAP_ID` (vector map) to Vercel.

## Suggested Build Order

1. **Scaffold & shell** — Add `/pulse` route under auth group, nav tab (`FreightPulseTab`), `TechnicalFrame`/`SkeuomorphicCard`/`BlueprintGrid` shared shell (static).
2. **Convex schema + seed** — Define all tables/indexes; write ingestion actions for one route (e.g. I-5 corridor) with sample FAF/Caltrans data.
3. **PulseMap base** — Mount Google Vector Map via `@vis.gl/react-google-maps` with `mapId`; confirm pan/zoom.
4. **Static VolumeFlowEngine** — deck.gl `GoogleMapsOverlay` + `PathLayer`; join `freightFlows`→`highwaySegments`, map volume→width and congestion→R/Y/G. No animation yet.
5. **Animation layer** — Add `requestAnimationFrame` clock + `TripsLayer` pulse + `IconLayer` Class-8 truck along `selectedFlowPath`.
6. **HotspotLayer + DimensionCallout** — AdvancedMarkers + click InfoWindows from `hotspots`.
7. **TimeFilterBar + userFilters** — 5yr/1yr toggles → Convex mutation → reactive re-query; wire period slicing.
8. **MarketSizingPanel** — TAM/SAM/SOM PolygonLayer toggles + figures.
9. **Live simulation mode** — hour-granularity ticker driving the engine clock from historical + traffic data; last-mile Directions routes.
10. **Polish & perf** — GSAP chrome animation, Sentry context-loss handling, viewport-culling/pagination tuning, load testing with full dataset.

## Performance Considerations

- **One overlay, not N polylines.** Rendering hundreds of highway segments as native `google.maps.Polyline`/marker DOM objects will thrash the main thread. Use a **single deck.gl `GoogleMapsOverlay`** (`PathLayer`/`TripsLayer`) — all segments in one GPU draw call. Keep `interleaved: true` on a Vector map to share the WebGL2 context (avoids a second stacked canvas and z-index/DPI issues).
- **Keep React out of the frame loop.** Advance animation with a single `requestAnimationFrame` clock and push updates via `overlay.setProps({layers})` / `TripsLayer.currentTime`; never call React `setState` per frame. Memoize layer factories; only rebuild layer data when Convex data or filters change.
- **Data windowing.** Query only the active time window via the `by_segment_period` index; paginate large `freightFlows` pulls. Optionally viewport-cull segments using `bbox` so off-screen geometry isn't uploaded.
- **Blueprint grid off the GL canvas.** Animate `BlueprintGrid` with GSAP/CSS as a DOM/SVG layer behind the map frame so it never competes with the map's WebGL render loop.
- **WebGL context loss.** Implement `onContextLost`/`onContextRestored` (deck handles most of this) and reset GL state after custom draws (`renderer.resetState()` pattern) to prevent map/overlay render conflicts.
- **Marker count.** Use `AdvancedMarkerElement` (lighter than legacy `Marker`) for hotspots; cluster if counts grow. Debounce InfoWindow content mounting.
- **Directions API.** Fetch last-mile routes on demand and cache in Convex; avoid per-frame or per-pan requests (quota + latency).

## Sources

- Google Maps JS API — WebGL Overlay View (lifecycle: onAdd/onContextRestored/onDraw/onStateUpdate/onRemove, coordinateTransformer, resetState) — developers.google.com/maps/documentation/javascript/webgl — **HIGH**
- deck.gl — `GoogleMapsOverlay` (implements OverlayView/WebGLOverlayView; `interleaved` shared WebGL2 context; `setProps`; React `@vis.gl/react-google-maps` pattern) — deck.gl/docs/api-reference/google-maps — **HIGH**
- Convex — schemas/`defineTable`/validators, secondary `.index()`, reactive `useQuery`, pagination (`paginationOpts`) — docs.convex.dev (schemas, indexes, pagination) — **HIGH** (established API knowledge; live scrape blocked by tooling auth)
- deck.gl `TripsLayer`/`PathLayer`/`IconLayer` animation pattern (currentTime-driven flow) — deck.gl layer docs — **MEDIUM**
- Data sources (FAF/BTS, Caltrans GIS/AADT + PeMS, FHWA truck parking, FMCSA, port stats) — public agency portals — **MEDIUM** (existence/fields confirmed from prior domain knowledge; exact endpoints to verify at ingestion time)

---
*Architecture research for: Freight Pulse overlay*
*Researched: 2026-07-06*
