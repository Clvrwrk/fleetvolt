---
status: awaiting_human_verify
trigger: "CaaS sidebar lacks approved drawer menus; geo overlays, POI filters, GAP and heat controls are inert or absent; POI, charger, and parking markers/cards expose incorrect semantics and internal fields."
created: 2026-07-12T16:32:00-07:00
updated: 2026-07-13T15:30:00-07:00
---

# CaaS control and data recovery

## Symptoms

- expected_behavior: The CaaS workbench uses the approved catalog-style sliding drawer controls; Air District, County, and ZIP overlays are selectable; every layer/filter changes the map; traffic-generator POIs have verified PTV routes in the route catalog; GAP and heat layers render explainable data; marker types and detail cards use role-relevant semantics.
- actual_behavior: The legacy vertically scrolling sidebar remains. Geographic overlays are missing or deferred. POI traffic generators are not bound to a dedicated filter or route catalog. GAP and heat controls do not visibly change the map. POI markers are generic. Cards expose Convex IDs and raw OSM structures, and charger/parking detail semantics are incomplete.
- error_messages: No primary runtime exception; defects are missing behavior, disconnected controls, missing data, and incorrect information architecture.
- timeline: Reconfirmed during Chris's localhost review on 2026-07-12 after authentication and Google Maps were repaired.
- reproduction: Open `http://localhost:3100/caas`, inspect the sidebar, toggle geographic/GAP/heat/icon controls, select POI/charger/parking markers, and inspect the route catalog and detail cards.

## Current Focus

- hypothesis: The connected controls, authoritative geography, semantic markers/cards, and first persisted GAP candidate now satisfy the code/data recovery scope; remaining uncertainty is authenticated local visual interaction.
- test: Chris opens the signed-in localhost CaaS workbench, opens both stack drawers, toggles all three geographic overlays, Class 8 GAP, CaaS zones, POIs, chargers, and parking, then selects representative pins.
- expecting: Drawers slide from the rail without vertical menu scrolling; layers visibly change; Buttonwillow GAP opens an evidence card; marker/card taxonomy matches the approved language; no internal IDs appear.
- next_action: Obtain the required human visual checkpoint and ScreenshotOne receipts; continue the measured 63-route PTV backlog one audited route per invocation.
- reasoning_checkpoint:
    hypothesis: "The Heat map / CaaS zones control changes Zustand state but cannot change rendered map data because the canvas excludes `caas-zones` from `visibleLayers` arguments and excludes `assets.caasZones` from its map-asset merge."
    confirming_evidence:
      - "`role-layers.ts` defines the control as layer id `caas-zones`, and `toggleLayer` persists that id in `activeLayers`."
      - "`workbench/queries:visibleLayers` conditionally reads `caasDeploymentZones` and returns mapped `assets.caasZones` when requested."
      - "`FleetVoltMapCanvas` restricts `overviewLayers` to chargers/parking/carriers/pois/fleet-yards and builds `fromQuery` from only those five arrays, so no CaaS zone can reach `AssetMarkerLayer`."
    falsification_test: "If a focused adapter test shows `caas-zones` is already included in query layers and returned `caasZones` already becomes a `caas-zone` map asset, this hypothesis is false."
    fix_rationale: "Repairing both adapter boundaries reconnects the existing control, Convex contract, marker renderer, and selected-card path without inventing fallback data or changing unrelated UI."
    blind_spots: "This slice does not prove production has populated `caasDeploymentZones`, does not redesign the approved drawer, and does not yet replace generic CaaS-zone cards with a domain-specific view model."
- tdd_checkpoint: false

## Evidence

- timestamp: 2026-07-12T16:32:00-07:00
  observation: Four localhost screenshots show the legacy sidebar, generic POI markers, raw Convex/OSM card fields, and traffic-generator cards without route evidence.

- timestamp: 2026-07-12T17:18:00-07:00
  checked: Catalog filter drawer versus CaaS workbench shell.
  found: `catalog-filters.tsx` implements a fixed, animated rail-triggered drawer; `map-workbench-shell.tsx` still embeds the 969-line `WorkbenchLeftPanel` inside a vertically scrolling accordion.
  implication: The approved control IA was not ported; this is an independent presentation slice, not the cause of every inert map control.

