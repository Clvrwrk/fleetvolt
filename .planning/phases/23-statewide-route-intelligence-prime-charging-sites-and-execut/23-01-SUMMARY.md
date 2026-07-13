---
phase: 23-statewide-route-intelligence-prime-charging-sites-and-execut
plan: 01
status: complete
completed: 2026-07-12
requirements: [STATE-ROUTE-01]
---

# Plan 23-01 Summary

## Outcome

Phase 23 now has a protected PR branch, a metadata-only worktree ownership receipt, deterministic 69-pair coverage/resume policy, receipt-backed single-provider leasing, and narrowly scoped signed admin wrappers. No provider route was called in this plan.

## Delivered

- Exact branch `cw-codex/phase-23-statewide-route-intelligence` with private tracked-byte baseline protection.
- Metadata/hash inventory for pre-existing untracked and proprietary reference files; those bytes remain immutable.
- `statewideRouteRuns`, `statewideRouteAttempts`, and `consumedAdminNonces` Convex tables with lookup indexes.
- Stable designated pair identity and ordering, exact PTV/geometry/freshness coverage classification, deterministic retry/backoff, idempotent attempt receipts, and one global provider lease.
- HMAC-SHA256 signed envelope with canonical body binding, 60-second maximum life, clock-skew enforcement, atomic nonce consumption, current/previous key rotation, emergency revocation, and redacted errors.
- Public admin actions limited to start/resume, claim one pair, record one attempt, and read coverage. They do not loop or call PTV.

## Verification

- Focused security/runner suites: 26 tests passed, 0 failed.
- TypeScript: `npx tsc --noEmit --pretty false --incremental false` passed.
- Focused ESLint: passed with zero warnings.
- Diff whitespace check: passed.
- Branch/baseline/receipt verification: passed.

## Security configuration contract

The Convex deployment reads reusable signing material only from server-side environment variables:

- `FLEETVOLT_ADMIN_CURRENT_KEY_ID`
- `FLEETVOLT_ADMIN_CURRENT_SIGNING_KEY`
- `FLEETVOLT_ADMIN_CURRENT_ACTIVATED_AT`
- Optional rotation: `FLEETVOLT_ADMIN_PREVIOUS_KEY_ID`, `FLEETVOLT_ADMIN_PREVIOUS_SIGNING_KEY`, `FLEETVOLT_ADMIN_PREVIOUS_OVERLAP_EXPIRES_AT`
- Optional emergency revocation: `FLEETVOLT_ADMIN_REVOKED_KEY_IDS`

The previous-key overlap must be under five minutes. Reusable keys, one-time signatures, nonces, full envelopes, and provider payload secrets are excluded from receipts and logs.

## Next

Wave 2 can now build the sequential CLI, typed route traffic/freight evidence, and standard 438-kWh prime-site scoring in parallel. Live provider generation remains blocked until the CLI tests and Convex deployment gate pass.
