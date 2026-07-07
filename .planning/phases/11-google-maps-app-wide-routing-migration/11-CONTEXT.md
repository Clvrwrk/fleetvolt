# Phase 11: Google Maps App-Wide + Routing Migration - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning
**Source:** Locked decisions from `.planning/MILESTONE-CONTEXT.md` (v3.0 scoping session, no separate discuss-phase needed)

<domain>
## Phase Boundary

Phase 11 is the first phase of milestone v3.0 (Full Platform Migration). It moves the
**entire** web app onto Google Maps and replaces Valhalla routing with the Google
Directions/Routes API. This is the bounded, reversible first step — no Convex/Vercel work
here (those are Phases 12–14).

**In scope:**
- Replace Mapbox/`react-map-gl`/`mapbox-gl` in all remaining web files with Google Maps (`@vis.gl/react-google-maps`, vector `mapId`) — completing the app-wide migration that Phase 7 began for `/pulse`.
- Port the shipped Phase-4 route map (`route-map.tsx`: SoC-gradient polyline, charger markers, chart hover-sync) to Google vector map + AdvancedMarkers.
- Replace Valhalla truck routing in `route_provider.py` + `routes/routing.py` with Google Directions/Routes API (Class-8 truck params).
- Remove the `valhalla` service from `docker-compose.yml`; stack still boots.

**Not in scope (later phases):**
- Convex data/spatial migration (Phase 12), physics engine port (Phase 13), Vercel deploy + full Docker teardown (Phase 14).
- The Python simulator, PostGIS, Fastify API, Celery all remain running this phase — ONLY Valhalla leaves.
</domain>

<decisions>
## Implementation Decisions

### Map Library — complete the app-wide Mapbox → Google migration
- **P11-01:** Finish migrating every remaining web file off Mapbox to Google Maps. Phase 7 already stood up `@vis.gl/react-google-maps` + vector `mapId` for `/pulse`; reuse that exact stack and pattern app-wide. (Extends prior D-01/D-02.)
- **P11-02:** The 8 files still referencing Mapbox (verified 2026-07-07): `apps/web/next.config.ts`, `components/tables/charging-plan-compact.tsx`, `components/tables/charging-plan-table.tsx`, `components/workspace/route-planner-center.tsx`, `components/workspace/route-planner-right-rail.tsx`, `components/workspace/workspace-layout.tsx`, `components/results/basic-results-panel.tsx`, `components/map/route-map.tsx`. Planner must triage which are real map renders vs stale imports/types.
- **P11-03:** `route-map.tsx` is the highest-risk file — it renders the shipped Phase-4 SoC-gradient route + charger markers + hover sync. Port to Google vector map + AdvancedMarkerElement, preserving the SoC gradient encoding and chart↔map hover sync. This is a passing v1 UAT — must stay green.

### Routing — Valhalla → PTV Developer Routing API (Option D, chosen 2026-07-07)
- **P11-04:** Replace the Valhalla HTTP client in `route_provider.py` (315 LOC) with the **PTV Developer Routing API** (`PTV_DEVELOPER_API_KEY` synced to creds). Google Routes was rejected — it has no truck/HGV travel mode. PTV natively supports Class-8 truck attributes (size/weight/axle), posted speed profiles, access restrictions, and toll. Preserve the `RouteGeometry` output contract (GeoJSON [lon,lat] pairs + posted-speed mapping) so downstream physics/segment_builder consumers are unchanged.
- **P11-05:** Request a truck vehicle profile matching the Class-8 config (eCascadia/T680E dimensions + weight). Planner confirms PTV's exact endpoint path, request/response schema, polyline format, posted-speed field, and auth header from `developer.myptv.com/en/documentation/routing-api`.
- **P11-06:** Retire the `valhalla` service from `docker-compose.yml` and the Makefile PBF workflow (`valhalla-pbf`/`verify-pbf`). The `socal.osm.pbf` local artifact is no longer needed at runtime.
- **⚠️ P11-NOTE (Phase 13 flag, NOT Phase 11 scope):** PTV also offers native EV energy-consumption + emissions APIs that OVERLAP the custom physics engine (Phase 13 port target) and the deferred v1 Phase 5/6 emissions/TCO work. Phase 11 uses PTV for routing geometry ONLY. Whether Phase 13 keeps the custom physics rewrite or leans on PTV's energy API is a strategic decision to resolve before Phase 13 — captured in 11-RESEARCH.md §3.

