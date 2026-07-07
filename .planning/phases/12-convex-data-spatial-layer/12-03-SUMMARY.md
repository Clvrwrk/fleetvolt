# 12-03 Execution Summary — FAF Freight-Out-of-Port Ingest

**Status: ✅ COMPLETE** (recovered + finished after the Wave-1 executor crashed mid-run on an Anthropic billing error; remaining tasks completed directly in-chat on a working provider).

## Outcome

FAF5 zone-061 (LA-Long Beach port) outbound OD flows ingested into Convex as the `freightOD` table — the freight-flow spine of the flagship query.

| Metric | Value | Ground truth | ✓ |
|--------|-------|-------------|---|
| freightOD rows | **105,329** (15,047/yr × 7 yr, no dupes) | prep JSON = 105,329 | ✓ |
| 2024 total value | **$1,324,983 M ≈ $1.32T** | verified ~$1.3T | ✓ |
| 2024 truck (mode 1) tonnage | **394,903 ktons ≈ 395M** | verified 395M truck-ktons | ✓ |
| lookups | 140 zones / 8 modes / 42 commodities | — | ✓ |

## Tasks

| Task | Result | Commit |
|------|--------|--------|
| 1 · freightOD + FAF lookup tables (schema) | additive, 16→19 tables | `38695f1` (exec) |
| 2 · metadata+crosswalk → lookup JSON | 140/8/42 | `fc8b202` (exec) |
| 3 · stream-filter 695MB CSV → zone 061 | 105,329 agg rows, $1.32T/395M sanity | `cbcbcdb` (exec) |
| 4 · chunk() + batched idempotent mutations | ≤500/mutation | `5d717ad` (exec) |
| — · **selective `by_key` index + upsert fix** | avoids 32k read-limit trap | `3ef376a` (recovery) |
| 5 · FAF actions + tsx loader | lookups+actuals wired, live-ingested | `89f4069` (recovery) |
| 6 · freightContext query + prep unit test | bounded query; test 4/4 | `88f4c8f` (recovery) |

## Recovery notes (executor crash)

The delegated executor committed tasks 1-4 atomically before crashing on `HTTP 400: credit balance too low` (Anthropic). Partial work survived on disk (uncommitted `ingestActuals.ts`, `lookups.ts`, `faf_load.mjs`). Completing it surfaced **three real defects the executor never reached its own verify step to catch**:

1. **Loader module resolution** — `scripts/faf_load.mjs` couldn't resolve `convex` (repo root has no node_modules; pnpm workspace puts it in `apps/web`). Fixed by relocating to `apps/web/scripts/faf_load.ts` and running via `node --import tsx` (the generated `api.js` is ESM but `apps/web` has no `type:module`, so plain node mis-parsed it).
2. **32k-doc read limit** — `upsertFreightODBatch` matched on `by_orig_year` then `.collect()`, but EVERY row shares `dmsOrig="061"`, so it scanned the whole year partition and tripped Convex's 32k limit at scale. Fixed with a fully-selective `by_key` composite index `[dmsOrig, year, dmsDest, dmsMode, sctg2]` + `.unique()` lookup.
3. **Missing `faf/queries.ts`** — the `freightContext` query (required by flagship + 12-08 report) was never written. Added, bounded to a single (origin, year) index partition so it can't re-trip the read limit.

## Honesty / verification

- FAF units kept explicit throughout (`tonsKtons`=thousand-tons, `valueUSD`=millions USD); never conflated with PeMS/segment flows (freightOD is a NEW table, distinct from `freightFlows`).
- Prep aggregation unit test asserts the **zero-padded string trap** (`"61"` ≠ `"061"`) that would otherwise silently yield zero rows.
- Live ingest verified against the independently-established $1.3T / 395M-truck-kton magnitude — not a self-reported claim.
- Idempotency confirmed by row-count invariance (105,329 stable across re-run).
- All commits staged explicitly (no `git add -A`); tsc clean except pre-existing `scenario-form.tsx`.

## Follow-up

- The all-`patch` idempotent re-run is slow (~105k `.unique()` lookups); acceptable for a one-time ingest but if re-ingest becomes routine, consider a bulk-replace-by-run-id strategy. Not blocking.