- timestamp: 2026-07-12T17:20:00-07:00
  checked: Layer and filter state from CaaS controls through Zustand and canvas consumers.
  found: Layer toggles use authoritative `activeLayers`; current uncommitted recovery work also moves dataset filters from local component state to Zustand and applies them to canvas assets.
  implication: A single global state failure is ruled out. Each inert control must be traced through its own query/render boundary, while preserving the existing filter recovery changes.

- timestamp: 2026-07-12T17:22:00-07:00
  checked: Heat/CaaS-zone path from role catalog through `visibleLayers` and `FleetVoltMapCanvas`.
  found: `caas-zones` is an allowed/toggleable layer and Convex returns `assets.caasZones`, but the canvas neither requests `caas-zones` nor merges `live.caasZones`.
  implication: The heat control has a confirmed two-boundary data plumbing defect; it is the smallest independently verifiable vertical repair slice.

- timestamp: 2026-07-12T17:24:00-07:00
  checked: Geographic overlay query and renderer.
  found: County and ZCTA rows can include rings, but air-district rows explicitly defer true polygons and return no ring; `CaasChoroplethLayer` only constructs polygons from `ring`, leaving air districts as centroid labels.
  implication: Air District coverage is a data/geometry contract gap; County/ZIP population depends on ingest coverage and should be verified separately.

- timestamp: 2026-07-12T17:25:00-07:00
  checked: Traffic-generator controls, markers, and route catalog.
  found: Statewide generator markers render whenever CaaS data layers are shown, ignoring the `pois` layer; selected-port generator markers receive no selection callback; marker text is the generic `POI`; route catalog population requires explicit one-generator `precomputeFreightPoi` actions and exposes only successfully persisted promoted rows.
  implication: POI visibility, marker semantics/selection, and route provisioning are three separate remaining slices.

- timestamp: 2026-07-12T17:27:00-07:00
  checked: Asset-to-card contract for charger, parking, POI, and CaaS zone.
  found: Query mappers include `convexId`, `osmKey`, raw `tags`, and other storage fields; `SelectedAssetCard` generically enumerates the first six metadata entries except two presentation keys.
  implication: Raw internal fields are exposed by design of the current generic metadata path; typed role-specific card view models/sanitization are required after layer data is reliably connected.

- timestamp: 2026-07-12T17:34:00-07:00
  checked: Counterfactual repair for the heat-layer adapter boundary.
  found: The new adapter requests `caas-zones` iff active and flattens returned `caasZones` into `caas-zone` map assets; focused tests passed 19/19 and TypeScript passed.
  implication: The code-level causal chain is repaired without changing Convex schema/query behavior or unrelated UI.

- timestamp: 2026-07-12T17:36:00-07:00
  checked: Full web unit regression suite and diff hygiene.
  found: 255/255 tests passed, 0 failures; `git diff --check` passed for the bounded slice and debug session.
  implication: Adjacent unit-tested state/filter/map adapter behavior remains intact; browser verification with populated deployment-zone data is still required.

- timestamp: 2026-07-12T17:49:00-07:00
  checked: Statewide and selected-port traffic-generator marker paths.
  found: Generator visibility now obeys the `pois` layer, both marker paths emit the same typed selection, selected-port markers open details, and statewide markers are suppressed while a port-focused set is active.
  implication: POI filter behavior no longer leaves independent traffic-generator markers behind; semantic card sanitization and verified route provisioning remain separate slices.

- timestamp: 2026-07-12T17:31:00-07:00
  checked: Authoritative geographic geometry and deployed coverage.
  found: CARB Air District geometry is deployed for 35 districts/47 rings; Census county geometry is deployed for 58 counties/68 rings; 1,802 ZCTA geometries are populated and county-contextualized.
  implication: Air District, County, and ZIP controls now select real polygon geometry rather than bounding-box or centroid substitutes.

