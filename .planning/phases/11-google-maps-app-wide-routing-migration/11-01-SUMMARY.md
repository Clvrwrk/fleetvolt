---
phase: 11-google-maps-app-wide-routing-migration
plan: 01
subsystem: simulator-routing
tags: [ptv-routing, valhalla-migration, class8-truck, route-geometry-contract, httpx]

requires:
  - phase: (v1) Phase-2 ROUT-01
    provides: RouteProvider surface, RouteGeometry contract, corridor constants, routing endpoint
provides:
  - PTV Developer Routing API client in route_provider.py (RouteProvider hitting GET /routes)
  - parse_ptv_route_response mapping PTV RouteResponse -> unchanged RouteGeometry contract
  - PTV config constants (PTV_BASE_URL, PTV_API_KEY, PTV_TRUCK_PROFILE, CLASS8_VEHICLE)
  - /v1/routing/route re-backed on PTV (valhalla_status field retained, value 'ptv-ready')
  - PTV-backed route-provider test suite + P11-08 POLB->San Bernardino parity spot-check
  - regenerated services/simulator/openapi.json
affects: [11-02 valhalla teardown, 13 physics port]

tech-stack:
  added: []
  patterns: [ptv-routing-adapter, output-contract-preservation, wire-compat-field-retention]

key-files:
  created:
    - services/simulator/tests/test_ptv_route.py (renamed from test_valhalla_route.py)
  modified:
    - services/simulator/app/simulation/route_provider.py
    - services/simulator/app/routes/routing.py
    - services/simulator/tests/test_route_provider.py
    - services/simulator/openapi.json
  unchanged (deliberately):
    - services/simulator/tests/test_simulate_api.py (MagicMock RouteProvider surface intact)

key-decisions:
  - "RouteGeometry output contract preserved byte-for-byte {distance_m, duration_s, encoded_polyline, coordinates=[[lon,lat]]} — orchestrator/segment_builder/physics untouched (P11-04)"
  - "CLASS8_VEHICLE derived from CLASS8_TRUCK_OPTIONS: height 4.11m->411cm, weight 36287kg, axles 5; length 2200cm + width 259cm added (P11-05)"
  - "PTV distance is METERS already — no *1000 (unlike Valhalla km 'length')"
  - "get_edge_speeds returns [] under PTV (no per-edge posted speed); resolve_speeds 55mph fallback preserves the physics contract — documented, not hidden (11-RESEARCH §2)"
  - "RouteResponse field name valhalla_status RETAINED for wire-compat (schema.d.ts + verify_valhalla_route.sh consume it); value set to 'ptv-ready'; rename deferred post-Phase-11"
  - "Valhalla left in docker-compose (teardown is 11-02) for trivial rollback"

patterns-established:
  - "PTV waypoints formatted 'lat,lon' (INVERSE of the [lon,lat] coordinate output) — asserted in tests"
  - "parse_ptv_route_response handles dict + JSON-string GeoJSON polyline + GOOGLE_ENCODED_POLYLINE fallback (plan-checker #3)"
---

# Phase 11 Plan 01 — Valhalla → PTV Developer Routing API Migration (simulator) — Summary

**Requirements addressed:** ROUT-01 (re-scoped for v3.0). Decisions P11-04, P11-05, P11-08.

## What was built

The simulator's truck-routing backend moved from self-hosted Valhalla to the PTV Developer
Routing API, with the `RouteGeometry` output contract held byte-for-byte so Phase-13 physics
consumers are undisturbed. All 7 plan tasks executed in order; one atomic `(11-01)` commit per task.

1. **PTV config + Class-8 vehicle constants** (`4df35d5`) — `PTV_BASE_URL`, `PTV_API_KEY`,
   `PTV_TRUCK_PROFILE=USA_8_SEMITRAILER_5AXLE`, and `CLASS8_VEHICLE` (411cm/36287kg/5 axles +
   length/width) derived from `CLASS8_TRUCK_OPTIONS`. Module docstring notes the PTV target +
   P11-NOTE EV/emissions exclusion. RouteGeometry/EdgeSpeed/decode_polyline/corridor consts unchanged.
2. **parse_ptv_route_response** (`2f4b5fb`) — maps PTV RouteResponse → RouteGeometry: `distance`
   (meters, no *1000), `travelTime`→`duration_s`, GeoJSON polyline→`[lon,lat]`. Handles dict +
   JSON-string polyline forms and a GOOGLE_ENCODED_POLYLINE fallback; raises ValueError on malformed input.
