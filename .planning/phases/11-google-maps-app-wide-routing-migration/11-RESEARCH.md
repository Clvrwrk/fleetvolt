# Phase 11 Research — Google Maps App-Wide + Routing Migration

**Researched:** 2026-07-07
**Method:** Google Maps Platform docs (Routes API) + reuse of prior v2.0 research (STACK/ARCHITECTURE/PITFALLS already cover the `@vis.gl/react-google-maps` client stack).

## 1. Map client stack — SETTLED (reuse Phase 7)

Phase 7 already shipped `@vis.gl/react-google-maps` with a vector `mapId`, AdvancedMarkerElement, and cloud styling for `/pulse`. No new research needed — the Phase-4 `route-map.tsx` port mirrors that working pattern. See `.planning/research/STACK.md` + `ARCHITECTURE.md`.

## 2. ⚠️ ROUTING FIDELITY GAP — the key finding

**Google Routes API (`computeRoutes`) has NO truck / HGV travel mode.**

- `travelMode` enum: `DRIVE`, `BICYCLE`, `WALK`, `TWO_WHEELER`, `TRANSIT`. No `TRUCK`/`HEAVY_VEHICLE`.
- `routeModifiers`: only `avoidTolls`, `avoidHighways`, `avoidFerries`, plus `vehicleInfo.emissionType` (for eco-routing) — **no height / weight / axle / length constraints.**
- Consequence: Google `DRIVE` routing will happily route over low-clearance bridges, weight-limited roads, and truck-prohibited segments that **Valhalla `costing=truck` explicitly avoided** (with the Class-8 height/weight/axle params this app configured).

**What Valhalla provided that Google Routes does NOT:**
| Capability | Valhalla `costing=truck` | Google Routes `DRIVE` |
|-----------|--------------------------|------------------------|
| Truck height/weight/axle restrictions | ✅ | ❌ |
| Truck-prohibited road avoidance | ✅ | ❌ |
| Low-bridge / clearance avoidance | ✅ | ❌ |
| Posted speed per edge | ✅ (edge annotations) | ⚠️ via `speedReadingIntervals` (traffic-aware, not posted-limit-exact) |
| Traffic-aware ETA | limited | ✅ (`TRAFFIC_AWARE`) |
| Polyline geometry | ✅ | ✅ (encoded polyline) |

**Posted-speed note:** `route_provider.py` currently maps Valhalla per-edge posted speed to cumulative distance for the physics speed_resolver. Google returns `speedReadingIntervals` (NORMAL/SLOW/TRAFFIC_JAM buckets) or numeric speeds only with the Traffic-aware fields — this is *traffic* speed, not *posted limit*. The physics engine consumes posted speed for its speed profile. This is a second fidelity gap the planner must address (options below).

## 3. DECISION: PTV Developer Routing API (Option D) — chosen by Chris 2026-07-07

Google Routes is out for routing (no truck mode). **PTV Developer Routing API** replaces
Valhalla for truck routing. Key (`PTV_DEVELOPER_API_KEY`) synced to Hermes creds 2026-07-07.

**PTV Routing API native capabilities (from developer.myptv.com + ptvlogistics.com):**
- **Truck routing:** size/weight/axle attributes, speed profiles, inner-city access restrictions, toll costs, legal driving/rest periods. This is what Valhalla `costing=truck` gave us — restored.
- **EV energy consumption:** calculates energy use for specific electric trucks from battery capacity, size, weight, wind resistance, energy efficiency — "world's most extensive database of digital twins."
- **Emissions:** exact energy usage + CO2/methane/NOx per vehicle attributes and recognized standards.
- **Weather + elevation:** factored into range/performance.

**⚠️ MAJOR ARCHITECTURAL IMPLICATION (flag for Chris + Phase 13):**
PTV's EV energy + emissions engine **overlaps FleetVolt's own physics engine** (the 3,454-LOC
Python simulator we planned to port to Convex in Phase 13) AND the deferred v1 Phase 5/6
emissions/TCO requirements. This opens a strategic question that must be answered before
Phase 13:
- **Do we still port the custom physics engine to Convex (Phase 13 as scoped)?** OR
- **Do we lean on PTV's energy/emissions API and shrink Phase 13 to orchestration + parity-check against PTV?**

This is NOT a Phase 11 decision — Phase 11 only needs PTV for **route geometry + posted
speed + truck-legal paths** (the Valhalla replacement). But it materially changes Phase 13's
scope and should be surfaced now so we don't rewrite 3,454 LOC we might replace with an API call.

### Phase 11 PTV scope (routing only)
- **P11-04 (revised):** Replace Valhalla client in `route_provider.py` with PTV Routing API. Request truck vehicle profile (Class-8 dimensions/weight). Preserve `RouteGeometry` output contract (GeoJSON [lon,lat] pairs + posted-speed mapping) so physics/segment_builder consumers are unchanged.
- **P11-05 (resolved):** PTV natively supports Class-8 truck attributes + posted speed profiles — the fidelity gap that killed Google is closed. Planner researches PTV's exact route endpoint request/response shape, polyline format, and how posted speed is returned.
- PTV auth: API key via header (planner confirms exact header name from developer.myptv.com — likely `apiKey` query param or `Authorization`). Endpoint base: `https://api.myptv.com/routing/v1/...` (planner confirms exact path).

### Endpoints to confirm at plan time (research targets)
- `developer.myptv.com/en/documentation/routing-api` — request/response schema, vehicle profile params, auth header
- Rate limits / quota on the Developer tier for the demo.

## OLD (superseded) — Google Routes truck-fidelity gap analysis

The analysis below is retained for the record; **Option D (PTV) was chosen**, so the Google
truck-fidelity gap no longer blocks us.

Google Routes API `travelMode` = DRIVE/BICYCLE/WALK/TWO_WHEELER/TRANSIT (no truck);
`routeModifiers` only avoid tolls/highways/ferries; no height/weight/axle. Google `DRIVE`
would route Class-8 trucks on car-legal roads. **Resolved by switching routing to PTV.**
Google Maps is still used for the **map display layer** (P11-01/02/03) — only *routing* moves to PTV.

## 4. Non-routing scope — low risk

- **8 Mapbox files:** most are tables/panels with stale imports or map-token banners; only `route-map.tsx` + workspace map renders are real. Triage at plan time.
- **Valhalla teardown:** remove service from `docker-compose.yml`, drop Makefile `valhalla-pbf`/`verify-pbf`, retain `socal.osm.pbf` doc note (no longer runtime-needed).
- **Referrer allowlist:** DONE — live tiles render, so the Phase-4 `scenario-run` UAT can fully exercise the map post-migration.

## 5. Recommendation to surface BEFORE planning

The truck-routing fidelity gap is a **product decision**, not an implementation detail: a Class-8 BET drayage feasibility tool that routes trucks on car-legal roads may produce physically invalid corridors (the whole POLB/Cajon value prop). Chris should choose Option A/B/C before the planner commits.
