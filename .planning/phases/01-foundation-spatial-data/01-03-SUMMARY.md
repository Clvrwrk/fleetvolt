---
phase: 01-foundation-spatial-data
plan: 03
subsystem: database
tags: [truck-configs, jsonb, alembic, fastapi, pytest, oem-specs]

requires:
  - phase: 01-01
    provides: PostGIS truck_configs table, FastAPI/Fastify/Next.js stack health chain
provides:
  - eCascadia 438 kWh and T680E 375 kWh OEM physics seed JSON
  - Idempotent seed_trucks.py loader with parameterized SQLAlchemy upsert
  - GET /v1/trucks and GET /v1/trucks/{id} API with TruckConfigSummary/detail
  - Stack page truck config display with usable/nameplate ratio
affects: [01-04, 01-05, 01-06, phase-2-physics]

tech-stack:
  added: []
  patterns:
    - "OEM physics params stored in truck_configs.params JSONB; metadata columns via Alembic 002"
    - "Monorepo data/ingest scripts runnable from project root with simulator on PYTHONPATH"
    - "FastAPI trucks router follows spatial/routing router include pattern from Plan 01-02"

key-files:
  created:
    - data/trucks/ecascadia_438.json
    - data/trucks/t680e_375.json
    - data/ingest/seed_trucks.py
    - services/simulator/alembic/versions/002_truck_config_columns.py
    - services/simulator/app/routes/trucks.py
    - services/simulator/tests/test_truck_configs.py
  modified:
    - services/simulator/app/main.py
    - services/api/src/index.ts
    - apps/web/src/app/page.tsx

key-decisions:
  - "Use existing model_name column as upsert key; add is_active/version/source_notes via migration 002 rather than new name column"
  - "Store all physics fields (nameplate, usable, BMS reserve, charge_curve) inside params JSONB per D-10/D-11"
  - "Conservative usable kWh: ~90% nameplate minus 0.5 kWh BMS reserve (394 kWh eCascadia, 338 kWh T680E)"

patterns-established:
  - "Pattern: seed loaders upsert on natural key with ON CONFLICT DO UPDATE and ingested_at refresh"
  - "Pattern: truck API list returns truncated source_notes (200 chars); full params on detail endpoint"

requirements-completed: [DATA-03]

coverage:
  - id: D1
    description: "Two OEM truck configs seeded with conservative usable kWh and piecewise charge curves"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_truck_configs.py#test_two_models_seeded"
        status: unknown
      - kind: unit
        ref: "services/simulator/tests/test_truck_configs.py#test_usable_kwh_bounds"
        status: unknown
      - kind: unit
        ref: "services/simulator/tests/test_truck_configs.py#test_charge_curve_piecewise"
        status: unknown
    human_judgment: true
    rationale: "DB-backed pytest tests require live PostGIS — Docker daemon unavailable in executor environment"
  - id: D2
    description: "GET /v1/trucks list and detail endpoints with Fastify proxy and Next.js display"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_truck_configs.py#test_trucks_api_list"
        status: unknown
    human_judgment: true
    rationale: "TestClient API test shares seeded_db fixture requiring PostGIS"
  - id: D3
    description: "Idempotent seed_trucks.py re-run produces same two active rows"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_truck_configs.py#test_seed_idempotent"
        status: unknown
    human_judgment: true
    rationale: "Requires PostGIS for verification"

duration: 25min
completed: 2026-07-01
status: complete
---

# Phase 1 Plan 03: Truck Config Seeds Summary

