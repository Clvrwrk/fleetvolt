# Phase 23: Statewide Route Intelligence, Prime Charging Sites, and Executive Briefs — Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the Phase-20 promoted catalog from six verified designated routes to all 69 designated California port-to-generator pairs, add typed traffic/freight styling and one explainable modeled charging-prime site per route, then create route-native HTML/PDF/CSV/JSON briefs. Preserve completed route-cache and enrichment contracts.
</domain>

<decisions>
## Locked Decisions

### Coverage and provider execution
- Exactly one route per traffic generator: explicit port assignment where valid, otherwise nearest seeded California freight port.
- 69 total designated routes; 63 are currently missing.
- Execute sequentially through the existing one-generator action with bounded retry/backoff, resumable progress, and per-attempt receipts.
- Reuse 90-day PTV geometry. Provider failure leaves the candidate unpromoted and never creates fallback geometry.

### Evidence and styling
- Color represents measured Caltrans 5-axle truck AADT only.
- Width/pulse represents explicitly labeled port/FAF regional freight context only.
- Add a provenance-backed port-to-FAF mapping; unsupported ports return unavailable.
- Preserve numeric AADT/freight fields in the catalog contract; do not parse formatted manifest strings.
- Focused and overview routes share one pure styling policy.

### Prime charging site
- Exactly one modeled candidate per promoted route.
- Standard planning vehicle is the current 438-kWh Class 8 tractor under normal operations.
- Use the actual PTV path and standard energy model to target inclusive 20–40% arrival SoC.
- Existing site candidates must be freight-compatible and no more than an inclusive 10-mile detour.
- Ranking includes energy-window fit, HGV dwell suitability, charger-gap evidence, freight demand, detour, data completeness, and confidence.
- If no mapped site qualifies, return one on-route modeled candidate with explicit parcel/access/utility field-validation caveats.
- The map marker is the pulsing FleetVolt logo and opens an explanation card without clearing route focus.

### Executive brief
- One deterministic route-native contract keyed by catalog route; simulation inputsHash is optional.
- Formats: semantic live HTML, downloadable PDF, CSV evidence appendix, JSON evidence appendix.
- Include road map rendering, route/geometry freshness, traffic, freight context, chargers/gaps, prime site, district/county/ZIP, carriers, modeled energy/emissions, assumptions, sources, and unavailable reasons.
- Use standard 438-kWh profile and clearly labeled planning factors for energy/emissions.
- Carrier list is verified/geocoded only; fewer than ten is valid and no mock padding is allowed.
- Use the FleetVolt enterprise design system, 16px HTML floor, 11pt PDF body floor, semantic/repeated table headers, captions, and tabular alternatives.

### Release boundary
- CaaS desktop is primary. Fleet Manager/Driver work and responsive mobile/tablet work are excluded.
- Changes go through a PR branch. Never merge, push, or commit directly to main.
</decisions>

<canonical_refs>
## Canonical References

- `apps/web/convex/routes/catalog.ts` — catalog coverage and one-generator precompute.
- `apps/web/convex/routes/cache.ts` — 90-day directional geometry repository.
- `apps/web/convex/routes/enrichment.ts` — seven-day route intelligence.
- `apps/web/convex/routes/enrichmentSources.ts` — AADT/FAF/asset evidence.
- `apps/web/src/components/workbench/map-workbench/layers/freight-flow-layer.tsx` — current overview styling.
- `apps/web/src/components/workbench/map-workbench/layers/generator-spokes-layer.tsx` — current port/generator visualization.
- `apps/web/convex/report.ts` — current location-centric report seam.
- `apps/web/convex/exports/exportTemplate.ts` — existing simulation export seam.
- `apps/web/src/components/briefing/executive-briefing.tsx` — synthetic UI to replace with live route data.
- `docs/design/Report Template Examples/` — reviewed layout references.
</canonical_refs>

<implementation_notes>
## Existing Audit Facts

- Six ports: POLA, POLB, OAK, SD, HUE, SF.
- 69 traffic generators; 37 explicit port assignments and 32 nearest-port assignments.
- Verified designated coverage: 6/69; missing: 63; invalid: 0.
- Route-specific traffic is Caltrans 5-axle truck AADT within 2 km.
- Current freight context is FAF 2023 origin zone 061 and is not valid for every port.
- Geometry TTL is 90 days; enrichment TTL is seven days.
- Current GAP analysis receives three chord points and must switch to the actual PTV polyline.
- Existing executive briefing values are synthetic and must not be reused as production route data.
</implementation_notes>

<deferred>
## Deferred

- All-port-to-all-generator 414-route matrix.
- Phase-21 overlapping-road route chooser.
- Fleet Manager and Driver lane completion.
- Mobile/tablet responsive experience.
- Parcel ownership, utility interconnection, permitting, and field validation.
</deferred>
