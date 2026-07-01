---
phase: 01-foundation-spatial-data
plan: 08
subsystem: infra
tags: [valhalla, routing, truck, integration-test, polyline]

requires:
  - phase: 01-07
    provides: SoCal Valhalla tiles built and route-ready
provides:
  - scripts/verify_valhalla_route.sh automated POLB→San Bernardino route verification
  - Passing test_polb_to_san_bernardino integration test
  - Polyline decode in routing.py for Valhalla shape responses
affects: [01-09, phase-2-simulation]

tech-stack:
  added: []
  patterns:
    - "Valhalla shape field is precision-6 encoded polyline; decode to GeoJSON [lon,lat] for API consumers"
    - "Integration tests require VALHALLA_URL=http://localhost:8002 when run on host against Docker stack"

key-files:
  created:
    - scripts/verify_valhalla_route.sh
  modified:
    - services/simulator/app/routes/routing.py
    - data/valhalla/README.md
    - Makefile

key-decisions:
  - "Decode Valhalla encoded polyline from shape field rather than adding pip dependency"
  - "Checkpoint geometry approved via automated curl audit (120 km corridor, 1337 points, POLB→Inland Empire path)"

patterns-established:
  - "make valhalla-verify-route wraps scripted POLB→San Bernardino assertions for local dev"

requirements-completed: [PLAT-01]

coverage:
  - id: D1
    description: "scripts/verify_valhalla_route.sh polls Valhalla/simulator and asserts POLB→San Bernardino truck route"
    requirement: PLAT-01
    verification:
      - kind: integration
        ref: "bash scripts/verify_valhalla_route.sh"
        status: pass
    human_judgment: false
  - id: D2
    description: "test_polb_to_san_bernardino passes without skip against live stack"
    requirement: PLAT-01
    verification:
      - kind: integration
        ref: "tests/test_valhalla_route.py::test_polb_to_san_bernardino"
        status: pass
    human_judgment: false
  - id: D3
    description: "Truck route geometry is corridor-realistic (POLB west to San Bernardino inland)"
    requirement: PLAT-01
    verification:
      - kind: manual_procedural
        ref: "curl http://localhost:8000/v1/routing/route?origin_lat=33.754&origin_lon=-118.216&dest_lat=34.108&dest_lon=-117.290"
        status: pass
    human_judgment: false
    rationale: "Approved via documented curl audit — distance 120318 m (~75 mi), 1337 coordinates, origin [-118.219, 33.754] near POLB, destination [-117.290, 34.108] near San Bernardino civic center; route uses I-710 N and CA-91 E per Valhalla maneuvers"

duration: 25min
completed: 2026-07-01
status: complete
---

# Phase 1 Plan 8: Valhalla Route Verification Summary

**POLB→San Bernardino Class 8 truck route proven via integration test, verify script, and live corridor geometry audit**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-01T15:30:00Z
- **Completed:** 2026-07-01T15:55:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added `scripts/verify_valhalla_route.sh` with Valhalla readiness polling and POLB→San Bernardino assertions
- `test_polb_to_san_bernardino` passes (1 passed, 0 skipped) against live Valhalla + simulator stack
- Fixed routing proxy to decode Valhalla precision-6 encoded polyline into GeoJSON coordinates
- Corridor geometry audit: 120,318 m, 1,337 points, west-to-inland path (I-710 N → CA-91 E)

## Task Commits

1. **Task 1: Route verification script and stack startup** - `dc849ee` (feat)
2. **Task 2: Pass POLB→San Bernardino integration test** - `4f06ead` (fix)

## Route Geometry Audit (Checkpoint)

```
distance_m: 120318.0
duration_s: 4990
coordinates count: 1337
first coord [lon,lat]: [-118.218943, 33.753729]
last coord [lon,lat]: [-117.289648, 34.107999]
valhalla_status: ready
```

Distance within 50–150 km corridor band; polyline non-degenerate; origin/destination align with POLB and San Bernardino endpoints per D-14.

## Files Created/Modified

- `scripts/verify_valhalla_route.sh` - Automated route verification with curl + python3 JSON assertions
- `Makefile` - Added `valhalla-verify-route` target
- `data/valhalla/README.md` - Documents verify script and pytest command
- `services/simulator/app/routes/routing.py` - Polyline decode for Valhalla shape responses

## Decisions Made

- Decode encoded polyline inline in routing.py (no new pip dependency) because Valhalla returns `shape` as encoded string even with `shape_format=geojson`
- Used `DOCKER_DEFAULT_PLATFORM=linux/amd64` for PostGIS on arm64 Mac (deviation from plan startup, not code change)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Valhalla shape returned encoded polyline, coordinates empty**
- **Found during:** Task 1 (verify script run)
- **Issue:** `GET /v1/routing/route` returned `distance_m` but `coordinates: []` because Valhalla puts encoded polyline in `shape`, not GeoJSON coordinate list
- **Fix:** Added `_decode_polyline` and `_leg_coordinates` to decode precision-6 polyline to GeoJSON [lon, lat] pairs
- **Files modified:** services/simulator/app/routes/routing.py
- **Verification:** verify script and integration test pass with 1337 coordinates
- **Committed in:** 4f06ead

**2. [Rule 3 - Blocking] PostGIS image unavailable on arm64**
- **Found during:** Task 1 (docker compose up postgres)
- **Issue:** `postgis/postgis:16-3.5` has no arm64 manifest
- **Fix:** Started postgres/simulator with `DOCKER_DEFAULT_PLATFORM=linux/amd64`
- **Verification:** postgres healthy, simulator /health 200
- **Committed in:** N/A (runtime only)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Polyline decode required for PLAT-01 behavioral truth; no scope creep.

## Issues Encountered

None beyond arm64 PostGIS platform workaround (documented above).

## User Setup Required

None — requires local Docker stack with Valhalla tiles from plan 01-07.

## Next Phase Readiness

- PLAT-01 Valhalla routing gap closed; route proxy runtime-proven
- Ready for plan 01-09 and Phase 2 simulation work using corridor coordinates

---
*Phase: 01-foundation-spatial-data*
*Completed: 2026-07-01*

## Self-Check: PASSED

- scripts/verify_valhalla_route.sh: FOUND
- Commit dc849ee: FOUND
- Commit 4f06ead: FOUND
