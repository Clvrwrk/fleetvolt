# Phase 17 Research — Role-Based Full-Viewport Map Workbench

**Phase:** 17 — Role-Based Map Workbench: Driver Day Plan, Fleet Contract Plan, CaaS Gap Map  
**Date:** 2026-07-08  
**Researcher:** Hermes GSD Phase 17 researcher  
**Product source of truth:** `.planning/research/ROLE-MAP-WORKBENCH-INTERVIEW.md` and `CONTEXT.md`

---

## Executive Summary

FleetVolt already has enough foundations to build the Phase 17 workbench without a map-stack rewrite:

- `@vis.gl/react-google-maps` is installed and already used for vector Google Maps.
- Existing production-quality Google vector map patterns live in:
  - `apps/web/src/components/map/route-map.tsx`
  - `apps/web/src/components/pulse/pulse-map.tsx`
  - `apps/web/src/components/hotspot/hotspot-map.tsx`
- Convex already exposes most spatial data needed for map layers: `chargers`, `carriers`, `parking`, `pois`, `highwaySegments`, `freightFlows`, `faf`, `geoRegions`, `truckConfigs`, `fleetRoutes`, `driverProfiles`, `userRoutes`, and CaaS zones.
- The main implementation gap is UX/architecture, not raw data: the current `/planner` is a framed 3-column card where the center is chat, while Phase 17 requires a full-viewport map workbench where dashboards are launchpads.

**Recommended approach:** create a new reusable workbench route and component system under `apps/web/src/app/workbench/...` and `apps/web/src/components/workbench/map-workbench/...`, then point role dashboard CTAs to role-specific workbench modes. Keep the Google map mounted, drive mode/layers/panels through React/Zustand state, and adapt existing map components into a single `FleetVoltMapCanvas` instead of continuing parallel map implementations.

---

## Product Intent to Preserve

Phase 17 should implement this interaction model:

```text
Role dashboard → one obvious planning CTA → full-viewport map workbench → structured map overlays + result cards
```

Role workbench modes:

1. **Driver Day Plan**
   - User inputs route A → B, round trips target, truck/profile/workday constraints.
   - Output: feasibility, charge stops, Class 8 + trailer-friendly chargers, detours when needed, access guidance.

2. **Fleet Contract Plan**
   - User inputs port/origin, destination, date/schedule, containers/day, gate hours, dwell, shift length, yard return.
   - Output: trucks/drivers required, charge events, downtime, route amenities, true gaps, mobile CaaS support points/times.

3. **CaaS Gap / Opportunity Map**
   - User clicks/chooses a port or origin, chooses destination, and analyzes a corridor.
   - Output: true Class 8 charger gaps, detour-solvable gaps, target carriers/fleets, mobile charging positioning, demand by route/time.

Non-negotiables from context:

- Full viewport map/work surface.
- Left planning toolbar.
- Right/slide-out metadata/result cards.
- Google Maps-style route interaction.
- Autocomplete for addresses/ports/yards/chargers.
- Clickable assets: ports, chargers, carriers, yards, parking, amenities.
- Layers: freight flow, charger coverage, Class 8 gaps, dwell/parking, carriers, air districts, census/zip/county.
- AI should translate intent into map actions and overlays, not prose walls.
- Desktop maximizes work surface; mobile collapses tools to bottom sheet / stepper.

---

## Existing Codebase Findings

### Google Maps / vis.gl foundations

Dependencies in `apps/web/package.json`:

- `@vis.gl/react-google-maps: 1.9.0`
- `@turf/turf: 7.3.5`
- `@types/google.maps: 3.65.2`
- `zustand: 5.0.14`
- `convex: 1.42.1`

Existing map components:

1. `apps/web/src/components/map/route-map.tsx`
   - Best current reference for a real route map.
   - Uses `APIProvider`, `Map`, `RenderingType.VECTOR`, `AdvancedMarker`, `InfoWindow`, `useMap`.
   - Uses `google.maps.Polyline` imperatively for route / SoC line rendering.
   - Uses Turf for bbox and nearest-point hover behavior.
   - Publishes a map handle through `apps/web/src/lib/map-ref.ts`.

2. `apps/web/src/components/pulse/pulse-map.tsx`
   - Clean minimal vector map shell.
   - Shows the correct `useMap()` focus-controller pattern.
   - Keeps map mounted and imperatively pans/fits.

3. `apps/web/src/components/hotspot/hotspot-map.tsx`
   - Useful for zoom-driven layer switching.
   - Renders state/county/hotspot layers based on zoom without remounting the map.
   - Good model for Phase 17 overlay toggles.

