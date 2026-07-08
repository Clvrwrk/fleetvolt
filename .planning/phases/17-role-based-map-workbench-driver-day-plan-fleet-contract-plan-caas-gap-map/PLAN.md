---
phase: 17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map
plan: 00
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/web/src/app/workbench/page.tsx
  - apps/web/src/app/driver/day-plan/page.tsx
  - apps/web/src/app/fleet/contract-plan/page.tsx
  - apps/web/src/app/caas/gap-map/page.tsx
  - apps/web/src/app/planner/page.tsx
  - apps/web/src/app/driver/page.tsx
  - apps/web/src/app/fleet/page.tsx
  - apps/web/src/app/caas/page.tsx
  - apps/web/src/components/nav/use-role-nav.ts
  - apps/web/src/components/workbench/map-workbench/map-workbench-shell.tsx
  - apps/web/src/components/workbench/map-workbench/fleetvolt-map-canvas.tsx
  - apps/web/src/components/workbench/map-workbench/workbench-left-panel.tsx
  - apps/web/src/components/workbench/map-workbench/workbench-right-panel.tsx
  - apps/web/src/components/workbench/map-workbench/mobile-workbench-sheet.tsx
  - apps/web/src/components/workbench/map-workbench/mode-config.ts
  - apps/web/src/components/workbench/map-workbench/types.ts
  - apps/web/src/components/workbench/map-workbench/layers/route-layer.tsx
  - apps/web/src/components/workbench/map-workbench/layers/asset-marker-layer.tsx
  - apps/web/src/components/workbench/map-workbench/layers/geo-region-layer.tsx
  - apps/web/src/components/workbench/map-workbench/layers/selected-asset-card.tsx
  - apps/web/src/components/workbench/map-workbench/inputs/place-input.tsx
  - apps/web/src/components/workbench/map-workbench/inputs/route-builder.tsx
  - apps/web/src/components/workbench/map-workbench/inputs/truck-profile-select.tsx
  - apps/web/src/components/workbench/map-workbench/inputs/workday-constraints.tsx
  - apps/web/src/components/workbench/map-workbench/inputs/contract-constraints.tsx
  - apps/web/src/components/workbench/map-workbench/ai-command-bar.tsx
  - apps/web/src/stores/map-workbench-store.ts
  - apps/web/src/stores/map-workbench-store.test.ts
  - apps/web/src/lib/maps/google-places.ts
  - apps/web/src/lib/maps/google-routes.ts
  - apps/web/src/lib/maps/google-routes.test.ts
  - apps/web/convex/workbench/queries.ts
  - apps/web/convex/workbench/actions.ts
  - apps/web/convex/workbench/ai.ts
  - apps/web/convex/planner.ts
  - apps/web/tests/map-workbench.spec.ts
  - apps/web/tests/map-workbench-screenshots.spec.ts
autonomous: true
requirements:
  - WB-01-DASHBOARD-LAUNCHPAD
  - WB-02-FULL-VIEWPORT-MAP
  - WB-03-ROLE-LEFT-TOOLS
  - WB-04-AUTOCOMPLETE
  - WB-05-ASSET-LAYERS
  - WB-06-DRIVER-DAY-PLAN
  - WB-07-FLEET-CONTRACT-PLAN
  - WB-08-CAAS-DRILLDOWN
  - WB-09-CAAS-GAP-OPPORTUNITY
  - WB-10-MAP-FIRST-AI
user_setup:
  - Ensure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and NEXT_PUBLIC_GOOGLE_MAP_ID are available for live map screenshots; automated tests must skip with a clear reason if missing/referrer-blocked.
  - Ensure server-side Google Routes/Places key is configured before live route-provider verification; helper tests must mock the provider and not require billing.
