// FAF freight-out-of-port ACTION (P12-03) — the 10-min-budget ingest of the
// prepped zone-061 aggregate JSON into freightOD via batched internalMutations.
//
// SPLIT rationale (RESEARCH §2/§3): the raw source is 695MB / 2.6M rows, past a
// Convex action's 5MiB arg cap. The streaming Python prep
// (data/ingest/faf/prep_faf_zone061.py filter) pre-filters to dms_orig=061 and
// aggregates to ~105k rows (~13MB JSON). The LOADER (scripts/faf_load.mjs) reads
// that JSON, chunks it to ≤5MiB super-chunks, and calls this action once per
// super-chunk. This action then sub-chunks each super-chunk to 500 rows and
// calls upsertFreightODBatch — respecting the mutation 1s cap. One fetchedAt is
// stamped by the loader and threaded through every call (idempotent per run).
//
// INVOCATION (idempotent — safe to re-run):
//   1. python data/ingest/faf/prep_faf_zone061.py lookups && ... filter
//   2. node scripts/faf_load.mjs        (reads both JSONs, calls lookups+run)
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { chunk } from "../lib/csvChunk";

const freightODRow = v.object({
  year: v.number(),
  dmsOrig: v.string(),
  dmsDest: v.string(),
  dmsMode: v.optional(v.string()),
  sctg2: v.optional(v.string()),
  tonsKtons: v.optional(v.number()),
  valueUSD: v.optional(v.number()),
});

// usefulnessScore is the data-review-gate rubric OUTPUT on the FAF bytes
// (DINT-03), passed in by the loader — never a hardcoded catalog guess. The
// derived score + rationale live in the loader + SUMMARY.
export const run = action({
  args: {
    rows: v.array(freightODRow),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  handler: async (ctx, { rows, fetchedAt, usefulnessScore }) => {
    let inserted = 0;
    let patched = 0;
    // Sub-chunk to 500 rows/mutation (1s cap). Even a 5MiB super-chunk is many
    // hundreds of rows; loop stays inside the 10-min action budget.
    for (const batch of chunk(rows, 500)) {
      const res = await ctx.runMutation(
        internal.faf.mutations.upsertFreightODBatch,
        { rows: batch, fetchedAt, usefulnessScore },
      );
      inserted += res.inserted;
      patched += res.patched;
    }
    return { inserted, patched, total: rows.length };
  },
});
