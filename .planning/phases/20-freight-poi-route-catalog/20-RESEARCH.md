# Phase 20 Technical Research

## Existing assets

- `trafficGenerators` already carries stable generator ID, location, address, and optional port code.
- `ports` contains six seeded California freight anchors.
- `workbench/actions:routeGeometry` already performs persistent PTV reuse and returns request hash metadata.
- `routes/enrichment:forRoute` already builds/reuses the seven-day intelligence snapshot.
- `workbenchRuns` stores authenticated endpoints and route geometry for Recents.
- The left panel currently renders five large Quick corridor buttons, creating the exact sidebar crowding this phase should remove.

## Selected architecture

1. Add `routeCatalogEntries`, keyed by stable catalog ID and indexed for promoted/sort order and request hash.
2. Store generator/port identity, normalized endpoints, request hash, promotion state, sort order, and timestamps; do not duplicate geometry or enrichment snapshots.
3. `precomputeFreightPoi` resolves one generator and port, invokes cached PTV geometry, invokes route enrichment, and promotes only after both references are usable.
4. `list` joins promoted catalog entries to Phase-18/19 rows and combines them with deduplicated authenticated workbench Recents.
5. UI consumes one serializable catalog contract; selecting an entry writes endpoints + cached geometry into the existing Zustand store.

## Safety and cost

- No array/batch input exists on the provider action. Each generator must be explicitly invoked.
- Initial Alpha seed is exactly five calls, recorded individually.
- Existing request hashes avoid provider pulls when the same directional route already exists.
- Missing enrichment does not hide usable road geometry, but promotion requires a successful enrichment receipt for the five Alpha routes.

## Validation Architecture

- Pure tests cover directional endpoint keys, recent dedupe, group ordering, promoted filtering, and manifest summaries.
- Convex codegen and live one-route precompute prove the join.
- Five explicit CLI invocations create the Alpha catalog; a sixth list query proves all returned geometry is road-level.
- Component/browser verification checks native selector groups, applied endpoints/geometry, manifest content, and three viewports.
