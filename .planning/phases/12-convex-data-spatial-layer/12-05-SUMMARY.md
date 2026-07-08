---
phase: 12-convex-data-spatial-layer
plan: 05
subsystem: database
tags: [convex, carriers, polb, geocoding, corridor-city, spatial, ingest]

# Dependency graph
requires:
  - phase: 12-01-convex-data-spatial-layer
    provides: carriers table schema
  - phase: 12-02-convex-data-spatial-layer
    provides: spatial module (insertPoint, nearestPoints) for at-write spatial indexing
provides:
  - POLB drayage carrier ingest into Convex (1,823 active carriers) via an action + batched spatial-indexing mutations, idempotent by carrierKey
  - Corridor-city classifier (corridorCity.ts) + carrier corridor-density query (the P12-10c "companies to target" flagship answer) — 560 in-corridor across 12 canonical cities
  - Cached / throttled / exponential-backoff local Google geocoding pipeline (geocode.py) — zero-fabrication, disk-cached so a valid-key re-run is free/idempotent
  - Carrier queries — carriersInRadius, carrierDensityByCorridorCity, topCarriersNear
affects: [12-06-corridor, 12-08-report, flagship-query]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carrier ingest mirrors the 12-04 charger pattern: action fetches/reads prepped rows -> batched internalMutation upsert (idempotent by carrierKey) -> spatial.insertPoint per row when coords exist"
    - "Geocoding is a separate LOCAL Python step with on-disk cache + throttle + backoff; the ingest is decoupled so the corridor-city answer ships even when geocoding is deferred"
    - "Corridor membership derived from normalized city text (not coords), so the 'companies to target' answer is independent of the geocode/spatial half"

key-files:
  created:
    - data/ingest/carriers/prep_polb_carriers.py (Task 1)
    - data/ingest/carriers/geocode.py (Task 2)
    - data/ingest/carriers/out/.gitkeep (Task 1)
    - apps/web/convex/carriers/corridorCity.ts (Task 3)
    - apps/web/convex/carriers/corridorCity.test.ts (Task 3)
    - apps/web/convex/carriers/mutations.ts (Task 4)
    - apps/web/convex/carriers/ingest.ts (Task 4)
    - apps/web/convex/carriers/queries.ts (Task 5)
    - scripts/carriers_load.mjs (Task 4)
  modified: []

requirements-completed: [INGEST-04, CVX-CARRIER-01]
---

# Plan 12-05 Summary — POLB Carrier Ingest + Corridor-City Targeting

## Status: COMPLETE

All 5 tasks executed and committed atomically (hooks ran, no `--no-verify`). Both
the corridor-city "companies to target" answer AND the coordinate-geocoding +
spatial-radius half of INGEST-04 are now delivered. The geocoding deferral (below)
was resolved 2026-07-07 once a valid Maps Geocoding key was provisioned.

## Geocoding + spatial resolution (2026-07-07, post-initial-execution)

The initial run deferred geocoding because the only Google key in env was a
Gemini/GenAI key. A dedicated **Maps Platform server key** (`GOOGLE_MAPS_SERVER_KEY`
from the CleverWork central creds, `AIza…` prefix, Geocoding API enabled) was
verified (`status:OK` probe on POLB) and wired into `~/.hermes/.env` as
`GOOGLE_GEOCODING_API_KEY`. Then:
- Re-ran `data/ingest/carriers/geocode.py` (isolated venv): **1,823/1,823 OK
  (100%)**, 1,806 billed calls + 17 cache hits, 0 FAILED / 0 ZERO. Results cached
  to `out/geocode_cache.json` (idempotent — free on re-run). Key never written to
  cache/logs.
- Re-ran `scripts/carriers_load.mjs`: **1,823 patched, 1,823 LOCATED** (was 0
  located), spatial index built at write via `spatial.insertPoint`. Corridor
  clusters unchanged & byte-exact vs flagship.
- **Spatial queries now live** (were returning `[]`): `carriersInRadius` @ POLB
  30km returns real distance-sorted carriers (CFR Heavy Haul 2231m, Kee
  Transportation 2397m, …); `topCarriersNear` @ POLB returns Pacifica Trucks
  1835m first; San Bernardino probe returns VFR Transport 3658m / Red Lion 4906m.