4. `apps/web/src/components/planner/route-map.tsx` and `apps/web/src/components/planner/heatmap.tsx`
   - Older/less ideal direct `new google.maps.Map(...)` implementations.
   - Use deprecated `google.maps.Marker` instead of `AdvancedMarker`.
   - Poll for `window.google?.maps` and create fresh map instances in effects.
   - Should be replaced or refactored into the shared vis.gl canvas.

5. `apps/web/src/lib/map-ref.ts`
   - Defines `FvMapHandle` with `panTo(lat,lng,zoom?)` and `captureSnapshot()`.
   - Important abstraction: Google vector maps cannot provide Mapbox-style `getCanvas().toDataURL()`; snapshot currently returns `null` gracefully.

### Current planner surface mismatch

`apps/web/src/app/planner/page.tsx` currently:

- Uses `FramedPanel max-w-[1200px]` instead of full viewport.
- Uses `grid-cols-[200px_minmax(0,1fr)_240px]` card layout.
- Center column is `ChatPanel` or empty state, not the dominant map.
- Chat hardcodes `role: "caas"` in `apps/web/src/components/planner/chat-panel.tsx`.
- KPI preview is still static (`312 kWh`, `2 charge stops`, `62%`) after corridor selection.

This should not be extended as-is for Phase 17. Either replace `/planner` with the new workbench or have `/planner` redirect to `/workbench?mode=...`.

### App shell / responsive foundations

`apps/web/src/components/nav/app-shell.tsx` already provides:

- Sidebar on desktop.
- Top bar with `PageHeader` and `UserMenu`.
- Mobile bottom tab bar.

But a true map workbench should probably use a **workbench shell variant** that minimizes chrome:

- Desktop: left sidebar may collapse to icon rail; workbench left planning panel is inside the main content and may be 320-380px.
- Mobile: hide desktop sidebar and use top compact header + map + bottom sheet.
- Main area should be `h-[calc(100dvh-3.5rem)]` or equivalent, not centered max-width panel.

### Convex spatial/data foundations

`apps/web/convex/schema.ts` contains the relevant tables:

- Points:
  - `ports`
  - `chargers`
  - `carriers`
  - `parking`
  - `pois`
  - `hotspots`
  - `fleetParkingLots`
  - `caasDeploymentZones`
- Lines / regions:
  - `highwaySegments`
  - `freightFlows`
  - `corridors`
  - `nhfnSegments`
  - `geoRegions`
  - `freightOD`, `fafZones`, `fafModes`, `fafCommodities`
- Role/user data:
  - `driverProfiles`
  - `userAccounts`
  - `fleetCompanies`, `fleetDrivers`, `fleetRoutes`
  - `caasCompanies`, `caasDeploymentZones`
  - `userRoutes`
- Simulation:
  - `truckConfigs`
  - `simulations`

Key query surfaces:

- `apps/web/convex/chargers/queries.ts`
  - `nearestClass8`
  - `fiveClosest`
  - `class8Gap`
- `apps/web/convex/carriers/queries.ts`
  - `carriersInRadius`
  - `carrierDensityByCorridorCity`
  - `topCarriersNear`
- `apps/web/convex/pois/queries.ts`
  - `poisInRadius`
  - `parkingInRadius`
- `apps/web/convex/highways/queries.ts`
  - `segmentsInBbox`
  - `mostCongestedRoute`
  - `corridorCongestion`
- `apps/web/convex/geo/queries.ts`
  - `listGeoRegions`
- `apps/web/convex/planner.ts`
  - Existing LLM planner action that plans and executes Convex queries, then returns `{ answer, visualization, queries_run, role }`.

### Routing / geometry state

`apps/web/src/lib/route-geometry.ts` currently says the old Fastify route proxy was decommissioned and geometry should come from Convex simulation results or Google Routes API, but `fetchRouteGeometry()` still returns empty coordinates unless `API_URL` is configured.

`apps/web/src/stores/scenario-store.ts` calls `fetchRouteGeometry()` after simulation and caches route geometry by job id. Because `API_URL` is generally decommissioned, map geometry may be unavailable even when simulation KPIs exist.

**Phase 17 needs a first-class route geometry service**, not a fallback stub.

---

## External API / Library Findings

### @vis.gl/react-google-maps

The library is a React wrapper for Google Maps JS API. Its own docs emphasize that Google Maps is imperative and holds internal map/camera state, while React apps need a single source of truth. This matches FleetVolt's need for a shared workbench state store plus small imperative controllers inside the mounted map.

Recommended FleetVolt pattern:

```tsx
<APIProvider apiKey={apiKey} version="quarterly">
  <Map
    mapId={mapId}
    renderingType={RenderingType.VECTOR}
    defaultBounds={bounds}
    gestureHandling="greedy"
    disableDefaultUI
  >
    <MapWorkbenchController ... />
    <RouteLayer ... />
    <AssetMarkers ... />
    <FreightFlowLayer ... />
  </Map>
</APIProvider>
```

### Google vector map / AdvancedMarker rules

Use `AdvancedMarker` for clickable assets. Google docs describe advanced markers as customizable, performant, accessible, and capable of custom HTML/CSS. They require a Map ID.

FleetVolt-specific implications:

- Keep `NEXT_PUBLIC_GOOGLE_MAP_ID` as a real vector map ID.
- Do not use deprecated `google.maps.Marker` in new workbench code.
- Build marker DOM per asset type:
  - charger: power / Class 8 capable / selected state
  - carrier: fleet/company marker
  - parking: HGV capacity marker
  - POI: amenity type marker
  - CaaS zone: gap/opportunity severity marker
- Give markers `data-testid`, `data-asset-type`, and stable ids for e2e.

### Places Autocomplete / Geocoding

Google's current Place Autocomplete Widget provides place predictions and details on selection. It can be added to a web page or to a map, constrained/biases predictions, and should be optimized for cost/performance.

Recommended FleetVolt approach:

- Prefer a custom `PlaceInput` wrapper using the Maps JS `places` library via `useMapsLibrary('places')` or `google.maps.importLibrary('places')` rather than uncontrolled ad hoc script loading.
- Bias/restrict to the operating geography initially (California / port regions) to reduce irrelevant predictions and cost.
- Store selected values as normalized `WorkbenchPlace` objects:

```ts
type WorkbenchPlace = {
  kind: 'google_place' | 'fleetvolt_asset' | 'manual_coordinate';
  label: string;
  lat: number;
  lng: number;
  placeId?: string;
  sourceTable?: 'ports' | 'chargers' | 'carriers' | 'parking' | 'pois' | 'fleetParkingLots';
  sourceId?: string;
};
```

- For known FleetVolt assets, search local Convex data first or alongside Places:
  - ports / yards / fleet lots
  - chargers
  - carriers
  - parking and POIs
- Use Geocoding only when the user enters a raw address not resolved by Places or local asset search.

### Routes / route drawing

Google Routes API supports Compute Routes and Compute Route Matrix. It can return routes, distances, travel times, traffic-aware routes, route matrices, tolls, and polylines. However, it is not a full Class 8 truck-restriction engine.

Recommended split:

- Use Google Routes API for normal user-facing route geometry and map display when PTV/truck route is unavailable.
- Use PTV or another truck-aware service only behind a server/Convex action if high-fidelity truck restrictions are required.
- Feed route geometry into existing physics simulation / charger-gap logic.
- Draw routes with `google.maps.Polyline` in a `useMap()` child component, following the existing `apps/web/src/components/map/route-map.tsx` approach.
- For SoC/gap severity gradients, keep the existing segmented-polyline approach (`apps/web/src/lib/soc-segments.ts`). Google Maps has no Mapbox `line-gradient` equivalent.

### Heatmap / overlays

Google Heatmap Layer is part of the `visualization` library and must be explicitly loaded. It supports weighted points and visual options like `gradient`, `radius`, `opacity`, and `maxIntensity`.

But for Phase 17, weighted heatmap should not be the only overlay model. Better layer types:

- **Discrete asset markers:** chargers, carriers, parking, POIs, yards, ports.
- **Route polylines:** route, detour route, SoC severity, charging segments.
- **Segment polylines:** freight flow / truck AADT / congestion from `highwaySegments` and `freightFlows`.
- **Region overlays:** county/air-district/zip rollups from `geoRegions` and CaaS zones. Since Convex stores centroids/bboxes, start with centroid markers and bbox rectangles; add polygons later if TIGER geometry is ingested.
- **Heatmap:** optional for CaaS gap density if `visualization` library is loaded; otherwise fallback to weighted markers.

---

## Recommended Architecture

### 1. New route structure

Use explicit role/mode routes so dashboards launch directly into the right workbench:

```text
/apps/web/src/app/workbench/page.tsx
/apps/web/src/app/driver/day-plan/page.tsx              -> redirects or renders workbench mode=driver_day_plan
/apps/web/src/app/fleet/contract-plan/page.tsx          -> mode=fleet_contract_plan
/apps/web/src/app/caas/gap-map/page.tsx                 -> mode=caas_gap_map
```

Possible URL model:

```text
/workbench?mode=driver_day_plan
/workbench?mode=fleet_contract_plan
/workbench?mode=caas_gap_map
```

Longer-term, route plans should be shareable:

```text
/workbench/plan/[planId]
```

### 2. Component structure

Suggested files:

```text
apps/web/src/components/workbench/map-workbench/
  map-workbench-shell.tsx
  fleetvolt-map-canvas.tsx
  workbench-left-panel.tsx
  workbench-right-panel.tsx
  mobile-workbench-sheet.tsx
  mode-config.ts
  types.ts

apps/web/src/components/workbench/map-workbench/layers/
  route-layer.tsx
  detour-layer.tsx
  charger-layer.tsx
  carrier-layer.tsx
  parking-layer.tsx
  poi-layer.tsx
  highway-flow-layer.tsx
  geo-region-layer.tsx
  caas-gap-layer.tsx
  selected-asset-card.tsx

apps/web/src/components/workbench/map-workbench/inputs/
  place-input.tsx
  asset-autocomplete.tsx
  route-builder.tsx
  truck-profile-select.tsx
  workday-constraints.tsx
  contract-constraints.tsx
  layer-toggle-list.tsx

apps/web/src/stores/map-workbench-store.ts
apps/web/src/lib/maps/google-routes.ts
apps/web/src/lib/maps/google-places.ts
apps/web/src/lib/maps/workbench-geometry.ts
```

### 3. State model

Create a dedicated Zustand store instead of overloading `scenario-store.ts`:

```ts
type WorkbenchMode = 'driver_day_plan' | 'fleet_contract_plan' | 'caas_gap_map';

type WorkbenchLayerId =
  | 'route'
  | 'detours'
  | 'chargers'
  | 'class8_gaps'
  | 'carriers'
  | 'parking'
  | 'pois'
  | 'highways'
  | 'freight_flow'
  | 'geo_regions'
  | 'caas_zones';

type WorkbenchSelection =
  | { type: 'charger'; id: string }
  | { type: 'carrier'; id: string }
  | { type: 'parking'; id: string }
  | { type: 'poi'; id: string }
  | { type: 'port'; id: string }
  | { type: 'route_segment'; id: string }
  | { type: 'gap'; id: string }
  | null;

type WorkbenchPlanDraft = {
  mode: WorkbenchMode;
  origin: WorkbenchPlace | null;
  destination: WorkbenchPlace | null;
  waypoints: WorkbenchPlace[];
  truckSlug?: string;
  roundTrips?: number;
  containersPerDay?: number;
  schedule?: string;
  gateHours?: { start: string; end: string };
  dwellMinutes?: number;
  shiftHours?: number;
  yardReturn?: boolean;
};
```

The map reads from this store and renders layers. Panels write to it. Convex query results should be normalized into renderable layer arrays before reaching marker components.

### 4. Map canvas design

`FleetVoltMapCanvas` should consolidate current vis.gl patterns:

- `APIProvider` + vector `Map` + shared `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` / `NEXT_PUBLIC_GOOGLE_MAP_ID` fallback.
- Keep the map mounted across:
  - role/mode changes
  - layer toggles
  - selected asset changes
  - route recalculations
- Use child controllers inside `<Map>`:
  - `MapFocusController`
  - `MapBoundsController`
  - `MapClickController`
  - `ZoomLayerController`
- Use `AdvancedMarker` only for new markers.
- Use imperative `google.maps.Polyline` components for route / flow lines.
- Use `MapControl` for compact on-map controls only when needed; primary tools live in panels.

### 5. Desktop layout pattern

Suggested desktop CSS structure:

```tsx
<div className="h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden">
  <div className="grid h-full grid-cols-[360px_minmax(0,1fr)_380px]">
    <WorkbenchLeftPanel />
    <FleetVoltMapCanvas />
    <WorkbenchRightPanel />
  </div>
</div>
```

Guidance:

- Avoid `FramedPanel` and max-width wrappers for the workbench.
- Map should occupy the full remaining viewport.
- Left panel should be scrollable independently.
- Right panel should be collapsible; collapsed state gives map more width.
- Use contextual cards, not prose-heavy chat output.
- Use a small AI command input as a tool in the left panel or as a command bar, not the center of the experience.

### 6. Mobile layout pattern

Mobile should not attempt three columns:

```text
Top compact bar
Map canvas full height
Bottom sheet with current step/tools/results
Floating layer button / selected asset pill
```

Recommended behavior:

- Driver mode is mobile-first: route inputs in a bottom stepper, large touch targets, minimum typing.
- Fleet Manager/CaaS can be usable on tablet/mobile but optimized for desktop.
- Bottom sheet snap points:
  - collapsed: selected route summary / primary CTA
  - half: active form step or result cards
  - full: detailed constraints / metadata