must_haves:
  truths:
    - Dashboards are launchpads; the primary tool surface is a full-viewport map workbench, not centered cards or prose-first chat.
    - Use existing Google Maps / @vis.gl patterns and Convex data; do not revive old direct window.google planner maps or deprecated google.maps.Marker.
    - MVP is vertical by role: every mode must go from dashboard CTA to map inputs to route/layer/result cards, even if v1 calculations use transparent assumptions.
    - AI output must become draft patches, map actions, overlays, pins, and cards; prose is secondary.
    - Google Routes geometry is not certified truck routing; UI must label provider assumptions and leave a PTV/truck-route seam.
  artifacts:
    - Hybrid /workbench route architecture implemented with role-specific launcher routes.
    - Shared workbench shell, map canvas, state store, route provider, autocomplete, Convex aggregation, role panels, AI map actions, tests.
  key_links:
    - .planning/phases/17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map/CONTEXT.md
    - .planning/phases/17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map/PATTERNS.md
    - .planning/phases/17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map/RESEARCH.md
    - .planning/research/ROLE-MAP-WORKBENCH-INTERVIEW.md
    - .planning/research/UX-NAVIGATION-RESEARCH.md
    - .planning/research/UX-AUDIT-FULL.md
    - apps/web/src/components/map/route-map.tsx
    - apps/web/src/components/hotspot/hotspot-map.tsx
    - apps/web/convex/chargers/queries.ts
    - apps/web/convex/report.ts
---

<objective>
Build Phase 17 as a map-first product correction: Driver, Fleet Manager, and CaaS dashboards become launchpads into role-specific, full-viewport Google Maps workbench modes. The plan intentionally chooses a **hybrid route architecture**: one shared canonical `/workbench?mode=driver_day_plan|fleet_contract_plan|caas_gap_map` implementation plus semantic role launcher routes (`/driver/day-plan`, `/fleet/contract-plan`, `/caas/gap-map`) that redirect/render the same workbench mode. This avoids three divergent map stacks while preserving clear role URLs, auth/nav semantics, screenshot targets, and future shareable `/workbench/plan/[planId]` links.
</objective>

<execution_context>
Current state verified from source: `/planner` is still a centered `FramedPanel` with chat in the center and static preview KPIs; role dashboards link to `/planner`; Phase 16 AppShell/sidebar/mobile-tab foundations exist; preferred maps are `@vis.gl/react-google-maps` vector maps in `components/map/route-map.tsx` and `components/hotspot/hotspot-map.tsx`; Convex already exposes chargers, carriers, POIs/parking, geo regions, hotspot reports, planner action, and physics simulation. `apps/web/package.json` has `typecheck`, `test`, and `test:e2e` scripts. Existing Playwright config and scenario tests exist, so workbench tests should extend them rather than create a new runner.

Architecture decision: **hybrid route architecture**.
- Rejected shared-only `/workbench`: simplest code, but screenshots, role nav, browser history, and deep links lose role meaning; dashboards would all point at generic URLs.
- Rejected separate role routes with separate implementations: clear URLs, but repeats map canvas, panels, state, AI, autocomplete, route provider, and Convex layer logic; highest regression risk.
- Selected hybrid: semantic role routes are thin launchers, `/workbench` owns the implementation and accepts mode/search params. Tests assert all launchers land in the same workbench component with role-specific copy, layers, and panel defaults.
</execution_context>

<context>
@.planning/phases/17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map/CONTEXT.md
@.planning/phases/17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map/PATTERNS.md
@.planning/phases/17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map/RESEARCH.md
@.planning/research/ROLE-MAP-WORKBENCH-INTERVIEW.md
@.planning/research/UX-NAVIGATION-RESEARCH.md
@.planning/research/UX-AUDIT-FULL.md
@.planning/research/UX-VISUAL-COMPARISON.md
@apps/web/src/app/planner/page.tsx
@apps/web/src/app/driver/page.tsx
@apps/web/src/app/fleet/page.tsx
@apps/web/src/app/caas/page.tsx
@apps/web/src/components/map/route-map.tsx
@apps/web/src/components/hotspot/hotspot-map.tsx
@apps/web/convex/chargers/queries.ts
@apps/web/convex/carriers/queries.ts
@apps/web/convex/pois/queries.ts
@apps/web/convex/geo/queries.ts
@apps/web/convex/report.ts
@apps/web/convex/planner.ts
@apps/web/convex/physics/simulate.ts
</context>

<tasks>

## Wave 0 — Architecture skeleton, contracts, and launchers

