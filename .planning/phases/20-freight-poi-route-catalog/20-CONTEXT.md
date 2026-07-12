# Phase 20: Freight POI Route Catalog — Context

**Gathered:** 2026-07-11
**Status:** Ready for execution

<domain>
## Phase Boundary

Create the first reusable catalog surface over Phase-18 geometry and Phase-19 intelligence. Curated freight traffic generators become promoted shared routes; a signed-in user's calculated routes become Recents. Road-overlap selection belongs to Phase 21 and workspace panel relocation belongs to Phase 22.
</domain>

<decisions>
## Locked Decisions

### Catalog content
- Cache every successful route, but only promoted curated routes appear under Preconfigured.
- Initial Alpha seed is five freight-generator routes, calculated one at a time; no mass provider-call action.
- Generator origin/destination pairs use associated `portCode` when valid, otherwise the nearest seeded California freight port.
- A→B and B→A remain distinct through the Phase-18 request hash.

### Recents
- Recents come from authenticated `workbenchRuns`, newest first.
- Deduplicate by normalized directional endpoints; keep the newest usable road geometry per pair.
- Anonymous/review sessions show an honest no-recents state without hiding Preconfigured routes.

### Selector behavior
- One grouped dropdown: Preconfigured first, Recent second.
- Manual origin/destination inputs stay immediately below it.
- Selection applies cached endpoints and road geometry immediately; no new PTV call occurs merely from choosing a route.
- Compact route manifest shows ROAD, TRAFFIC, CHARGE only. Parking/amenity/carrier details stay in map layers/cards.

### Safety
- Catalog rows reference request hashes rather than duplicating authoritative geometry/intelligence documents.
- Provider failures leave a catalog candidate unpromoted; no straight-line route is stored.
- Convex remains the system of record; no Supabase dual-write.
</decisions>

<canonical_refs>
## Canonical References

- `apps/web/convex/routes/cache.ts` — 90-day geometry repository.
- `apps/web/convex/routes/enrichment.ts` — seven-day route intelligence action.
- `apps/web/convex/generators/queries.ts` — traffic generator and port association data.
- `apps/web/convex/workbench/runs.ts` — authenticated recent calculations.
- `apps/web/src/components/workbench/map-workbench/inputs/route-builder.tsx` — endpoint UI.
- `apps/web/src/components/workbench/map-workbench/workbench-left-panel.tsx` — current quick-corridor clutter to replace.
</canonical_refs>

<deferred>
## Deferred

- Road click with several catalog memberships: Phase 21.
- Right-mounted CaaS panels: Phase 22.
- Amenity/fleet detail in dropdown rows: intentionally excluded.
</deferred>