- Right panel becomes mobile result sheet.
- Left planning panel becomes mobile stepper.

---

## Role-Specific Workbench Recommendations

### Driver Day Plan

Default layers:

- route
- chargers filtered to Class 8 capable
- parking/rest/amenities
- selected detour chargers

Inputs:

- origin
- destination
- round trips
- truck profile (default from `driverProfiles.preferredTruckSlug`)
- payload/weather/charging preferences defaulted from `driverProfiles`

Outputs:

- feasible / not feasible
- charge stops and dwell
- route risk cards
- site access card for selected charger
- detour option if no on-route Class 8 charger

Implementation seams:

- Use `driverProfiles` for defaults.
- Use `trucks/queries:list` for truck selection.
- Use `chargers/queries:class8Gap`, `nearestClass8`, `fiveClosest` for charger selection/gap explanation.
- Use `pois/queries:poisInRadius` and `parkingInRadius` near route stops.
- Use `physics/simulate:simulate` for energy/SoC feasibility.

### Fleet Contract Plan

Default layers:

- route
- chargers
- fleet yards / fleet parking lots
- drivers/trucks if available
- route amenities
- highway freight/congestion overlay

Inputs:

- port/origin
- inland destination
- date/schedule
- containers/day
- gate hours
- dwell minutes
- shift length
- yard return
- truck profile(s)

Outputs:

- trucks required
- drivers required
- charge events
- charging downtime
- schedule feasibility
- CaaS support recommendation when gap is true

Implementation seams:

- Use `fleet/queries:getFleetOverview`, `listFleetParkingLots`, `listFleetRoutes`, `getRouteChargers`.
- Use `userRoutes` or `fleetRoutes` to persist planned contracts/routes.
- Use `physics/simulate:simulate` per route/truck profile; add a planner helper to run multiple trips or derive trips/day.
- Use Google Route Matrix or server-side batching later for multi-origin / multi-yard planning.

### CaaS Gap / Opportunity Map

Default layers:

- ports
- Class 8 charger gaps
- carriers
- parking/dwell hotspots
- FAF/freight flow
- county/air district/zip context
- CaaS deployment zones

Inputs:

- click port/location or autocomplete origin
- choose destination
- radius / gap threshold
- demand timeframe if available

Outputs:

- true gap vs detour-solvable gap
- candidate deployment location/time window
- top carriers/fleets to target
- freight/dwell score cards
- existing charger reality-check cards

Implementation seams:

- Use `chargers/queries:class8Gap` for corridor points.
- Use `carriers/queries:topCarriersNear` and `carrierDensityByCorridorCity`.
- Use `report:hotspotReport` for selected point reports.
- Use `geo/queries:listGeoRegions`, `faf/queries:freightContext`, `highways/queries:corridorCongestion`.
- Use `caas/queries:listDeploymentZones`, `getChargerGapByArea`, `listZonesByPriority`.

---

## Data/API Integration Plan

### Convex query layer

Current queries are useful but Phase 17 would benefit from a thin workbench-specific aggregation module:

```text
apps/web/convex/workbench/queries.ts
apps/web/convex/workbench/actions.ts
```

Suggested query/action functions:

- `resolveWorkbenchAssets({ bbox, layerIds, mode })`
  - Returns visible assets by layer and current bounds.
- `buildRoutePlan({ mode, origin, destination, constraints })`
  - Orchestrates route geometry + simulation + chargers + POIs.
- `analyzeClass8GapAlongRoute({ routePolyline, radiusM })`
  - Samples corridor points from actual polyline and runs `class8Gap`.
- `getAssetMetadataCard({ type, id })`
  - Returns normalized metadata for selected marker/card.
- `saveWorkbenchPlan({ draft, result })`
  - Persists to `userRoutes`, `fleetRoutes`, or future `workbenchPlans` table.

### Google Places and local asset search

Create an autocomplete abstraction that merges:

1. FleetVolt assets from Convex:
   - ports
   - chargers
   - carriers
   - parking lots
   - POIs
   - fleet yards
2. Google Places predictions for raw addresses and businesses.
3. Manual coordinate fallback.

This avoids forcing users to know internal DB names while still prioritizing known domain entities.

### Google Routes / PTV / truck-aware routing

Current repository history references PTV/Valhalla/truck-aware routing, but the current active stack appears to have decommissioned Valhalla and Fastify route proxy in favor of Convex + Google. `services/simulator/openapi.json` still describes an older PTV route endpoint, but active Next/Convex code does not expose PTV.