<task type="auto" id="17-01">
<name>Hybrid route skeleton and dashboard launchpad CTAs</name>
<files>apps/web/src/app/workbench/page.tsx; apps/web/src/app/driver/day-plan/page.tsx; apps/web/src/app/fleet/contract-plan/page.tsx; apps/web/src/app/caas/gap-map/page.tsx; apps/web/src/app/planner/page.tsx; apps/web/src/app/driver/page.tsx; apps/web/src/app/fleet/page.tsx; apps/web/src/app/caas/page.tsx; apps/web/src/components/nav/use-role-nav.ts</files>
<action>Create `/workbench` as the canonical client page that parses a `mode` search param and renders `MapWorkbenchShell`. Add thin role launcher pages for `/driver/day-plan`, `/fleet/contract-plan`, and `/caas/gap-map` that set the correct mode without duplicating implementation. Change dashboard CTAs to exactly: Driver `Start Day Plan`, Fleet `Plan Contract`, CaaS `Find Charger Gaps`. Keep `/planner` as a compatibility redirect/launcher to `/workbench?mode=caas_gap_map` or a concise deprecation page with one CTA; do not keep it as the primary work surface. Update role nav items that currently point at `/planner` to point at role launchers.</action>
<verify><automated>cd apps/web && pnpm typecheck</automated></verify>
<done>All three dashboards have one dominant planning CTA and open a full-viewport workbench mode; `/planner` no longer presents the centered chat/card surface as the primary UX. Covers WB-01 and seeds WB-02.</done>
</task>

<task type="auto" id="17-02">
<name>Workbench contracts, mode defaults, and store tests</name>
<files>apps/web/src/components/workbench/map-workbench/types.ts; apps/web/src/components/workbench/map-workbench/mode-config.ts; apps/web/src/stores/map-workbench-store.ts; apps/web/src/stores/map-workbench-store.test.ts</files>
<action>Define `WorkbenchMode`, `WorkbenchPlace`, `WorkbenchLayerId`, `WorkbenchSelection`, `WorkbenchPlanDraft`, `WorkbenchResultCard`, `RouteGeometryResult`, and `WorkbenchAiResult`. Build mode config for the three modes: driver defaults route/chargers/parking/pois; fleet defaults route/chargers/fleet-yards/pois/highways; CaaS defaults geo-regions/class8-gaps/carriers/parking/freight-flow/caas-zones. Implement a Zustand store with mode, draft, activeLayers, selectedAsset, routeGeometry, resultCards, providerWarnings, and reset/applyDraftPatch/toggleLayer/selectAsset actions.</action>
<verify><automated>cd apps/web && pnpm test -- src/stores/map-workbench-store.test.ts</automated></verify>
<done>Store tests prove deterministic role defaults, layer toggles, selected-asset behavior, draft patching, and mode resets. Covers WB-03, WB-05, WB-10 foundations.</done>
</task>

<task type="auto" id="17-03">
<name>Full-viewport workbench shell and responsive panel slots</name>
<files>apps/web/src/components/workbench/map-workbench/map-workbench-shell.tsx; apps/web/src/components/workbench/map-workbench/workbench-left-panel.tsx; apps/web/src/components/workbench/map-workbench/workbench-right-panel.tsx; apps/web/src/components/workbench/map-workbench/mobile-workbench-sheet.tsx; apps/web/src/components/nav/app-shell.tsx</files>
<action>Build a shell that uses the AppShell content area but avoids `FramedPanel`, `max-w-*`, and page-centered padding. Desktop layout should be `h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden` with grid columns for left tools, map, and collapsible right cards. Mobile layout should make the map the primary visual surface and collapse tools/results into a bottom sheet or stepper with 44px+ touch targets. Include `data-testid` hooks: `map-workbench-shell`, `workbench-left-panel`, `fleetvolt-map-canvas-slot`, `workbench-right-panel`, `mobile-workbench-sheet`.</action>
<verify><automated>cd apps/web && pnpm typecheck</automated></verify>
<done>Desktop screenshots show map work surface dominates the viewport; mobile screenshots show map plus collapsed tools, not a three-column squeeze. Covers WB-02 and WB-03.</done>
</task>

