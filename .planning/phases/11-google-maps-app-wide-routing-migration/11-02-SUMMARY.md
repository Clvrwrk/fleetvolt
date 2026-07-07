---
phase: 11-google-maps-app-wide-routing-migration
plan: 02
subsystem: infra
tags: [docker-compose, valhalla-teardown, makefile, ptv-routing]

requires:
  - phase: 11-01
    provides: "routing migrated to PTV Developer Routing API (Valhalla no longer referenced by any live code path)"
provides:
  - "docker-compose.yml with the valhalla service removed and VALHALLA_URL dropped from simulator + sim-worker"
  - "Makefile reduced to a retirement doc-note (Valhalla PBF/verify/status targets removed)"
affects: [14-vercel-decommission-docker]

tech-stack:
  removed: [valhalla-service]
  patterns: [smallest-possible-teardown-only-valhalla]

key-files:
  modified:
    - docker-compose.yml
    - Makefile

key-decisions:
  - "ONLY Valhalla left the stack (P11-06). postgres/PostGIS, redis, simulator, sim-worker, api, web all retained — full Docker decommission is Phase 14."
  - "scripts/build_socal_pbf.sh, scripts/verify_valhalla_*.sh, and data/socal.osm.pbf RETAINED on disk (unused at runtime); deletion deferred to Phase 14 per 11-RESEARCH §4."
  - "Ran AFTER 11-01 so no window existed where the stack referenced a removed routing service."
---

# Phase 11 Plan 02 — Valhalla Service Teardown — Summary

**Requirements addressed:** P11-06 (re-scoped v3.0 ID: ROUT-02).

## What was done

1. **docker-compose.yml** — removed the entire `valhalla:` service block (image, tile_urls, custom_files volume, port 8002, 3600s-start_period healthcheck) and the now-dead `VALHALLA_URL: http://valhalla:8002` env line from BOTH the `simulator` and `sim-worker` services. postgres/redis/simulator/sim-worker/api/web and the volumes block untouched.
2. **Makefile** — removed the 4 Valhalla targets (valhalla-pbf, valhalla-verify-pbf, valhalla-verify-route, valhalla-status) and reduced the file to a `help` no-op plus a retirement doc-note (routing on PTV; scripts + .pbf retained on disk, unused; full cleanup deferred to Phase 14).

## Verification (real results)

- `docker compose config` → **COMPOSE_VALID**.
- `docker compose config --services` → **api postgres redis sim-worker simulator web** → **VALHALLA_GONE** (exactly 6, no valhalla).
- `grep valhalla|VALHALLA_URL|8002 docker-compose.yml` → **NO_VALHALLA_IN_COMPOSE**.
- Makefile `valhalla` hits are the retirement comment only; `make -n help` parses.
- **Live boot:** `docker compose up -d postgres redis simulator` recreated the simulator WITHOUT valhalla; the old `fleetvolt-valhalla-1` container was flagged as an ORPHAN (proof it left the compose file) and was removed. Simulator health → `{"status":"ok"}`. Zero valhalla/connection-refused errors in simulator logs. Final `docker compose ps`: all 6 services Up (postgres/redis healthy).

## Deviations / notes

- **Scope discipline:** docker-compose.yml carried PRE-EXISTING uncommitted dirt (FLEETVOLT_DATA_ROOT env, `python -m app.bootstrap_db` command, web build-context change) that predates this session and is NOT part of Phase 11. Only the Valhalla-removal hunks were staged/committed (surgical `git add -p`-style); the pre-existing dirt was left in the working tree untouched.
- The orphaned `fleetvolt-valhalla-1` container was removed with `docker rm -f`; the Valhalla image + `data/valhalla/` tiles remain on disk (Phase-14 cleanup).

## Output

Plan 11-02 complete. **Phase 11 (all 3 plans) done** — routing on PTV, maps on Google, Valhalla retired. Remaining before phase close: human manual visual check of MAP-01/02/03 on /planner (see 11-03-SUMMARY).

## Post-execution fix (deployment gap, 2026-07-07)

**Symptom:** `/planner` showed `API 500: Internal Server Error` on every simulation run after Phase 11.

**Root cause (two compounding gaps the plans missed):**
1. The deployed `simulator`/`sim-worker` docker images still contained the OLD Valhalla code — 11-01 changed the source + ran host-side pytest (green) but never rebuilt the images. After 11-02 removed the Valhalla service, the stale container tried to reach a service that no longer existed.
2. Even after rebuilding, `PTV_DEVELOPER_API_KEY` was never plumbed into the docker env — the compose file passed `VALHALLA_URL` (now removed) but nothing wired in PTV's key.

**Fix:**
- `docker compose build simulator sim-worker` → rebuilt images with the PTV code (verified: 11 PTV refs in the running container, 0 Valhalla).
- Added `PTV_DEVELOPER_API_KEY: ${PTV_DEVELOPER_API_KEY:-}` to the simulator + sim-worker env blocks (commit `db28787`); created a root `.env` (gitignored) carrying the key.
- Recreated containers → key present in both.

**Verified end-to-end (real):**
- Direct PTV call from the container: POLB→San Bernardino returns **distance_m=117,432 (~73 mi)**, **1,296 [lon,lat] coords** (POLB→SB endpoints correct), **edge_speeds=[]** (posted-speed fallback as designed).
- Full API simulation (`polb_cajon_pass`, `ecascadia_438`, ideal, 40k lb, drayage): job **COMPLETE**, **total 231.86 kWh** real physics output.
- `API 500` resolved.

**Lesson:** GSD executors that verify via host-side unit tests must ALSO rebuild+redeploy the container images when the change affects a containerized service — host green ≠ deployed green. Captured for future migration phases (and Phase 14's Vercel/Convex deploy).