- timestamp: 2026-07-12T17:33:00-07:00
  checked: Charger, POI, parking marker taxonomy and selected-card projection.
  found: A typed presentation adapter now enforces charger bolt truth states, POI-specific icons/labels/colors, connector-count inventory, connector/tag/amenity pills, and suppression of Convex/storage keys. Focused tests passed 10/10.
  implication: User-facing map semantics no longer depend on raw metadata enumeration.

- timestamp: 2026-07-12T17:35:00-07:00
  checked: Persisted GAP/heat data and evidence.
  found: `caasDeploymentZones` was empty. FleetVolt data identified Buttonwillow Northbound/Southbound rest areas with 66 truck spaces and no verified Class 8 charger within 10 miles. One high-priority modeled candidate was persisted with a 750 kW screening recommendation and explicit validation caveats; both Class 8 GAP and CaaS-zone payloads now return it.
  implication: The controls now have honest persisted data and no longer appear inert, while route-specific SoC timing remains explicitly deferred until a route is selected.

- timestamp: 2026-07-12T17:36:00-07:00
  checked: Traffic-generator PTV catalog completeness.
  found: Coverage gate measured 5/69 verified PTV routes. One audited `precomputeFreightPoi` invocation added MTG-1 with 225 road points and persisted geometry/enrichment receipts; coverage is now 6/69, 63 missing, 0 invalid.
  implication: The gap is quantified and safely resumable; no mass provider pull was hidden behind a bulk action.

- timestamp: 2026-07-12T17:37:00-07:00
  checked: Approved catalog-style drawer interaction port.
  found: The rail now exposes Map Layers and Dataset Filters as left-to-right sliding drawers, contains the Air District/County/ZIP selector, persists toggles through the existing store, uses a 16px text floor, and removes duplicated layer/filter controls from the scrolling input panel.
  implication: The visible sidebar control architecture matches the approved interaction model without duplicating consumers.

- timestamp: 2026-07-12T17:38:00-07:00
  checked: Full web regression suite and static gates after all recovery slices.
  found: ESLint, TypeScript, and diff hygiene passed; the full web unit suite passed 262/262 tests with 0 failures.
  implication: The recovery is ready for authenticated localhost visual verification, not yet for a claim of completed human/ScreenshotOne approval.

- timestamp: 2026-07-12T18:55:00-07:00
  checked: Polygon distortion, Dataset Filters, route-focus persistence, live KPI truth, GAP/heat semantics, freight traffic rendering, and user-facing route-card data.
  found: County/ZCTA preprocessing truncated rings instead of sampling the full closed perimeter; CARB simplification also lacked topology preservation. All three pipelines now preserve complete rings and the deployed 35/58/1,802 geometry rows were regenerated. Dataset Filters were deleted end-to-end after approval because their original Phase 17 implementation only wrote draft metadata and never filtered map evidence. Route focus is now independent of selected cards, CaaS zones render as radius heat circles while GAPs remain discrete candidates, live Convex summary reports 13 Class-8-friendly chargers and 69 generators, Truck Traffic drives the live AADT flow surface, fabricated sample pins are removed, and route cards suppress request hashes in favor of PTV/road/traffic/charging/freshness facts.
  implication: The misalignment, misleading filter, route-selection reset, sample-data, and internal-card-field defects are repaired. Route emissions, the 63 missing generator PTV routes, and the route-builder drawer remain explicit backlog rather than falsely completed behavior.

- timestamp: 2026-07-12T18:57:00-07:00
  checked: Automated and authenticated browser gates after the final card sanitization.
  found: ESLint, TypeScript without incremental output, and diff hygiene passed. The full web suite passed 258/258 tests. The signed-in localhost browser loaded the live data card (13 chargers, 69 generators), the approved Map Layers drawer, all three geographic selectors, cached PTV routes, and a route card containing no internal request hash; browser console reported no warnings or errors.
  implication: The bounded repair has both static/regression evidence and direct authenticated browser evidence. ScreenshotOne remains unavailable in this harness, so browser-captured evidence is stored separately for human review.

