---
phase: 3
slug: charging-job-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (simulator), Node typecheck for api |
| **Config file** | `services/simulator/pytest.ini` |
| **Quick run command** | `cd services/simulator && pytest tests/test_charge_curve.py tests/test_charging_planner.py tests/test_feasibility.py tests/test_inputs_hash.py -q -m "not integration" -x` |
| **Full suite command** | `cd services/simulator && pytest tests/ -q -m "not integration"` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command above
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | CHRG-03 | — | N/A | unit | `pytest tests/test_charge_curve.py::test_taper_slows_above_70pct -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | CHRG-01/02 | — | N/A | unit | `pytest tests/test_charging_planner.py::test_triggers_at_soc_threshold -x` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | CHRG-04/05 | — | N/A | unit | `pytest tests/test_feasibility.py::test_infeasible_soc_deficit -x` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 3 | PLAT-02 | T-03-01 | inputs_hash SHA-256 only | unit | `pytest tests/test_inputs_hash.py -x` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 3 | PLAT-02 | T-03-02 | internal enqueue not public | integration | `pytest tests/test_simulations_job.py -m integration -x` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 4 | D-02 | — | N/A | unit | `pytest tests/test_simulate_api.py -x` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_charge_curve.py` — CHRG-03 piecewise integration
- [ ] `tests/test_charging_planner.py` — CHRG-01/02 greedy + detour mock
- [ ] `tests/test_feasibility.py` — CHRG-04/05 verdict + tier
- [ ] `tests/test_simulations_job.py` — PLAT-02 async lifecycle (`@integration`)
- [ ] `tests/test_inputs_hash.py` — cross-language hash vectors
- [ ] `services/api/src/inputs_hash.ts` + test — Node hash parity
- [ ] `app/worker.py` + Celery config — framework install
- [ ] `alembic/versions/003_simulation_runs.py` — schema migration
- [ ] `model_assumptions.md` §Charging — CHRG-06 weights + greedy rationale

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full Compose job pipeline E2E | PLAT-02 | Requires Redis + worker + Postgres | `docker compose up -d` then run integration test |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