Recommendation:

- **Phase 17 v1:** implement route geometry with Google Routes API through a server-side Next route or Convex action, then render the decoded polyline. This gets interactive route drawing working.
- **Truck-aware seam:** define `RouteProvider` interface now:

```ts
type RouteProvider = 'google_routes' | 'ptv' | 'cached_corridor';

type RouteGeometryResult = {
  provider: RouteProvider;
  encodedPolyline?: string;
  coordinates: Array<{ lat: number; lng: number }>;
  distanceM: number;
  durationS?: number;
  warnings: string[];
};
```

- Add PTV later behind the same interface if credentials/API path are available. Do not leak PTV calls to client; keep them server-side.
- Clearly label Google-derived routes as not truck-restriction-certified.
- For Class 8 feasibility, continue using FleetVolt physics + Class 8 charger classification as the differentiator.

---

## Technical Risks and Mitigations

| Risk | Severity | Why it matters | Mitigation |
|---|---:|---|---|
| Google vector Map ID missing or wrong | High | AdvancedMarker and cloud styling require a valid map ID; map tests may fail outside referrer allowlist. | Keep `MapTokenMissingBanner`; document required env; e2e skip with reason if tiles do not mount. |
| Continuing deprecated/direct marker code | Medium | `components/planner/route-map.tsx` and `heatmap.tsx` use direct `new google.maps.Map` + legacy `Marker`. | Do not extend these; replace with shared vis.gl canvas/layers. |
| Route geometry unavailable | High | `fetchRouteGeometry()` returns empty without old `API_URL`; full workbench depends on real polylines. | Implement `apps/web/src/lib/maps/google-routes.ts` and server/Convex route action early. |
| Google Routes is not true Class 8 truck routing | High | Users may assume truck-safe routes. | Add route provider warning; keep PTV/provider seam; validate against known corridors; label assumptions. |
| Places/Routes API cost and quota | Medium | Autocomplete and route recomputation can get expensive. | Debounce inputs; use session tokens for Places; bias/restrict geography; cache selected places and route results by hash. |
| Large layer performance | Medium/High | Thousands of markers/polylines can slow the map. | Fetch by bbox/zoom; cluster or aggregate; zoom-level layer swaps like `hotspot-map.tsx`; cap initial marker counts. |
| Convex document size / line geometry limits | Medium | Schema already notes Convex ~1MB doc guard for paths. | Keep simplified paths; query by bbox; render only visible segments; avoid shipping all highway segments at once. |
| Heatmap library not loaded | Low/Medium | `visualization` is not loaded by default. | Use `useMapsLibrary('visualization')` or `importLibrary('visualization')`; provide weighted-marker fallback. |
| AI output remains prose-first | High product risk | Product intent requires AI to operate map/layers/cards. | Change planner action output schema to structured `mapActions`, `layers`, `cards`, `draftPatch`; render cards first, prose second. |
| Mobile panel complexity | Medium | 3-column desktop workbench does not fit mobile. | Build bottom sheet/stepper from the start; test Driver mode at mobile widths. |
| Geocoding ambiguity | Medium | Ports/yards/carriers may be confused with generic Google places. | Local asset search first; show source badges; require user confirmation for ambiguous places. |
| Snapshot/export regression | Low | Google vector maps cannot provide canvas PNG like Mapbox. | Keep `captureSnapshot(): null`; if needed later, use Static Maps server render. |

---

## Recommended Phase 17 Task Breakdown

### P17-01 — Workbench shell and route entry points

Files:

- `apps/web/src/app/workbench/page.tsx`
- `apps/web/src/app/driver/day-plan/page.tsx`
- `apps/web/src/app/fleet/contract-plan/page.tsx`
- `apps/web/src/app/caas/gap-map/page.tsx`
- `apps/web/src/components/workbench/map-workbench/map-workbench-shell.tsx`

Acceptance:

- Dashboard CTAs launch the correct mode.
- Desktop fills available viewport; no centered `FramedPanel` max-width wrapper.
- Mobile shows map plus collapsed tools.

### P17-02 — Shared FleetVolt map canvas

Files:

- `apps/web/src/components/workbench/map-workbench/fleetvolt-map-canvas.tsx`
- `apps/web/src/components/workbench/map-workbench/layers/*.tsx`
- `apps/web/src/lib/maps/workbench-bounds.ts`

Acceptance:

- Uses `APIProvider`, vector `Map`, `AdvancedMarker`, existing missing-token fallback.
- Keeps map mounted across layer/selection changes.
- Has route polyline, charger marker, and selected asset card demo.