- timestamp: 2026-07-12T19:08:00-07:00
  checked: Long-route GAP rendering and route-focus persistence in the authenticated localhost browser.
  found: Port Hueneme → Bakersfield QDC produced two live modeled GAP candidates (Tejon Pass northbound/southbound). The candidates were initially hidden because catalog focus left only the Route layer active; generated GAP evidence now automatically activates the Class 8 GAP layer. Selecting the Southbound candidate left the `Show all map layers` focus exit present and opened its full evidence card. The workbench root also changed from `overflow-hidden` to `overflow-clip`, preventing nested-control focus from programmatically scrolling the entire map viewport out of frame.
  implication: GAP generation, GAP visibility, click-through evidence, persistent route focus, and full-height viewport behavior now pass direct interaction checks.

- timestamp: 2026-07-12T20:14:00-07:00
  checked: California State Geoportal county and ZIP source replacement.
  found: The new EPSG:4326 exports produced 58 county geometries and 1,746 routable California ZIP geometries; 32 synthetic `000xx` service areas were excluded. Convex patched all 58 counties, upserted all 1,746 ZIP rows, and authoritative reconciliation deleted 73 stale or non-source ZIP rows. Live samples now report `CA_Geoportal` provenance with `ca_geoportal_county_identifiers` / `ca_geoportal_esri_zip_areas` match methods.
  implication: County and ZIP overlays no longer depend on the prior Census boundary files, and the deployed table exactly matches the current California source rather than accumulating stale polygons.

- timestamp: 2026-07-12T20:18:00-07:00
  checked: NTAD Alternative Fuel Corridors source inventory.
  found: `data/raw/NATD/NTAD_Alternative_Fuel_Corridors_-8402325955190590810.geojson` is EPSG:4326 with 2,275 national LineString features, including 352 California segments and explicit EV/CNG/LNG/propane/hydrogen readiness fields.
  implication: The GeoJSON is accepted as the canonical input for a separate Alternative Fuel Corridors transportation layer; it must not be conflated with the administrative polygon overlays.

- timestamp: 2026-07-12T20:22:00-07:00
  checked: Post-replacement static and regression gates.
  found: Focused ESLint, non-incremental TypeScript, `git diff --check`, and the full 258-test web unit suite all passed with zero failures after the California Geoportal provenance/schema/loader changes.
  implication: The source replacement did not regress the tested workbench, route, map-geometry, provenance, export, or authentication contracts.

- timestamp: 2026-07-13T15:30:00-07:00
  checked: Homepage lane routing, first-load map state, live KPI isolation, carrier detail projection, retired heat surface, catalog return flow, and alpha-auth console behavior.
  found: The homepage now has one Executive Briefing CTA and a separate active CaaS Intelligence lane. The map gates first paint on Google tile and Convex-data readiness behind the FleetVolt loader. KPI buttons isolate 13 Class-8-capable chargers or 69 traffic generators; the charger query now prioritizes the 13 qualifying records before applying its row limit. The one-circle Buttonwillow pseudo-heatmap was removed because it duplicated a single GAP instead of representing a comparative scored surface. Carrier ingestion preserved source contact and phone values, patched 1,823 development records without rebuilding unchanged geospatial points, and the browser card showed Douglas A. Brown / (760) 937-7963 with no carrier key. Catalog detail → catalog → Back to workbench returned deterministically to `/caas`. Alpha bypass no longer boots AuthKit or emits hidden server-action 500s.
  implication: The current review branch addresses the user-visible defects without fabricating missing carrier email, website, or tractor-count fields. A future heat surface must contain multiple comparable scored cells, and Google Places Autocomplete deprecation warnings remain a separate migration item.

- timestamp: 2026-07-13T15:31:00-07:00
  checked: Focused regression and fresh-browser console gate.
  found: TypeScript, `git diff --check`, and 21 focused unit tests passed. A fresh `http://localhost:3100/caas` browser load produced zero console errors; only Google Places legacy API and unused development-font preload warnings remained.
  implication: The bounded branch is ready for PR review and human visual verification at the localhost gate.