## Wave 1 — Shared map canvas, route provider, autocomplete, and Convex layer aggregation

<task type="auto" id="17-04" depends_on="17-01,17-02,17-03">
<name>Shared vector Google map canvas and reusable layers</name>
<files>apps/web/src/components/workbench/map-workbench/fleetvolt-map-canvas.tsx; apps/web/src/components/workbench/map-workbench/layers/route-layer.tsx; apps/web/src/components/workbench/map-workbench/layers/asset-marker-layer.tsx; apps/web/src/components/workbench/map-workbench/layers/geo-region-layer.tsx; apps/web/src/components/workbench/map-workbench/layers/selected-asset-card.tsx</files>
<action>Promote the proven `@vis.gl/react-google-maps` pattern into a shared canvas: `APIProvider`, vector `Map`, `RenderingType.VECTOR`, `gestureHandling="greedy"`, `disableDefaultUI`, `MapTokenMissingBanner` fallback, and imperative children using `useMap()`. Use `AdvancedMarker` for all clickable assets and `google.maps.Polyline` only inside map children for route/flow lines. Keep the mounted `Map` stable across mode changes, layer toggles, route recalculation, and asset selection. Do not import `components/planner/route-map.tsx` or `components/planner/heatmap.tsx` into new workbench code.</action>
<verify><automated>cd apps/web && pnpm typecheck</automated></verify>
<done>Canvas renders token fallback without crashing; with map env it mounts one vector map, shows route and sample/queried asset layers, and marker clicks open structured cards. Covers WB-05.</done>
</task>

<task type="auto" id="17-05" depends_on="17-02">
<name>Google Routes provider with honest truck-routing seam</name>
<files>apps/web/src/lib/maps/google-routes.ts; apps/web/src/lib/maps/google-routes.test.ts; apps/web/convex/workbench/actions.ts</files>
<action>Implement a route geometry provider behind a small interface returning provider name, decoded coordinates, distance, duration, encoded polyline when available, and warnings. Use Google Routes for MVP geometry through a server/Convex action so API keys are not leaked. Add explicit warnings such as `Google route geometry is not truck-restriction-certified`; leave provider enum/seam for future `ptv`. Cache or hash requests to avoid repeated paid calls. Unit tests must mock fetch and verify decoding, warning propagation, empty/error fallback, and no secret leakage.</action>
<verify><automated>cd apps/web && pnpm test -- src/lib/maps/google-routes.test.ts && CONVEX_TMPDIR="$PWD/.convex-tmp" npx convex codegen && pnpm typecheck</automated></verify>
<done>Origin/destination can produce real route geometry when configured; tests pass without live Google calls; UI can display provider assumptions. Covers WB-05, WB-06, WB-07, WB-09.</done>
</task>

<task type="auto" id="17-06" depends_on="17-02">
<name>Place and FleetVolt asset autocomplete</name>
<files>apps/web/src/components/workbench/map-workbench/inputs/place-input.tsx; apps/web/src/components/workbench/map-workbench/inputs/route-builder.tsx; apps/web/src/lib/maps/google-places.ts; apps/web/convex/workbench/queries.ts</files>
<action>Create a `PlaceInput` that normalizes local Convex assets and Google Places selections into `WorkbenchPlace`. Query local ports/chargers/carriers/parking/POIs/fleet lots first or alongside Places and show source badges so users do not need internal DB names. Use Places session tokens, debounce, and California/port-region bias. Include manual coordinate fallback and ambiguous-selection confirmation.</action>
<verify><automated>cd apps/web && pnpm typecheck</automated></verify>
<done>Driver/Fleet/CaaS panels can pick origin/destination from addresses, ports, yards, chargers, or known FleetVolt assets; selected values contain label, lat/lng, kind, and source metadata. Covers WB-04.</done>
</task>