### P17-03 — Workbench state store

Files:

- `apps/web/src/stores/map-workbench-store.ts`
- `apps/web/src/components/workbench/map-workbench/types.ts`
- `apps/web/src/components/workbench/map-workbench/mode-config.ts`

Acceptance:

- Stores mode, draft route, active layers, selected asset, result cards, route geometry.
- Role/mode defaults are deterministic and testable.

### P17-04 — Autocomplete and asset lookup

Files:

- `apps/web/src/components/workbench/map-workbench/inputs/place-input.tsx`
- `apps/web/src/components/workbench/map-workbench/inputs/asset-autocomplete.tsx`
- `apps/web/src/lib/maps/google-places.ts`
- `apps/web/convex/workbench/queries.ts`

Acceptance:

- User can select ports/addresses/yards/chargers without DB knowledge.
- Places is geography-biased and debounced.
- Selected item normalizes into `WorkbenchPlace`.

### P17-05 — Route geometry provider

Files:

- `apps/web/src/lib/maps/google-routes.ts`
- `apps/web/src/app/api/maps/routes/route.ts` or `apps/web/convex/workbench/actions.ts`
- update `apps/web/src/lib/route-geometry.ts` or replace with new provider

Acceptance:

- Origin/destination produce real route polyline and distance.
- Route provider result includes warnings and provider name.
- Route line fits bounds and can be re-run without remounting map.

### P17-06 — Role-specific planner panels

Files:

- `apps/web/src/components/workbench/map-workbench/driver-day-plan-panel.tsx`
- `apps/web/src/components/workbench/map-workbench/fleet-contract-plan-panel.tsx`
- `apps/web/src/components/workbench/map-workbench/caas-gap-map-panel.tsx`

Acceptance:

- Driver: route + round trips + truck/workday constraints.
- Fleet: contract route + containers/day + schedule/gate/dwell/yard return.
- CaaS: click/choose origin + destination + gap radius/layers.

### P17-07 — Convex layer aggregation

Files:

- `apps/web/convex/workbench/queries.ts`
- `apps/web/convex/workbench/actions.ts`

Acceptance:

- Workbench can fetch visible chargers/carriers/parking/POIs/highways/geoRegions by bounds and mode.
- Query payloads are capped and shaped for rendering.
- Selected marker loads a metadata card.

### P17-08 — AI map actions instead of prose wall

Files:

- `apps/web/convex/planner.ts` or new `apps/web/convex/workbench/ai.ts`
- `apps/web/src/components/workbench/map-workbench/ai-command-bar.tsx`

Change current AI response shape toward:

```ts
type WorkbenchAiResult = {
  answerSummary: string;
  draftPatch?: Partial<WorkbenchPlanDraft>;
  mapActions: Array<
    | { type: 'set_origin'; place: WorkbenchPlace }
    | { type: 'set_destination'; place: WorkbenchPlace }
    | { type: 'toggle_layer'; layer: WorkbenchLayerId; enabled: boolean }
    | { type: 'focus_bounds'; bounds: google.maps.LatLngBoundsLiteral }
    | { type: 'select_asset'; selection: WorkbenchSelection }
  >;
  cards: WorkbenchResultCard[];
  queriesRun: QueryRun[];
};
```

Acceptance:

- Example CaaS prompt toggles gap/carrier layers and fills cards.
- Example Driver prompt builds route draft and charger layer.
- Prose is secondary to map/cards.

### P17-09 — Responsive/mobile bottom sheet

Files:

- `apps/web/src/components/workbench/map-workbench/mobile-workbench-sheet.tsx`

Acceptance:

- Mobile driver flow is usable with 44px+ touch targets.
- Desktop panels collapse cleanly at tablet sizes.
- Map remains primary visual surface.

### P17-10 — Testing and verification

Files:

- `apps/web/tests/map-workbench.spec.ts`
- unit tests for store/mode config/route geometry helpers

Acceptance:

- Typecheck passes.
- E2E gracefully skips live Google map if env/referrer allowlist is absent.
- Store tests verify mode defaults, layer toggles, and selection behavior.
- Route provider has mockable tests without real Google calls.

---

## Concrete Refactor Recommendations