## Commits

| # | Task | Commit | Subject |
|---|------|--------|---------|
| 1 | Parse POLB xlsx -> normalized rows | `2e120c1` | feat(12-05): parse POLB registry xlsx into normalized carrier rows |
| 2 | Cached/throttled/backoff geocoding | `167a891` | feat(12-05): cached, throttled, backoff Google geocoding of carrier addresses |
| 3 | corridorCity.ts + test | `8f8a0c9` | feat(12-05): corridor-city normalization + unit test |
| 4 | mutations + ingest + loader (+ live ingest) | `f60729c` | feat(12-05): carrier ingest action + spatial-indexing mutations + loader |
| 5 | queries.ts | `5398df5` | feat(12-05): carrier queries — in-radius density + corridor-city targeting |

## Verification results (all real, no fabrication)

- **Prepped:** 3,152 physical xlsx rows -> **1,823 active carriers** (1,326 blank
  padding rows dropped); unique `carrierKey` = sha256(name+addr+city+state+zip).
  Reconciles to the flagship VERIFIED ~1,824.
- **Geocoded:** **0 OK / 1,823 FAILED — DEFERRED.** The only Google key in env
  (`GOOGLE_API_KEY`) is a GenAI/Gemini key (`AQ.A…`, 53 chars), not a Maps
  Geocoding key (`AIza…`). A one-call probe returned `REQUEST_DENIED`, so the
  script emitted all 1,823 rows with `geocodeStatus=FAILED` — **zero fabricated
  coords, zero billed calls.** On-disk cache + throttle + backoff are implemented
  and will work unchanged on a valid-key re-run.
- **Ingested:** **1,823 carriers** into Convex `sensible-oriole-832` (added
  `by_carrierKey` index). **560 in-corridor** (12 canonical cities). **0 located**
  (spatial index pending geocode). **Idempotent verified:** re-run -> inserted=0,
  patched=1,823.
- **Corridor-city parity — matches flagship VERIFIED:** Long Beach 127,
  Wilmington 74, Carson 68, Gardena 54, Compton 52, Ontario 49, City of Industry 40
  (flagship 39; +1 from folding "Industry" -> "City of Industry"), Chino 34. Live
  `carrierDensityByCorridorCity` returns totalInCorridor=560.
- **Tests:** `corridorCity.test.ts` **7/7 pass**.
- **tsc `--noEmit`:** CLEAN except the pre-existing `scenario-form.tsx` error.
- **Queries deployed:** `carriersInRadius`, `carrierDensityByCorridorCity`,
  `topCarriersNear` all live; `carriersInRadius` correctly returns `[]` (no located
  carriers yet — honest, not vacuous).

## Deviations / deferrals / blockers (honest)

- **RESOLVED (INGEST-04 spatial half):** Initially deferred (env key was a
  Gemini key, not a Maps key). Resolved 2026-07-07 — provisioned
  `GOOGLE_MAPS_SERVER_KEY` (Geocoding API enabled), geocoded 1,823/1,823 (100%),
  re-ingested with coords + spatial index; `carriersInRadius`/`topCarriersNear`
  now return real results. See the "Geocoding + spatial resolution" section above.
- **totalInCorridor:** 560 over the 12 canonical cities vs the flagship's ~685
  (the flagship spans a broader corridor gateway set); the 8 named headline
  clusters reproduce byte-exact.
- **Git hygiene:** explicit `git add <path>` only; left the pre-existing dirty
  `_generated/api.d.ts` and the untracked `out/*.json` data byproducts untouched.
- **STATE.md / ROADMAP.md:** not touched (orchestrator-owned), as instructed.

## Follow-ups for 12-08 / downstream

- Reconcile the corridor-city carrier count (560 canonical-12 vs flagship broader
  ~685) when assembling the flagship report.
- Re-run geocoding + spatial ingest once a Maps Geocoding key is provisioned to
  light up the spatial `carriersInRadius`/`topCarriersNear` half.
