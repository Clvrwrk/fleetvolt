---
phase: 1
slug: foundation-spatial-data
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + Ruff (Python); Vitest or `tsc --noEmit` (Node, Wave 0) |
| **Config file** | `services/simulator/pytest.ini` (Wave 0); `turbo.json` tasks |
| **Quick run command** | `turbo run test --filter=@fleetvolt/simulator` |
| **Full suite command** | `turbo run lint typecheck test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** `pytest tests/ -q --tb=no -x` (simulator)
- **After every plan wave:** `turbo run lint typecheck test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | PLAT-01 | — | N/A | smoke | `docker compose ps` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | DATA-01 | — | N/A | integration | `pytest tests/test_nhfn_ingest.py::test_socal_coverage -x` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 3 | DATA-03 | — | N/A | unit | `pytest tests/test_truck_configs.py::test_usable_kwh_bounds -x` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 4 | DATA-02, DATA-05 | T-01 | Parameterized SQL only | unit | `pytest tests/test_charger_filter.py::test_hd_heuristic -x` | ❌ W0 | ⬜ pending |
| 01-05-01 | 05 | 5 | PLAT-01 | — | N/A | smoke | Valhalla truck route POLB→San Bernardino | ❌ W0 | ⬜ pending |
| 01-06-01 | 06 | 6 | DATA-04, PLAT-03 | — | N/A | integration | `pytest tests/test_elevation_cache.py::test_cajon_no_spikes -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/simulator/tests/conftest.py` — PostGIS fixture, DATABASE_URL from env
- [ ] `services/simulator/pytest.ini` — markers for `integration` vs `unit`
- [ ] `services/simulator/tests/test_spatial_queries.py` — ST_DWithin charger smoke query
- [ ] `.github/workflows/ci.yml` — postgis service container + pnpm cache
- [ ] `packages/shared-types` codegen check in CI — fail if OpenAPI drift
- [ ] Framework install: root `pnpm install`; simulator `uv pip install -r requirements.txt`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Valhalla SoCal tile build completes | PLAT-01 | First build 30–90 min | Run `docker compose up valhalla`; confirm truck route returns polyline for POLB→San Bernardino |
| NREL API key provisioning | DATA-02 | External signup | Obtain key from developer.nrel.gov; set `NREL_API_KEY` in `.env` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