### Verification gates
- **P11-07:** Phase-4 `scenario-run` Playwright UAT must stay green after the migration — this is the hard safety gate (referrer allowlist is now configured, so live Google tiles render).
- **P11-08:** Route geometry parity: POLB→San Bernardino truck route returns a plausible Class-8 geometry from Google comparable to the prior Valhalla result (distance within reasonable tolerance; planner sets exact threshold).

### Claude's Discretion
- Exact Google Routes API request shape, polyline decoding approach, posted-speed derivation from Google response (Google exposes speed differently than Valhalla edges — may require `speedReadingIntervals` or a fallback), and how to structure the routing adapter for testability.

### Requirement-ID traceability note (plan-checker #4)
- The plans reuse v1 requirement IDs — ROUT-01/ROUT-02 (v1 Phase 2, Valhalla routing) and MAP-01/02/03 + FLOW-01 (v1 Phase 4 map), all marked **Complete** in `.planning/REQUIREMENTS.md`. In v3.0 these IDs are **re-scoped**: ROUT-01 now tags the PTV migration (not the original Valhalla build), MAP-01/02/03 now tag the Google-map port (not the original Mapbox build). This is intentional (the migration re-delivers the same user-facing capability on a new stack), but it means "ROUT-01 Complete" in the v1 ledger and "ROUT-01" in Phase 11 refer to different implementations. Treat Phase 11's requirement tags as **re-scoped-for-v3.0** references, not new requirements. If cleaner traceability is wanted later, mint versioned IDs (e.g. ROUT-01.v3) — deferred as a non-blocking bookkeeping choice.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Migration scope + locked decisions
- `.planning/MILESTONE-CONTEXT.md` — v3.0 full scope, verified Convex limits, 4-phase decomposition, locked decisions M-01..M-05
- `.planning/ROADMAP.md` — Phase 11 success criteria (v3.0 milestone section)

### Prior research (reuse — already covers the Google stack)
- `.planning/research/STACK.md` — locked stack + versions (`@vis.gl/react-google-maps`, vector mapId)
- `.planning/research/ARCHITECTURE.md` — Google map component patterns, layered rendering
- `.planning/research/PITFALLS.md` — AdvancedMarkerElement, Directions caching, referrer/key pitfalls

### Existing code to migrate
- `apps/web/src/components/map/route-map.tsx` — shipped Phase-4 route map (highest-risk port)
- `services/simulator/app/simulation/route_provider.py` — Valhalla client (315 LOC) → Google Routes
- `services/simulator/app/routes/routing.py` — routing endpoint (86 LOC)
- `apps/web/src/components/pulse/` + `pulse-map` — the working Google map pattern from Phase 7 to mirror
- `docker-compose.yml`, `Makefile` — valhalla service + PBF targets to remove

### Environment
- Google Maps key referrer allowlist: CONFIGURED (localhost:3000, 127.0.0.1:3000, fleetvolt.network + wildcard). Live tiles render.
- Creds in `apps/web/.env.local` (git-ignored) from `~/.config/cleverwork/master.env`.
</canonical_refs>

<specifics>
## Specific Ideas

- The `/pulse` Google map from Phase 7 is the working reference implementation — the Phase-4 `route-map.tsx` port should converge on the same `@vis.gl/react-google-maps` + AdvancedMarker patterns, not invent a second approach.
- Keep the routing adapter's output contract byte-compatible with what `segment_builder`/`physics_engine` consume so Phase 13's physics port isn't complicated by a routing contract change.
</specifics>

<deferred>
## Deferred Ideas

- Convex/Vercel work — Phases 12–14.
- Full Docker teardown — Phase 14 (only Valhalla leaves in Phase 11; Postgres/Redis/simulator/api stay).
- Precomputed last-mile Directions caching (a v2.0 Freight Pulse stretch item) — not part of this migration.
</deferred>

---

*Phase: 11-google-maps-app-wide-routing-migration*
*Context gathered: 2026-07-07 from v3.0 locked decisions*
