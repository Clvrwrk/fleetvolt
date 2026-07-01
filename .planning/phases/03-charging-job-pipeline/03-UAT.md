---
status: testing
phase: 03-charging-job-pipeline
source: [03-VERIFICATION.md]
started: 2026-07-01T12:00:00Z
updated: 2026-07-01T12:00:00Z
---

## Current Test

number: 1
name: Docker Compose async E2E job pipeline
expected: |
  Start Docker Compose stack; POST /v1/simulations on :4000 with include_charging=true; poll GET /v1/simulations/{id} until COMPLETE. outputs contain charging_stops[], feasibility{verdict,tier}, and full segment arrays.
awaiting: user response

## Tests

### 1. Docker Compose async E2E
expected: Run `docker compose up -d` then `pytest tests/test_simulations_job.py -m integration -v` from services/simulator. test_async_submit_poll_complete and test_enqueue_to_worker_lifecycle pass; poll payload includes charging_stops and feasibility.
result: [pending]

### 2. Node API unit tests
expected: From services/api, run `pnpm test` after deps installed. simulations.test.ts and inputs_hash.test.ts pass — cache hit skips enqueue, cache miss returns PENDING and calls enqueue URL.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
