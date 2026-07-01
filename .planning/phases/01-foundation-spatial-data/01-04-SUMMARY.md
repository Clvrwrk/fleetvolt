---
phase: 01-foundation-spatial-data
plan: 04
subsystem: database
tags: [nrel-afdc, postgis, chargers, spatial-query, data-freshness, fastapi, pytest]

requires:
  - phase: 01-01
    provides: chargers table, data_freshness table, PostGIS GIST indexes, FastAPI/Fastify/Next.js stack
  - phase: 01-02
    provides: data/ingest module pattern, stack page freshness display hooks
provides:
  - NREL AFDC ≥350 kW SoCal charger ingest with HD heuristic (D-05, D-06, D-16)
  - Weekly idempotent refresh_chargers.py with data_freshness metadata (D-17)
  - GET /v1/chargers/near spatial query and GET /v1/data/freshness API
  - hd_capable() pure function and offline fixture CSV for CI
affects: [01-05, 01-06, phase-3-charging, CHRG-02]

tech-stack:
  added: [httpx]
  patterns:
    - "Per-connector kW parsed from EV CCS Power Output field, not station header max"
    - "Haversine 200 mi POLB radius filter before PostGIS upsert per D-04"
    - "data_freshness upsert on dataset_name='nrel_afdc_chargers' after each refresh"
    - "Fixture CSV fallback when NREL_API_KEY absent for offline CI"

key-files:
  created:
    - data/ingest/chargers.py
    - data/ingest/refresh_chargers.py
    - data/raw/nrel/chargers_sample.csv
    - services/simulator/app/routes/chargers.py
    - services/simulator/tests/test_charger_filter.py
    - services/simulator/tests/test_charger_refresh.py
  modified:
    - services/simulator/app/main.py
    - services/api/src/index.ts
    - apps/web/src/app/page.tsx
    - docker-compose.yml

key-decisions:
  - "hd_capable requires power >= 350 kW AND connector in {J1772COMBO, J3271, CCS, MCS} per D-06"
  - "Geographic filter uses haversine <= 200 mi from POLB before DB insert; spatial API uses ST_DWithin"
  - "Refresh script auto-selects fixture mode when NREL_API_KEY unset; live API for production VPS cron"

patterns-established:
  - "Pattern: ingest modules expose pure filter functions (hd_capable, within_socal_radius) unit-testable without network"
  - "Pattern: refresh scripts call ingest + update data_freshness row_count in single transaction"

requirements-completed: [DATA-02, DATA-05]

coverage:
  - id: D1
    description: "NREL AFDC ingest filters ≥350 kW HD-capable chargers within 200 mi of POLB with provenance"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_charger_filter.py#test_hd_heuristic"
        status: pass
      - kind: unit
        ref: "services/simulator/tests/test_charger_filter.py#test_power_floor"
        status: pass
      - kind: unit
        ref: "services/simulator/tests/test_charger_filter.py#test_socal_radius"
        status: pass
      - kind: unit
        ref: "services/simulator/tests/test_charger_filter.py#test_provenance"
        status: pass
    human_judgment: false
  - id: D2
    description: "Weekly refresh upserts idempotently and updates nrel_afdc_chargers freshness metadata"
    requirement: DATA-05
    verification:
      - kind: unit
        ref: "services/simulator/tests/test_charger_refresh.py#test_upsert_idempotent"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET /v1/chargers/near returns HD chargers near POLB sorted by ST_Distance"
    requirement: DATA-02
    verification:
      - kind: manual_procedural
        ref: "curl http://localhost:8000/v1/chargers/near?lat=33.754&lon=-118.216&radius_m=100000&hd_only=true"
        status: pass
    human_judgment: true
    rationale: "Live NREL API ingest requires NREL_API_KEY; human verified SoCal HD charger response"
  - id: D4
    description: "GET /v1/data/freshness exposes nrel_afdc_chargers last_ingested_at for stack UI badges"
    requirement: DATA-05
    verification:
      - kind: manual_procedural
        ref: "curl http://localhost:8000/v1/data/freshness"
        status: pass
    human_judgment: true
    rationale: "Freshness timestamp confirmed today after live refresh_chargers run"