## Eliminated

- hypothesis: All inert CaaS controls are caused by local-only sidebar state.
  evidence: Layer controls already mutate shared Zustand state, and geo/corridor controls have dedicated shared setters consumed by map layers; failures diverge later at per-layer data/render boundaries.
  timestamp: 2026-07-12T17:20:00-07:00

- hypothesis: The backend lacks any CaaS deployment-zone contract, so the heat control can only be a placeholder.
  evidence: `visibleLayers` already reads `caasDeploymentZones`, maps them through `caasZoneAsset`, and returns `assets.caasZones`; the frontend drops this existing contract.
  timestamp: 2026-07-12T17:22:00-07:00

## Resolution

- root_cause: The CaaS UI combined several independent incomplete boundaries: heat/GAP data was absent or dropped by the frontend adapter; authoritative geographic geometry was not fully deployed; traffic generators bypassed POI visibility/selection and mostly lacked catalog routes; generic markers/cards leaked storage metadata; and the approved drawer IA had never been ported from the catalog.
- fix: Reconnected CaaS/GAP query assets, deployed CARB plus California State Geoportal county/ZIP geometry, bound every traffic-generator marker to the POI layer and typed selection, added audited PTV coverage/provisioning, created semantic marker/card projections, seeded one evidence-backed Buttonwillow GAP/heat candidate, and ported the approved stack drawers while removing duplicate controls.
- verification: ESLint, TypeScript (non-incremental), and `git diff --check` passed before the source replacement. Convex coverage now reports 35 Air Districts, 58 California Geoportal counties, exactly 1,746 California Geoportal ZIPs, one persisted statewide GAP/CaaS candidate, 13 Class-8-friendly chargers, 69 traffic generators, and 6/69 verified PTV generator routes. Browser verification confirmed the County selector state against the live deployment; full post-replacement regression is recorded separately below.
- files_changed:
    - apps/web/src/components/workbench/map-workbench/fleetvolt-map-canvas.tsx
    - apps/web/src/lib/workbench/caas-visible-assets.ts
    - apps/web/src/lib/workbench/caas-visible-assets.test.ts
    - apps/web/src/components/workbench/map-workbench/layers/generator-spokes-layer.tsx
    - apps/web/src/components/workbench/map-workbench/layers/generator-markers.tsx
    - apps/web/src/lib/workbench/traffic-generator-selection.ts
    - apps/web/src/lib/workbench/traffic-generator-selection.test.ts
    - apps/web/src/components/workbench/map-workbench/layers/asset-marker-layer.tsx
    - apps/web/src/components/workbench/map-workbench/layers/selected-asset-card.tsx
    - apps/web/src/components/workbench/map-workbench/workbench-rail-nav.tsx
    - apps/web/src/components/workbench/map-workbench/workbench-left-panel.tsx
    - apps/web/src/lib/workbench/asset-presentation.ts
    - apps/web/src/lib/workbench/asset-presentation.test.ts
    - apps/web/convex/routes/catalog.ts
    - apps/web/convex/workbench/queries.ts

## Dependency-ordered diagnosis / fix map

1. Reconnect existing typed layer contracts to controls and renderers: first `caas-zones`; then make generator visibility obey `pois` and verify county/ZIP ingest-backed geometry.
2. Supply missing geographic truth: ingest/return true Air District polygons (and verify County/ZCTA population) rather than centroid-only labels or bbox approximations.
3. Provision auditable traffic-generator road routes: run the one-generator PTV precompute workflow for the curated set and expose route evidence from generator selection into the catalog.
4. Replace generic POI/charger/parking markers with domain semantics and make both statewide and selected-port generator markers select the same typed asset.
5. Introduce typed selected-asset view models that suppress `convexId`, raw OSM structures, and storage keys while presenting charger, parking, generator, route, and zone decisions.
6. Port the proven catalog fixed-drawer interaction into the CaaS rail after controls have authoritative connected consumers; remove duplicated vertically scrolling controls and add desktop visual/interaction coverage.