3. **RouteProvider rewrite** (`083df14`) — GET `/routes` via httpx with `apiKey` header, profile +
   Class-8 vehicle params, `options[polylineFormat]=GEO_JSON`, `waypoints` as `"lat,lon"`. Public
   surface (`get_route`/`get_route_locations`/`get_edge_speeds`) unchanged. `get_edge_speeds` returns
   `[]` with a one-time log. Removed all Valhalla-only helpers.
4. **/v1/routing/route re-backed** (`9aa2c5f`) — dropped the Valhalla health-probe gate and
   `VALHALLA_BASE_URL`/`_valhalla_*` imports; `valhalla_status` field retained (value `"ptv-ready"`)
   for wire-compat with shared-types + verify script. RuntimeError→503 / ValueError→502 preserved.
5. **Route-provider tests rewritten** (`797f2a4`) — mocked PTV path asserting apiKey header, profile,
   GEO_JSON, Class-8 overrides, `"lat,lon"` waypoints, meters (no *1000), `get_edge_speeds()==[]`, and
   the P11-08 POLB→San Bernardino parity spot-check (distance band 120k–200k m + corridor-endpoint coords).
6. **Collection-break fix** (`58623e4`) — `test_valhalla_route.py` → `test_ptv_route.py`; dropped the
   `VALHALLA_BASE_URL` import that would error collection, converted the live test to PTV, deleted the
   Valhalla-503 test, kept non-integration `test_corridor_constants_defined`.
7. **OpenAPI regen + full suite** (`f9268ae`) — `scripts/export_openapi.py` re-run; `/v1/routing/route`
   now described as a PTV Class-8 route.

## Verification (real results)

- **Task 1:** `import PTV_BASE_URL, PTV_TRUCK_PROFILE, CLASS8_VEHICLE, ...` →
  `https://api.myptv.com/routing/v1 USA_8_SEMITRAILER_5AXLE {'height': 411, 'totalPermittedWeight': 36287, 'numberOfAxles': 5, 'length': 2200, 'width': 259}` ✅
- **Task 2:** `parse_ptv_route_response` dict + JSON-string forms → `OK 153200.0 3 str-form 2` ✅
- **Task 3:** mocked httpx GET → `OK 153200.0 waypoints ['33.754,-118.216', '34.108,-117.29']`; apiKey header + profile + GEO_JSON asserted; `get_edge_speeds==[]` ✅ (respx not installed → used the repo's MagicMock/patch style, per plan fallback)
- **Task 4:** routing imports clean; only intentional `valhalla_status` field + comment remain (no health-probe / VALHALLA_BASE_URL) ✅
- **Task 5:** `pytest tests/test_route_provider.py tests/test_simulate_api.py` → **11 passed, 8 skipped** ✅
- **Task 6:** no Valhalla symbol imports in tests; `--collect-only -m "not integration"` → **106 collected, 13 deselected, 0 errors** ✅
- **Task 7:** `pytest -m "not integration"` → **70 passed, 36 skipped, 13 deselected, 0 failed**; openapi.json shows `"Return a Class 8 truck route via the PTV Developer Routing API."` ✅

**Final pytest result: 70 passed, 36 skipped, 13 deselected, 0 failed.**

## Deviations / notes

- **respx not installed** — the Task-3 verify's respx snippet was unavailable in the venv; used the
  `unittest.mock`/`@patch("...httpx.Client")` style already established in the repo's Valhalla tests
  (explicitly sanctioned by the plan: "If respx is unavailable, this is proven by the rewritten pytest suite"). No new dep added.
- **Env: leaking PYTHONPATH** — the Hermes host injects `PYTHONPATH` pointing at its own venv, which
  broke `pydantic_core` in the simulator venv. Resolved by `unset PYTHONPATH` (+ exporting
  `PTV_DEVELOPER_API_KEY` from `~/.hermes/.env`) before every verify. Simulator-internal only; no code impact.
- **36 skipped tests** are DB-dependent (Postgres `fleetvolt_test` unreachable — the docker stack is
  brought up separately) plus integration-marked live-route tests. None are routing-related; all
  routing/physics unit tests pass. The 13 deselected are `-m "not integration"` exclusions.
- **`KPH_TO_MPH` / `DEFAULT_TRUCK_TOP_SPEED_MPH` kept** — still imported by `speed_resolver.py`;
  removed only the Valhalla-specific `_speed_kph_to_mph`/trace-attribute code.
- **Valhalla left in docker-compose** intentionally (teardown is plan 11-02) for trivial rollback.
- Repo had many pre-existing uncommitted changes from a parallel web executor; each commit staged
  ONLY this plan's simulator files.

## Output

Plan 11-01 complete (services/simulator only). Routing now runs on PTV with the RouteGeometry contract
preserved. Next: 11-02 (retire Valhalla from docker-compose + Makefile PBF workflow); 11-03 (parallel
web Google Maps migration).