1. **Do not keep extending `apps/web/src/app/planner/page.tsx` as the primary UX.** It can become a compatibility route that launches the workbench.
2. **Do not reuse `components/planner/route-map.tsx` or `components/planner/heatmap.tsx` directly.** They are useful prototypes but use direct map construction and legacy markers.
3. **Promote the best map code from `components/map/route-map.tsx`, `pulse-map.tsx`, and `hotspot-map.tsx` into shared workbench primitives.**
4. **Implement route geometry before polishing panels.** Without reliable polylines, the workbench will regress to prose/cards.
5. **Keep role dashboards as launchpads only.** Update CTAs:
   - Driver `/driver`: `Start Day Plan` → `/workbench?mode=driver_day_plan`
   - Fleet `/fleet`: `Plan Contract` or `Dispatch New Route` → `/workbench?mode=fleet_contract_plan`
   - CaaS `/caas`: `Find Charger Gaps` → `/workbench?mode=caas_gap_map`
6. **Make selected assets first-class.** Marker click should update store selection and open right card/sheet, not only an `InfoWindow`.
7. **Use local Convex data and Google Places together.** FleetVolt assets are more domain-relevant than generic Places predictions.
8. **Add provider/assumption labels everywhere.** Especially for Google route geometry vs truck-aware route feasibility.

---

## Suggested Initial File/Path Changes

High-priority creation:

```text
apps/web/src/app/workbench/page.tsx
apps/web/src/components/workbench/map-workbench/map-workbench-shell.tsx
apps/web/src/components/workbench/map-workbench/fleetvolt-map-canvas.tsx
apps/web/src/components/workbench/map-workbench/types.ts
apps/web/src/components/workbench/map-workbench/mode-config.ts
apps/web/src/stores/map-workbench-store.ts
apps/web/src/lib/maps/google-routes.ts
apps/web/src/lib/maps/google-places.ts
apps/web/convex/workbench/queries.ts
apps/web/convex/workbench/actions.ts
```

Likely modifications:

```text
apps/web/src/app/driver/page.tsx
apps/web/src/app/fleet/page.tsx
apps/web/src/app/caas/page.tsx
apps/web/src/app/planner/page.tsx
apps/web/src/components/planner/chat-panel.tsx
apps/web/src/lib/route-geometry.ts
```

Tests:

```text
apps/web/tests/map-workbench.spec.ts
apps/web/src/stores/map-workbench-store.test.ts
apps/web/src/lib/maps/google-routes.test.ts
```

---

## Definition of Done for Phase 17 MVP

A Phase 17 MVP is successful when:

- Driver, Fleet, and CaaS dashboards each launch into a full-viewport map workbench mode.
- User can set origin/destination using autocomplete or local assets.
- Real route geometry draws on a Google vector map.
- User can toggle at least chargers, parking/POIs, carriers, and gap layers.
- Clicking a charger/carrier/parking/POI/gap opens a structured metadata card or mobile sheet.
- Driver mode can produce a day-plan feasibility card with charge stops.
- Fleet mode can produce a contract-plan summary with trucks/drivers/charge events, even if v1 uses simple assumptions.
- CaaS mode can show route-based Class 8 charger gap and target carriers.
- Desktop uses the full viewport; mobile uses bottom sheet/stepper.
- AI command path returns map actions/cards instead of only prose.
- Missing API keys and Google referrer allowlist issues degrade gracefully.

---

## Research Sources Consulted

Project files:

- `.planning/phases/17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map/CONTEXT.md`
- `.planning/research/ROLE-MAP-WORKBENCH-INTERVIEW.md`
- `.planning/research/UX-NAVIGATION-RESEARCH.md`
- `.planning/research/UX-AUDIT-FULL.md`
- `apps/web/package.json`
- `apps/web/src/components/map/route-map.tsx`
- `apps/web/src/components/pulse/pulse-map.tsx`
- `apps/web/src/components/hotspot/hotspot-map.tsx`
- `apps/web/src/components/planner/route-map.tsx`
- `apps/web/src/components/planner/heatmap.tsx`
- `apps/web/src/components/planner/chat-panel.tsx`
- `apps/web/src/app/planner/page.tsx`
- `apps/web/src/components/nav/app-shell.tsx`
- `apps/web/src/lib/route-geometry.ts`
- `apps/web/src/lib/map-ref.ts`
- `apps/web/src/stores/scenario-store.ts`
- `apps/web/convex/schema.ts`
- `apps/web/convex/planner.ts`
- `apps/web/convex/chargers/queries.ts`
- `apps/web/convex/carriers/queries.ts`
- `apps/web/convex/pois/queries.ts`
- `apps/web/convex/highways/queries.ts`
- `apps/web/convex/geo/queries.ts`

External docs:

- `@vis.gl/react-google-maps` documentation — React wrapper design philosophy and map state synchronization.
- Google Maps JavaScript API docs — Advanced Markers, Places Autocomplete, Geocoding, libraries/importLibrary, Heatmap Layer.
- Google Routes API docs — Compute Routes and Compute Route Matrix.
