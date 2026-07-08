# Phase 17 PATTERNS — Role-Based Map Workbench

## Purpose

Phase 17 should convert the current dashboard/card-first product into a role-based, full-viewport map workbench. This document maps existing reusable FleetVolt patterns, integration seams, anti-patterns to avoid, and likely files to modify/create.

Source context: `CONTEXT.md` in this phase directory.

---

## High-Level Existing Shape

### Current UX model

- Authenticated pages render inside `AppShell` with fixed left sidebar + sticky top bar:
  - `apps/web/src/components/nav/app-shell.tsx`
  - `apps/web/src/components/nav/sidebar.tsx`
  - `apps/web/src/components/nav/use-role-nav.ts`
- Role dashboards are card/report launchpads, not map workbenches:
  - `apps/web/src/app/driver/page.tsx`
  - `apps/web/src/app/fleet/page.tsx`
  - `apps/web/src/app/caas/page.tsx`
- `/planner` is currently a centered `FramedPanel` with corridor selector + chat + KPI rail, not a full-viewport map surface:
  - `apps/web/src/app/planner/page.tsx`
  - `apps/web/src/components/planner/chat-panel.tsx`

### Existing map foundations

There are **two generations of map code**:

1. **Preferred Phase-11/15 vector Google Maps pattern** using `@vis.gl/react-google-maps`:
   - `apps/web/src/components/pulse/pulse-map.tsx`
   - `apps/web/src/components/hotspot/hotspot-map.tsx`
   - `apps/web/src/components/map/route-map.tsx`
2. **Older direct `window.google.maps` planner visualizations**:
   - `apps/web/src/components/planner/route-map.tsx`
   - `apps/web/src/components/planner/heatmap.tsx`

Phase 17 should build from the preferred vector pattern and avoid extending the older direct `window.google.maps` planner components except as payload-shape references.

---

## Reusable Frontend Patterns

### 1. Full-viewport technical map shell

**Best source:** `apps/web/src/components/hotspot/hotspot-explorer.tsx`

Useful pattern:

- Own selected entity state in a shell component.
- Render a large map slot plus optional right-side report/metadata panel.
- Use `TechnicalFrame`, `BlueprintGrid`, `MetadataBlock` to preserve the FleetVolt technical visual language.
- Keep map and side panel sibling layout flexible:
  - map slot: `relative flex min-h-[420px] flex-1 overflow-hidden rounded-2xl`
  - right panel: `w-full lg:w-[400px] shrink-0`

Current limitation:

- `HotspotExplorer` is still centered with `max-w-[1320px]`, padding, and `min-h-screen` — close, but Phase 17 needs a true workbench that uses the available AppShell viewport (`calc(100vh - topbar)`) and minimizes ornamental page padding.

Recommended reuse:

- Create a generic workbench shell based on this shape, not on `FramedPanel`.
- Keep selection state at shell level: selected route/asset/layer/plan result flows into map + cards.

Likely new component:

- `apps/web/src/components/workbench/map-workbench-shell.tsx`

---

### 2. Preferred Google vector map base

**Best sources:**

- `apps/web/src/components/pulse/pulse-map.tsx`
- `apps/web/src/components/hotspot/hotspot-map.tsx`
- `apps/web/src/components/map/route-map.tsx`

Reusable rules already followed in preferred code:

- `APIProvider apiKey={API_KEY} version="quarterly"`
- `Map mapId={MAP_ID} renderingType={RenderingType.VECTOR}`
- `gestureHandling="greedy"`
- `disableDefaultUI`
- no inline `styles[]`; styling belongs on the Google Cloud vector Map ID
- fallback when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` or `NEXT_PUBLIC_GOOGLE_MAP_ID` is missing
- map stays mounted; selection/zoom/focus are driven through imperative controller children using `useMap()`

Concrete pattern from `pulse-map.tsx`:

- `MapFocusController` lives inside `<Map>` and calls `map.panTo`, `map.setZoom`, or `map.fitBounds`.
- children render inside the mounted map, allowing pins/layers to change without remount.

Concrete pattern from `hotspot-map.tsx`:

- `ZoomLevelController` listens to `zoom_changed` and maps zoom to `nation | state | county`.
- map conditionally renders different marker layers without remounting.

Concrete pattern from `components/map/route-map.tsx`:

- `MapController` publishes a neutral `FvMapHandle` to callers.
- `RoutePolylines` imperatively creates/removes `google.maps.Polyline` objects from inside a `useMap()` child.
- `AdvancedMarker` + DOM children are used for charging stops.
- `InfoWindow` handles selected stop metadata.

Recommended Phase 17 extraction:

- Create a shared workbench map base rather than copy-pasting `PulseMap` / `HotspotMap`.
- Suggested component:
  - `apps/web/src/components/workbench/workbench-map.tsx`
- Suggested responsibilities:
  - env fallback
  - vector map setup
  - default bounds
  - focus controller
  - layer children slot
  - optional zoom-level callback

---

### 3. Bounds, route geometry, and map handle helpers

Existing helpers to reuse:

- `apps/web/src/lib/ca-framing.ts`
  - `bboxTupleToBounds([west, south, east, north])`
  - `computeCaCoastBounds(points?)`
  - avoids lat/lng transposition bugs from Turf bbox tuples.
- `apps/web/src/lib/map-ref.ts`
  - `FvMapHandle` with `panTo(lat, lng, zoom?)` and `captureSnapshot()`.
  - `createGoogleMapHandle(map)` returns a Google-backed map handle.
  - `captureSnapshot()` intentionally returns `null` because Google vector maps do not expose the old Mapbox canvas snapshot path.
- `apps/web/src/lib/soc-segments.ts`
  - `buildSocPolylines()` converts SoC gradient into segmented Google polylines.
  - `buildActiveCasingPath()` creates active hover casing.

Recommended Phase 17 use:

- Use `computeCaCoastBounds()` for default CA workbench framing.
- Use `bboxTupleToBounds()` for route bounds from Turf `bbox(lineString(routeCoords))`.
- Use `FvMapHandle` for card/table actions that need to focus an asset or stop.
- For any route energy display, reuse `buildSocPolylines()` rather than drawing a single blue route line.

---

### 4. Dynamic no-SSR map loading

**Source:** `apps/web/src/components/map/route-map-dynamic.tsx`

Pattern:

- Dynamic import with `ssr: false` for map components.
- Loading skeleton uses `data-testid="route-map-loading"`.

Phase 17 should use this pattern for any new full-viewport Google map component if SSR/hydration issues appear.

Likely new file:

- `apps/web/src/components/workbench/workbench-map-dynamic.tsx`

---

### 5. Role-specific navigation and route entry points

**Sources:**

- `apps/web/src/components/nav/use-role-nav.ts`
- `apps/web/src/app/driver/page.tsx`
- `apps/web/src/app/fleet/page.tsx`
- `apps/web/src/app/caas/page.tsx`

Current role nav:

- Driver: `/driver`, `/planner`, `/planner`, `/unit`, `/status`
- Fleet manager: `/fleet`, `/planner`, `/unit`, `/load`, `/driver`, `/status`
- CaaS: `/caas`, `/hotspot`, `/planner`, `/status`

Phase 17 seam:

- Decide whether the workbench lives at `/planner` with a `role` mode, or at role-specific routes:
  - `/driver/day-plan`
  - `/fleet/contract-plan`
  - `/caas/gap-map`
- If creating role-specific routes, update `use-role-nav.ts` and `AppShell.getPageTitle()`.
- If keeping `/planner`, the planner page must detect user role and render the correct workbench mode.

Recommendation:

- Prefer explicit route surfaces for clarity and testing, with dashboards linking into them:
  - Driver dashboard primary CTA: `Start Day Plan` → `/driver/day-plan`
  - Fleet dashboard primary CTA: `Plan Contract` → `/fleet/contract-plan`
  - CaaS dashboard CTA / Charger Network nav: `Gap Map` → `/caas/gap-map`
- Keep `/planner` as backward-compatible AI planner or redirect to role-specific workbench.

---

## Existing Data / Convex Integration Seams

### 1. Charger queries

**File:** `apps/web/convex/chargers/queries.ts`

Available functions:

- `nearestClass8({ lat, lng, radiusM, limit? })`
- `fiveClosest({ lat, lng, limit? })`
- `class8Gap({ corridorPoints, radiusM })`

Important patterns:

- Spatial work delegates to `lib/spatial.nearestPoints`.
- Class-8 capability is filtered with a doc-level JS predicate on `isClass8Capable` to avoid index filter-key drift.
- `class8Gap` deduplicates Class-8 chargers across corridor sample points and returns both true Class-8 chargers and five closest any-class chargers as the reality check.

Phase 17 uses:

- Driver: route charging options and detour candidates.
- Fleet: contract route charging feasibility and downtime.
- CaaS: true Class-8 gaps vs nearby unusable LD chargers.

Risk:

- `fiveClosest` implementation accepts only `lat`, `lng`, `limit?`, but planner prompt documents `radiusM`; avoid passing unsupported args from new deterministic UI code.

---

### 2. Carrier queries

**File:** `apps/web/convex/carriers/queries.ts`

Available functions:

- `carriersInRadius({ lat, lng, radiusM, limit? })`
- `carrierDensityByCorridorCity({})`
- `topCarriersNear({ lat, lng, radiusM, limit? })`

Patterns:

- Located carrier queries are spatial and return only geocoded rows.
- `carrierDensityByCorridorCity` does not require geocoding and should be used for corridor-city aggregate outreach context.

Phase 17 uses:

- CaaS gap map: target fleets/carriers around route gaps or selected sites.
- Fleet contract plan: carriers may be less central unless benchmarking/market context is needed.

---

### 3. POI and parking queries

**File:** `apps/web/convex/pois/queries.ts`

Available functions:

- `poisInRadius({ lat, lng, radiusM, types?, limit? })`
- `parkingInRadius({ lat, lng, radiusM, limit? })`

Patterns:

- `poisInRadius` returns `{ total, pois, byType }`.
- `parkingInRadius` returns `{ count, totalSpotsWithinRadius, parking }`.
- POI type filtering is doc-level JS predicate for drift safety.

Phase 17 uses:

- Driver: amenities, rest/food/fuel/parking, site access guidance.
- Fleet: route amenities and parking capacity near charge/dwell points.
- CaaS: siting context.

---

### 4. Geo queries and hotspot zoom layers

**Files:**

- `apps/web/convex/geo/queries.ts`
- `apps/web/convex/hotspots/queries.ts`
- `apps/web/src/lib/hotspot-zoom.ts`
- `apps/web/src/components/hotspot/hotspot-map.tsx`

Available functions:

- `listGeoRegions({ level? })`
- `listModeledHotspots({})`

Patterns:

- `listGeoRegions` returns `fips`, `name`, `level`, `parentFips`, `centroid`, `bbox`, `aggregateScore`.
- `listModeledHotspots` returns modeled dwell hotspot pins.
- `hotspot-zoom.ts` maps zoom levels to `nation | state | county` and maps scores to color/radius.

Phase 17 uses:

- CaaS: area layers for county/air-district/census/zip style interaction.
- Fleet and driver: optional contextual overlays, but do not overload the base route planning view.

Risk:

- Current `GeoRegion` type in `hotspot-map.tsx` omits `airDistrict` even though other code references county air districts. Add only when query returns it or create a dedicated query.

---

### 5. Hotspot report and CaaS zone report

**Files:**

- `apps/web/convex/report.ts`
- `apps/web/convex/caas/queries.ts`
- `apps/web/src/components/hotspot/hotspot-report-panel.tsx`

Available functions:

- `report.hotspotReport({ lat, lng, radiusM, hotspotId?, fafYear? })`
- `caas/queries.getZoneReport({ zoneId })`
- `caas/queries.getZoneGeoContext({ zoneId })`
- `caas/queries.getChargerGapByArea({ level, fips?, airDistrict?, zipCode? })`
- `caas/queries.listZonesByPriority({ caasId })`
- `caas/queries.listDeploymentZones({ caasId })`

Patterns:

- `hotspotReport` fuses carriers, parking, POIs, chargers, modeled score, freight context, and derived `whatsMissing` into one payload.
- It explicitly labels scores as `method: "modeled"` and avoids fabricated detour cost / environmental benefit numbers.
- `HotspotReportPanel` renders that payload in right-side drilldown sections.

Phase 17 uses:

- CaaS side panel for clicked location/gap/zone.
- Fleet side panel for “mobile CaaS support point” context.

Risk:

- `hotspotReport` is point/radius based. Phase 17 needs route-based gap classification. Use it for selected point/site drilldown, not as the only route-gap source.

---

### 6. Physics simulation action

**File:** `apps/web/convex/physics/simulate.ts`

Available action:

- `physics/simulate.simulate({ request })`

Request shape from planner prompt:

```ts
{
  request: {
    route: { corridor_key?, origin?, dest?, terminal_key? },
    truck: { slug },
    conditions?: {
      weather_preset?,
      payload_lbs?,
      port_drayage_enabled?,
      charging?
    },
    overrides?,
    options?
  }
}
```

Implementation patterns:

- Action computes an inputs hash and returns cached completed simulation results when available.
- Reads truck config, corridor, and elevation via internal queries.
- Searches HD chargers with `powerKw >= 350` through spatial layer.
- Runs `runSimulation()` and persists the result in `simulations` table.
- Output includes `segments`, `kpis`, `charging_stops`, feasibility details, and route/corridor metadata.

Phase 17 uses:

- Driver day plan: feasibility, charge stops, route energy, workday constraints.
- Fleet contract plan: trucks/drivers required, charging downtime, schedule feasibility.
- CaaS gap map: route/time demand and support placement.

Critical seam:

- The existing `convex/planner.ts` **documents** `physics/simulate:simulate` in its LLM tool list but `executeQuery()` does **not** dispatch it, because it is an action, not a query. Phase 17 deterministic UI should call it with `useAction(api.physics.simulate.simulate)` directly, or add a deliberate action-dispatch path. Do not assume current AI planner can execute simulation.

---

### 7. AI planner action

**File:** `apps/web/convex/planner.ts`

Available action:

- `planner.planWithAi({ message, role, context? })`

Patterns:

- Role-aware prompts for `driver | fleet_manager | caas`.
- LLM plans allowed Convex function calls; action executes a hardcoded dispatch map.
- Returns `{ answer, visualization, queries_run, role, model, fallback }`.
- `buildVisualizationData()` currently only returns coarse shapes for `heatmap`, `route_map`, and `table`.
- Error handling is designed to hide raw API paths from end users.

Current frontend usage:

- `ChatPanel` calls `planWithAi({ message: text, role: "caas" })` unconditionally.

Phase 17 uses:

- AI should translate intent into map actions/overlays, not prose walls.
- Consider adding a new structured planner/workbench action that returns explicit map commands:
  - `setRoute`
  - `focusBounds`
  - `enableLayer`
  - `selectAsset`
  - `openCard`
  - `runSimulation`
  - `showGapSegments`

Risks:

- Current `ChatPanel` hardcodes `role: "caas"`; wrong for Driver and Fleet.
- Current planner visualization payloads do not match the preferred `components/map/route-map.tsx` simulation route-map inputs.
- The planner prompt can propose `physics/simulate`, but the executor cannot run it.
- The older planner map components expect `origin`, `destination`, `gapPoints`, flat charger rows with `lat/lng`; `buildVisualizationData()` often returns nested `gap`, `existingChargers`, `chargers.class8`, etc. This mismatch makes those visualizations fragile.

---

## Existing Route / Map Components

### Preferred simulation route map

**File:** `apps/web/src/components/map/route-map.tsx`

Strengths:

- Correct vector Google Maps implementation.
- Uses `AdvancedMarker`, `InfoWindow`, and imperative `Polyline`s.
- Reuses route geometry + simulation segments.
- Supports hover sync to SoC chart via `useScenarioStore.activeDistanceM`.
- Publishes `FvMapHandle` so table rows can pan/focus the map.
- Has stable marker test IDs (`data-testid="charger-marker"`, `data-station-id`).

Use this for Phase 17 route/simulation rendering.

### Route map containers

**Files:**

- `apps/web/src/components/workspace/route-planner-center.tsx`
- `apps/web/src/components/results/basic-results-panel.tsx`

Patterns:

- Gate map rendering on env token + route geometry + loading state.
- Use `RouteMapDynamic` to avoid SSR issues.
- Pair map with KPI rows, SoC chart, charging plan table, assumptions.

Phase 17 use:

- Extract the useful pieces into map workbench panels/cards.
- Do not preserve the old centered results-panel layout as the primary surface.

### Older planner route map and heatmap

**Files:**

- `apps/web/src/components/planner/route-map.tsx`
- `apps/web/src/components/planner/heatmap.tsx`

Strengths:

- Useful as quick examples for simple charger/POI/carrier pins and fallback heatmap ideas.

Anti-patterns:

- Directly polls `window.google?.maps` with `setInterval`.
- Creates `new google.maps.Map()` on every data change rather than keeping `<Map>` mounted.
- Uses deprecated `google.maps.Marker` instead of `AdvancedMarker`.
- Hardcoded map IDs (`fleetvolt-route-map`, `fleetvolt-heatmap`) instead of `NEXT_PUBLIC_GOOGLE_MAP_ID`.
- Fixed `h-[400px]`, not workbench-ready.
- No missing-token fallback.
- No cleanup of markers/polylines/layers after map re-init.

Recommendation:

- Do not extend these for Phase 17. Replace planner map visualization with preferred vector map components/layers.

---

## Role Dashboard Patterns and Required Changes

### Driver dashboard

**File:** `apps/web/src/app/driver/page.tsx`

Current state:

- Mobile-first card dashboard.
- CTA links to `/planner` for `Start Navigation` / `Find Chargers`.
- Placeholder data only: no assigned route, no vehicle, no nearby charging.

Phase 17 changes:

- Keep dashboard as a launchpad if needed, but primary CTA should launch full day planner map workbench.
- Replace generic `/planner` links with `/driver/day-plan` or role-aware workbench route.

### Fleet dashboard

**File:** `apps/web/src/app/fleet/page.tsx`

Current state:

- Desktop-first KPI/table dashboard.
- Queries `api.fleet.queries.getFleetOverview({ fleetId: "demo-fleet" })`.
- CTA links to `/planner` for `Dispatch New Route`.

Phase 17 changes:

- Add contract-planning CTA and route into workbench.
- Avoid hardcoding demo fleet long term; Phase 17 can preserve current demo fallback but should isolate it in workbench defaults.

### CaaS dashboard

**File:** `apps/web/src/app/caas/page.tsx`

Current state:

- Queries modeled hotspots and geo regions.
- Shows KPI row, hotspot list, county aggregate list, CTA to `/planner`.
- CaaS nav already points `Charger Network` to `/hotspot`.

Phase 17 changes:

- Make CaaS primary workbench a gap/opportunity map, likely replacing `/hotspot` or adding `/caas/gap-map`.
- Reuse `HotspotMap`, `HotspotReportPanel`, CaaS zone queries, and `report.hotspotReport`.

---

## AppShell / Sidebar Integration Seams

### Current AppShell

**File:** `apps/web/src/components/nav/app-shell.tsx`

Current constraints:

- Protected routes are wrapped with:
  - fixed `Sidebar`
  - sticky `TopBar` height `h-14`
  - content wrapper `md:pl-[260px] pl-14`
  - `<main className="min-h-[calc(100vh-3.5rem)] pb-14 md:pb-0">`
- It assumes expanded sidebar width `260px` on desktop.

Issue for Phase 17:

- Sidebar can collapse to 56px in `sidebar.tsx`, but AppShell always applies `md:pl-[260px]`. This wastes horizontal space for a full-viewport workbench when collapsed.
- Workbench needs map to dominate the viewport while preserving Google attribution and not being buried by padding.

Options:

1. Minimal Phase 17:
   - Keep AppShell as-is and build the workbench inside `main` with `h-[calc(100vh-3.5rem)]` and no internal max-width.
2. Better follow-up:
   - Lift sidebar collapsed width into context/store or CSS variable so content padding tracks actual sidebar width.
3. Route-level escape hatch:
   - Add a route metadata or pathname check for full-bleed workbench pages, e.g. `main` class without page padding and with `overflow-hidden`.

Files likely modified:

- `apps/web/src/components/nav/app-shell.tsx`
- `apps/web/src/components/nav/use-role-nav.ts`

---

## Recommended Phase 17 Architecture

### New shared workbench components

Create under `apps/web/src/components/workbench/`:

- `map-workbench-shell.tsx`
  - owns role/mode state, selected assets, right panel state, mobile sheet state
  - lays out left toolbar + map + right cards
- `workbench-map.tsx`
  - vector Google map base with fallback
  - focus controller and layer slots
- `workbench-map-dynamic.tsx`
  - optional dynamic import wrapper with `ssr:false`
- `planning-toolbar.tsx`
  - left role-aware form controls: origin/destination, route date/schedule, truck/profile, round trips/containers/day, layer toggles
- `workbench-side-panel.tsx`
  - result cards / clicked-asset metadata / plan summary
- `layers/charger-layer.tsx`
- `layers/carrier-layer.tsx`
- `layers/poi-layer.tsx`
- `layers/hotspot-layer.tsx`
- `layers/route-simulation-layer.tsx`
- `layers/geo-region-layer.tsx`

Layer pattern:

- Declarative `AdvancedMarker` for point assets.
- Imperative `google.maps.Polyline` or data-layer controllers inside `useMap()` children for routes and heavy overlays.
- Keep all controllers mounted under one `<Map>`.

### New route pages

Option A — explicit routes:

- `apps/web/src/app/driver/day-plan/page.tsx`
- `apps/web/src/app/fleet/contract-plan/page.tsx`
- `apps/web/src/app/caas/gap-map/page.tsx`

Option B — one route with mode:

- `apps/web/src/app/workbench/page.tsx`
- use `useUserRole()` to default mode.

Recommendation:

- Use explicit routes for clearer nav, role-specific copy, and test selectors. Internally they can all render the same `MapWorkbenchShell mode="driver" | "fleet" | "caas"`.

### State / data hooks

Suggested hooks:

- `apps/web/src/components/workbench/hooks/use-workbench-plan.ts`
  - route form state and validation.
- `apps/web/src/components/workbench/hooks/use-workbench-layers.ts`
  - layer toggles and map layer visibility.
- `apps/web/src/components/workbench/hooks/use-simulation-action.ts`
  - calls `api.physics.simulate.simulate` and normalizes output.
- `apps/web/src/components/workbench/hooks/use-map-assets.ts`
  - collects Convex query results for visible asset layers.

---

## Concrete Files to Modify / Create

### Modify

- `apps/web/src/components/nav/use-role-nav.ts`
  - add role-specific workbench nav items.
- `apps/web/src/components/nav/app-shell.tsx`
  - add page title mappings for new routes.
  - optionally add full-bleed workbench behavior.
- `apps/web/src/app/driver/page.tsx`
  - update CTAs from `/planner` to driver workbench.
- `apps/web/src/app/fleet/page.tsx`
  - update CTA from `/planner` to fleet contract workbench.
- `apps/web/src/app/caas/page.tsx`
  - update CTA to CaaS gap map or make `/hotspot` the workbench.
- `apps/web/src/components/planner/chat-panel.tsx`
  - if retained, stop hardcoding `role: "caas"`; role must come from auth or props.
- `apps/web/convex/planner.ts`
  - if AI remains central, add explicit map-command output or a safe action dispatch path for simulation; otherwise leave legacy planner as-is and build deterministic workbench actions separately.

### Create

- `apps/web/src/app/driver/day-plan/page.tsx`
- `apps/web/src/app/fleet/contract-plan/page.tsx`
- `apps/web/src/app/caas/gap-map/page.tsx`
- `apps/web/src/components/workbench/map-workbench-shell.tsx`
- `apps/web/src/components/workbench/workbench-map.tsx`
- `apps/web/src/components/workbench/workbench-map-dynamic.tsx`
- `apps/web/src/components/workbench/planning-toolbar.tsx`
- `apps/web/src/components/workbench/workbench-side-panel.tsx`
- `apps/web/src/components/workbench/layers/charger-layer.tsx`
- `apps/web/src/components/workbench/layers/carrier-layer.tsx`
- `apps/web/src/components/workbench/layers/poi-layer.tsx`
- `apps/web/src/components/workbench/layers/hotspot-layer.tsx`
- `apps/web/src/components/workbench/layers/route-simulation-layer.tsx`
- `apps/web/src/components/workbench/layers/geo-region-layer.tsx`
- `apps/web/src/components/workbench/hooks/use-simulation-action.ts`
- `apps/web/src/components/workbench/hooks/use-workbench-layers.ts`
- `apps/web/src/components/workbench/hooks/use-workbench-plan.ts`

### Optional Convex additions

Create only if existing queries are too point/radius oriented:

- `apps/web/convex/workbench/queries.ts`
  - route-focused aggregate query for visible layer data.
  - deterministic route gap payload that combines `class8Gap`, carrier targets, parking/POI context, and hotspot/geo context.
- `apps/web/convex/workbench/actions.ts`
  - orchestrates simulation + gap report into a workbench-native payload.

---

## Anti-Patterns to Avoid

1. **Do not build another centered card report as the primary UX.**
   - `FramedPanel max-w-[1100px]` dashboards are launchpads, not the Phase 17 product surface.

2. **Do not extend the old planner maps.**
   - `components/planner/route-map.tsx` and `heatmap.tsx` poll `window.google`, recreate maps, use deprecated markers, fixed 400px height, and hardcoded map IDs.

3. **Do not remount `<Map>` on role/layer/selection changes.**
   - Keep one vector map mounted and swap layers/markers/controllers.

4. **Do not use `google.maps.Marker` for new markers.**
   - Use `AdvancedMarker` from `@vis.gl/react-google-maps` with DOM marker content.

5. **Do not pass inline `styles[]` to vector maps.**
   - Google vector styling is controlled by the cloud Map ID.

6. **Do not rely on AI prose as the primary result.**
   - AI should produce structured workbench commands/cards/layers; prose is secondary.

7. **Do not fabricate detour cost, environmental benefit, or observed demand.**
   - Existing report code is careful: hotspot scores are `modeled`; detour/CO2 are deferred unless computed by physics/external data.

8. **Do not assume planner AI can run physics simulation.**
   - `physics/simulate` is documented in prompt but not dispatched in `executeQuery()`.

9. **Do not break Google attribution.**
   - Keep map insets/panels from covering Google logo/attribution.

10. **Do not create lib-specific map call-sites.**
    - Use `FvMapHandle.panTo()` instead of raw Google/Mapbox APIs in cards/tables.

---

## Key Risks / Open Decisions

### Product/route decision

- Choose explicit role routes vs one shared `/workbench` route. Explicit routes are recommended for clarity.

### AppShell full-viewport behavior

- Current `AppShell` desktop left padding is always 260px even if sidebar collapsed. This may conflict with “map dominates” requirement.

### Autocomplete

- Context requires autocomplete for addresses/ports/yards/chargers. Existing inspected files do not show a reusable autocomplete component. Likely needs new component and data sources:
  - ports/corridors/fleet yards from Convex
  - Google Places or internal geocoder for addresses
  - chargers/carriers/parking from Convex search/spatial queries

### Route-based gap payload

- Existing `hotspotReport` is point/radius; `class8Gap` is corridor-point based. A workbench-native route gap model likely needs to combine both, including “true gap vs detour-solvable gap.”

### Simulation output integration

- Preferred route map expects simulation segments, charging stops, route coordinates, and route geometry store entries. Workbench needs a deterministic route-geometry fetch/fill path before rendering `RouteMap`.

### Role-specific defaults

- Current fleet dashboard uses demo fleet ID. Current planner chat hardcodes CaaS role. These are acceptable demo defaults only if isolated and labeled; Phase 17 role workbench should get role from auth and explicit toolbar state.

---

## Suggested Implementation Order

1. Build shared `MapWorkbenchShell` with full-viewport layout inside existing AppShell.
2. Build `WorkbenchMap` from `PulseMap`/`HotspotMap` vector pattern.
3. Add explicit role pages that render the shell in driver/fleet/caas modes.
4. Add left toolbar with static/deterministic form state first.
5. Wire simulation action directly for driver/fleet route plans.
6. Reuse `components/map/route-map.tsx` logic or extract its route layer into `route-simulation-layer.tsx`.
7. Add point layers for chargers, POIs, parking, carriers, hotspots, and geo aggregate pins.
8. Add CaaS gap mode using `class8Gap`, `topCarriersNear`, `hotspotReport`, and CaaS zone queries.
9. Add structured AI map-command seam only after deterministic workflows render correctly.
10. Update role dashboards/nav to launch the new workbench routes.