<task type="auto" id="17-07" depends_on="17-02,17-06">
<name>Workbench Convex aggregation for visible layers and metadata cards</name>
<files>apps/web/convex/workbench/queries.ts</files>
<action>Add thin aggregation queries that wrap existing Convex surfaces: visible chargers/carriers/parking/POIs/geoRegions/highways by bbox/mode/layers with payload caps; `getAssetMetadataCard({type,id})`; `analyzeClass8GapAlongRoute({corridorPoints,radiusM})` delegating to `chargers/queries:class8Gap`; `hotspotReport` pass-through for CaaS selected points. Preserve modeled labels and source/provenance fields. Never fabricate missing route, detour, CO2, or demand-time values; return unavailable/deferred cards instead.</action>
<verify><automated>cd apps/web && pnpm test -- convex/**/*.test.ts</automated></verify>
<done>Map layers fetch bounded, normalized payloads from existing Convex data, and selected marker cards can be rendered without calling raw table names from UI code. Covers WB-05, WB-08, WB-09.</done>
</task>

## Wave 2 — Role-specific vertical MVPs

<task type="auto" id="17-08" depends_on="17-04,17-05,17-06,17-07">
<name>Driver day-plan vertical slice</name>
<files>apps/web/src/components/workbench/map-workbench/inputs/truck-profile-select.tsx; apps/web/src/components/workbench/map-workbench/inputs/workday-constraints.tsx; apps/web/src/components/workbench/map-workbench/workbench-left-panel.tsx; apps/web/src/components/workbench/map-workbench/workbench-right-panel.tsx; apps/web/convex/workbench/actions.ts</files>
<action>Implement driver mode controls: origin, destination, round trips, truck/profile, payload/weather/workday constraints. On run, build route geometry, call physics simulation for feasible inputs, sample route for Class 8 gap, fetch nearest Class 8/five closest chargers plus parking/POIs near stops, and render result cards for feasible/not feasible, charge stops, detours/nearest viable charger when on-route gap exists, and site access guidance. Keep numbers grounded in Convex/route provider/simulation outputs; label unavailable detour access details honestly if not computed.</action>
<verify><automated>cd apps/web && pnpm typecheck && pnpm test -- src/stores/map-workbench-store.test.ts</automated></verify>
<done>Driver can answer: can I complete N round trips, where do I charge, which stops are Class 8 friendly, and what detour/gap warning exists. Covers WB-06.</done>
</task>

<task type="auto" id="17-09" depends_on="17-04,17-05,17-06,17-07,17-08">
<name>Fleet contract-plan vertical slice</name>
<files>apps/web/src/components/workbench/map-workbench/inputs/contract-constraints.tsx; apps/web/src/components/workbench/map-workbench/workbench-left-panel.tsx; apps/web/src/components/workbench/map-workbench/workbench-right-panel.tsx; apps/web/convex/workbench/actions.ts</files>
<action>Implement fleet mode controls: port/origin, inland destination, date/schedule, containers/day, gate hours, dwell, shift length, yard return, truck profile. Use route geometry and simulation to derive v1 operational summary: round-trip duration, trips/truck/day, trucks required, drivers required, charge events, charging downtime, route amenities, gap classification, and mobile CaaS support point/time recommendation when true gap exists. Show formula cards and assumption labels rather than opaque prose.</action>
<verify><automated>cd apps/web && pnpm typecheck</automated></verify>
<done>Fleet user can produce a contract plan summary with trucks, drivers, charge events, downtime, amenities, true gaps, and CaaS support recommendation. Covers WB-07.</done>
</task>

<task type="auto" id="17-10" depends_on="17-04,17-05,17-06,17-07,17-08,17-09">
<name>CaaS gap/opportunity map vertical slice</name>
<files>apps/web/src/components/workbench/map-workbench/workbench-left-panel.tsx; apps/web/src/components/workbench/map-workbench/workbench-right-panel.tsx; apps/web/src/components/workbench/map-workbench/layers/geo-region-layer.tsx; apps/web/src/components/workbench/map-workbench/layers/asset-marker-layer.tsx; apps/web/convex/workbench/queries.ts</files>
<action>Implement CaaS mode starting from a US-wide geo/opportunity view. Support drilldown through available `geoRegions` levels (US/state/county now, air district/zip/city/address when data exists; if missing, show disabled labeled steps rather than blocking). On click or autocomplete origin plus destination, run route/gap analysis, show true Class 8 gaps versus detour-solvable gaps when detour data is available, top carriers/fleets to target, hotspot/report cards, freight context, and mobile charger positioning recommendations. Use centroid/bbox regions for MVP; polygon geometries can be deferred.</action>
<verify><automated>cd apps/web && pnpm typecheck</automated></verify>
<done>CaaS can open a US-wide opportunity map, drill into available regions, choose route endpoints, and see gap, carriers, hotspots, and mobile-positioning cards. Covers WB-08 and WB-09.</done>
</task>