duration: 35min
completed: 2026-07-01
status: complete
---

# Phase 1 Plan 04: NREL Charger Ingest Summary

**NREL AFDC ≥350 kW HD-capable charger ingest for SoCal with weekly refresh, ST_DWithin spatial API, and freshness metadata on stack page**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-01T15:00:00Z
- **Completed:** 2026-07-01T15:35:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- NREL AFDC ingest script filters ≥350 kW chargers within 200 mi of POLB with per-connector kW parsing and HD heuristic
- Weekly `refresh_chargers.py` upserts idempotently and updates `data_freshness` row for `nrel_afdc_chargers`
- `GET /v1/chargers/near` and `GET /v1/data/freshness` exposed via FastAPI with Fastify proxy and stack page display
- Human verified live NREL ingest returns SoCal HD chargers with `power_kw >= 350` and `hd_capable=true`

## Task Commits

Each task was committed atomically:

1. **Task 1: NREL ingest with HD heuristic and SoCal geographic filter** - `1401dd7` (test/feat)
2. **Task 2: Weekly refresh script and charger spatial API** - `b3f6dba` (feat)
3. **Task 3: Checkpoint — Verify live NREL charger ingest near POLB** - human approved (no code commit)

**Plan metadata:** `88716a1` (docs: complete plan)

## Files Created/Modified

- `data/ingest/chargers.py` - NREL CSV fetch/parse, HD filter, haversine SoCal radius, PostGIS upsert
- `data/ingest/refresh_chargers.py` - Weekly refresh CLI with freshness metadata update
- `data/raw/nrel/chargers_sample.csv` - Offline fixture for CI without API key
- `services/simulator/app/routes/chargers.py` - `/v1/chargers/near` and `/v1/data/freshness` endpoints
- `services/simulator/tests/test_charger_filter.py` - HD heuristic, power floor, radius, provenance tests
- `services/simulator/tests/test_charger_refresh.py` - Idempotent upsert test
- `services/simulator/app/main.py` - Chargers router registration
- `services/api/src/index.ts` - Fastify proxy routes for charger and freshness endpoints
- `apps/web/src/app/page.tsx` - Charger count, HD count, and NREL freshness timestamp display

## Decisions Made

- Per-connector kW from `EV CCS Power Output` field per RESEARCH Pitfall 3 (not station header max)
- `hd_capable()` extracted as pure function for unit tests without network
- Fixture CSV mode when `NREL_API_KEY` absent; VPS cron documented as `0 3 * * 1`

## Deviations from Plan

None - plan executed exactly as written. Human checkpoint approved live NREL ingest verification.

## Issues Encountered

None

## User Setup Required

**NREL AFDC API key required for live production refresh.**

- Set `NREL_API_KEY` in `.env` from https://developer.nrel.gov/signup/
- Run: `python -m data.ingest.refresh_chargers`
- Verify: `curl "http://localhost:8000/v1/chargers/near?lat=33.754&lon=-118.216&radius_m=100000&hd_only=true"`

## Next Phase Readiness

- Charger spatial data ready for Phase 3 charging planner (`CHRG-02` HD filter)
- Plan 01-05 (Valhalla truck routing) and 01-06 (elevation cache, CI) can proceed in parallel waves
- Elevation cache (DATA-04) remains pending in Phase 1

## Self-Check: PASSED

- FOUND: data/ingest/chargers.py
- FOUND: data/ingest/refresh_chargers.py
- FOUND: services/simulator/app/routes/chargers.py
- FOUND: services/simulator/tests/test_charger_filter.py
- FOUND: services/simulator/tests/test_charger_refresh.py
- FOUND: 1401dd7
- FOUND: b3f6dba

---
*Phase: 01-foundation-spatial-data*
*Completed: 2026-07-01*
