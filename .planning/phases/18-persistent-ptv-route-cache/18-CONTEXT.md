# Phase 18: Persistent PTV Route Cache - Context

**Gathered:** 2026-07-11
**Status:** Ready for execution

<domain>
## Phase Boundary

Persist and reuse PTV route geometry in Convex. Route enrichment, catalog UI, road-click selection, and responsive panels are later phases.

</domain>

<decisions>
## Implementation Decisions

### Cache lifecycle
- Successful PTV geometry has a hard 90-day no-pull window.
- At expiry, stale geometry remains usable while one caller obtains a refresh lease.
- Refresh failure preserves stale geometry and records the error.
- Missing-route failure returns no geometry; straight-line fallbacks remain forbidden.

### Identity and storage
- A→B and B→A are distinct.
- Identity includes normalized endpoints, waypoints, provider, and available routing options.
- Convex is the active system of record behind internal repository functions.
- Google fallbacks do not receive the successful-PTV 90-day lifetime.

### Observability
- Persist access count, last access, refresh count, last attempt, refresh status/error, pulled time, and expiry.
- Return freshness metadata without exposing provider credentials.

</decisions>

<canonical_refs>
## Canonical References

- `apps/web/convex/workbench/actions.ts` — active route action and provider fallback.
- `apps/web/src/lib/maps/google-routes.ts` — request hashing and geometry contract.
- `apps/web/src/lib/maps/ptv-routes.ts` — PTV adapter.
- `apps/web/convex/schema.ts` — Convex data model.
- `.planning/ROADMAP.md` — v3.1 locked decisions.

</canonical_refs>

<deferred>
## Deferred Ideas

- Enrichment snapshots: Phase 19.
- Freight POI catalog: Phase 20.
- Road-click membership: Phase 21.
- Responsive CaaS workspace: Phase 22.

</deferred>