## Wave 3 — AI map actions, e2e/screenshot verification, and audit gate

<task type="auto" id="17-11" depends_on="17-08,17-09,17-10">
<name>AI command bar returns map actions and cards, not prose walls</name>
<files>apps/web/convex/workbench/ai.ts; apps/web/convex/planner.ts; apps/web/src/components/workbench/map-workbench/ai-command-bar.tsx; apps/web/src/stores/map-workbench-store.ts</files>
<action>Extend or wrap the existing planner action so workbench calls return `WorkbenchAiResult`: answerSummary, draftPatch, mapActions, cards, queriesRun, and fallback/error metadata. Preserve the existing grounded-query discipline from `convex/planner.ts`, but render cards/map actions first. Add examples for Driver route draft, Fleet contract assumptions, and CaaS gap/carrier layer toggles. Query errors must be human-readable and must not expose raw internal paths as the primary user message.</action>
<verify><automated>cd apps/web && pnpm typecheck</automated></verify>
<done>At least one prompt per mode updates the workbench draft/layers/cards without producing a wall of text. Covers WB-10.</done>
</task>

<task type="auto" id="17-12" depends_on="17-08,17-09,17-10,17-11">
<name>Local, screenshot, and UX audit verification</name>
<files>apps/web/tests/map-workbench.spec.ts; apps/web/tests/map-workbench-screenshots.spec.ts; existing screenshots/test-results artifacts only as generated outputs</files>
<action>Add Playwright coverage for role launcher CTAs, `/workbench` mode parsing, desktop full-viewport layout, mobile bottom sheet behavior, layer toggles, marker-card interaction, and AI map-action smoke. Add screenshot tests for Driver, Fleet, and CaaS workbench initial states and one planned-result state each. Tests should gracefully skip live tile assertions if Google env/referrer allowlist is unavailable, but still verify DOM/layout/testids. Run the `fleetvolt-ux-audit` skill criteria manually or through its documented checklist: one dominant action per dashboard, map-first workbench, no centered card primary surface, role-filtered nav, human-readable errors, mobile touch targets, and WCAG contrast spot checks.</action>
<verify><automated>cd apps/web && pnpm typecheck && pnpm test && pnpm test:e2e -- map-workbench.spec.ts && pnpm test:e2e -- map-workbench-screenshots.spec.ts</automated><note>Screenshot spec may skip live Google tile assertions when Google env/referrer blocks maps, but it must still verify DOM layout/testids and write/compare screenshot artifacts where possible.</note></verify>
<done>Local tests pass; screenshot artifacts demonstrate map-first desktop and mobile; UX audit criteria pass at 95%+ or failures are documented with fixes. Covers all WB requirements.</done>
</task>

</tasks>

<threat_model>

Trust boundaries:
- Browser ↔ Google Maps/Places/Routes: client may render public map tokens, but Routes/Places billing-sensitive calls and server keys stay server-side or controlled by Maps JS session tokens.
- Browser ↔ Convex: UI must call typed query/action surfaces, not expose raw table assumptions or trust client role/mode for authorization.
- AI ↔ Convex tools: LLM proposes structured map actions; server executes only allowlisted queries/actions and returns grounded cards.
- Modeled/provenance data ↔ user decisions: modeled hotspot/gap/fleet-sizing values must stay labeled; no observed/measured overclaiming.