**eCascadia 438 kWh and T680E 375 kWh OEM physics configs with conservative usable kWh, piecewise charge curves, and GET /v1/trucks API chain to stack page**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-01T15:00:00Z
- **Completed:** 2026-07-01T15:25:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Seeded Freightliner eCascadia (438 kWh nameplate, 394 kWh usable) and Kenworth T680E (375 kWh nameplate, 338 kWh usable) with full physics params per D-10/D-11/D-12
- Alembic migration 002 adds `is_active`, `version`, `source_notes`, and unique constraint on `model_name`
- Idempotent `data/ingest/seed_trucks.py` with parameterized SQLAlchemy upsert (T-03-01 mitigation)
- FastAPI `GET /v1/trucks` and `GET /v1/trucks/{id}` with summary/detail models; Fastify proxy; Next.js stack page shows usable/nameplate ratio

## Task Commits

Each task was committed atomically:

1. **Task 1: Truck config JSON seeds and idempotent loader** - `5f1cc46` (feat)
2. **Task 2: Truck list API and UI display** - `60f634a` (feat)

**TDD RED gate:** `1401dd7` (test) — truck config and API contract tests added before implementation

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `data/trucks/ecascadia_438.json` — eCascadia 438 kWh OEM physics seed with 4-point charge curve
- `data/trucks/t680e_375.json` — T680E 375 kWh OEM physics seed with 4-point charge curve
- `data/ingest/seed_trucks.py` — Idempotent upsert loader; runnable via `python -m data.ingest.seed_trucks`
- `services/simulator/alembic/versions/002_truck_config_columns.py` — Adds is_active, version, source_notes
- `services/simulator/app/routes/trucks.py` — TruckConfigSummary/detail endpoints
- `services/simulator/tests/test_truck_configs.py` — usable kWh, charge curve, API tests
- `services/simulator/app/main.py` — Register trucks router
- `services/api/src/index.ts` — Fastify GET /v1/trucks proxy
- `apps/web/src/app/page.tsx` — Truck config table with usable % column

## Decisions Made

- Used `model_name` (existing 001 schema column) as upsert key instead of adding a separate `name` column
- All physics fields live in `params` JSONB; metadata columns only for versioning/provenance (D-16)
- Port drayage aux_kw_base set to 10 kW for both models (elevated per D-12)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Alembic 002 migration for is_active/version/source_notes**
- **Found during:** Task 1 (test_two_models_seeded requires is_active column)
- **Issue:** 001 schema lacked is_active, version, source_notes columns referenced by plan and tests
- **Fix:** Added migration 002_truck_config_columns.py with unique constraint on model_name
- **Files modified:** services/simulator/alembic/versions/002_truck_config_columns.py
- **Committed in:** 5f1cc46

None otherwise — plan executed as written.

## TDD Gate Compliance

- RED: `1401dd7` test(01-03) commit present
- GREEN Task 1: `5f1cc46` feat(01-03) commit present
- GREEN Task 2: `60f634a` feat(01-03) commit present

## Issues Encountered

- Docker daemon unavailable in executor environment — DB-backed pytest tests skip; verification deferred to `docker compose up` + `pytest tests/test_truck_configs.py`

## User Setup Required

Run after `docker compose up`:

```bash
cd services/simulator && alembic upgrade head
PYTHONPATH=".:services/simulator" python -m data.ingest.seed_trucks
pytest tests/test_truck_configs.py -x -q
```

## Next Phase Readiness

- Truck configs queryable via API for Phase 2 physics engine input contract
- Run seed_trucks after compose startup to populate truck_configs (not wired into compose command yet)
- NHFN/charger ingest from parallel Plan 01-02 work may coexist; trucks router independent

## Self-Check: PASSED

- FOUND: data/trucks/ecascadia_438.json
- FOUND: data/trucks/t680e_375.json
- FOUND: data/ingest/seed_trucks.py
- FOUND: services/simulator/alembic/versions/002_truck_config_columns.py
- FOUND: services/simulator/app/routes/trucks.py
- FOUND: services/simulator/tests/test_truck_configs.py
- FOUND: 5f1cc46
- FOUND: 60f634a
- FOUND: 1401dd7

---
*Phase: 01-foundation-spatial-data*
*Completed: 2026-07-01*