| ID | STRIDE | Threat | Mitigation | Verification |
|---|---|---|---|---|
| T-17-S | Spoofing | User opens another role launcher URL and sees inappropriate nav/data. | Reuse Phase 16 role auth boundary; semantic route controls UX only, backend still enforces access. | Playwright checks role nav and protected route behavior. |
| T-17-T | Tampering | Client-supplied draft or AI map action injects invalid layer/asset ids. | Validate WorkbenchMode, layer ids, place shapes, and asset ids in store/actions; unknown actions ignored with warning. | Store tests for invalid patch/action rejection. |
| T-17-R | Repudiation | User cannot tell which assumptions/provider produced a plan. | Result cards include provider, query/source, modeled labels, and route warning fields. | E2E asserts provider/assumption labels visible. |
| T-17-I | Information disclosure | Google API keys or Convex internals leak to browser/logs. | Only public Maps key in client; server keys remain in env; errors are humanized; no raw internal paths as primary text. | Unit test no key in route response; e2e error text check. |
| T-17-D | Denial of service | Map fetches thousands of markers/polylines or route calls on every keystroke. | Bbox/zoom caps, debounce autocomplete, session tokens, route caching by hash, layer toggles defaulted per mode. | Query tests cap payloads; UI smoke remains responsive. |
| T-17-E | Elevation of privilege | AI action calls unapproved functions or writes data outside role scope. | Controlled dispatch allowlist; separate save action validates role and target table; no arbitrary function names. | AI tests with unsupported function/action. |
| T-17-O | Overclaiming | Google route displayed as truck-safe or modeled hotspot as observed. | Required warnings for Google provider; preserve `method:"modeled"`; detour/CO2 unavailable cards instead of fabricated numbers. | Tests assert warning/modeled labels. |
| T-17-SC | Supply chain | New npm packages increase attack surface. | No new package installs planned; use existing `@vis.gl/react-google-maps`, Turf, Zustand, Convex, Playwright. If an install becomes necessary, isolate in a new Wave 0 task and audit lockfile diff. | `git diff package.json pnpm-lock.yaml` shows no unexpected dependency changes. |

</threat_model>

<verification>
Suite-level commands:
- `cd apps/web && pnpm typecheck`
- `cd apps/web && pnpm test`
- `cd apps/web && pnpm test:e2e -- map-workbench.spec.ts`
- `cd apps/web && pnpm test:e2e -- map-workbench-screenshots.spec.ts` for screenshot artifacts, with live tile checks skipped only when Google env/referrer blocks maps.
- Manual/local screenshot checklist: `/driver`, `/fleet`, `/caas` CTAs; `/workbench?mode=driver_day_plan`; `/workbench?mode=fleet_contract_plan`; `/workbench?mode=caas_gap_map`; mobile viewport at 390x844 and desktop at 1440x900.
- UX/audit criteria: dashboard as launchpad, exactly one dominant planning CTA per role dashboard, map-first full viewport workbench, left tools/right cards on desktop, mobile bottom sheet, human-readable errors, role-filtered nav, no wall-of-text AI as primary output, marker cards for assets, visible provider/provenance labels.
</verification>

<success_criteria>
- WB-01: Driver/Fleet/CaaS dashboards expose one dominant CTA and launch role mode.
- WB-02: Workbench fills available viewport; no centered `FramedPanel` as primary surface.
- WB-03: Left planning toolbar has role-specific controls; mobile collapses tools into bottom sheet/stepper.
- WB-04: Origin/destination/asset inputs support local asset and Google Places autocomplete.
- WB-05: Google vector map shows actual route geometry, charger/carrier/parking/POI/geo/gap layers, and clickable metadata cards.
- WB-06: Driver day plan answers feasibility, charge stops, detours/gaps, and site guidance.
- WB-07: Fleet contract plan answers trucks/drivers required, charge events, downtime, amenities, gaps, and CaaS support.
- WB-08: CaaS starts US-wide and drills through available geo levels, labeling missing air district/zip/city/address data honestly.
- WB-09: CaaS route analysis shows Class 8 true gaps, detour-solvable status where available, target carriers/fleets, and mobile charger positioning.
- WB-10: AI returns structured map actions/cards/draft patches first; prose is concise and secondary.
</success_criteria>

<output>
.planning/phases/17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map/17-00-SUMMARY.md
</output>
