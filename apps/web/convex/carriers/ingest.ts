// Carrier ingest ACTION (P12-09) — receives geocoded POLB carrier rows (read
// from data/ingest/carriers/out/carriers_geocoded.json by scripts/carriers_load.mjs,
// which chunks them ≤5MiB per call) and upserts them into Convex via batched
// internalMutations that spatial-index each LOCATED row (12-02).
//
// WHY AN ACTION (not a mutation): the loader may hand us up to ~1,823 rows; the
// action re-chunks to 500-row internalMutation calls (each well under the 1s
// mutation cap + 5MiB arg limit) and can run long. Geocoding itself is NOT done
// here — it ran locally in Python (12-05 geocode.py) with an on-disk cache so
// the geocodes bill once; this action only ingests the already-geocoded rows.
//
// Idempotent: upsert keyed by carrierKey (mutations.upsertCarrierBatch). Re-run
// patches, never duplicates. One fetchedAt stamped by the FIRST call and passed
// back by the loader so a multi-chunk load shares a single fetchedAt.
//
// usefulnessScore = the data-review-gate rubric OUTPUT on the POLB registry bytes
// (DINT-03), recorded in 12-05-SUMMARY.md:
//   identity/keys present (name, address, HD#/Seq#, stable carrierKey)   +2
//   authoritative first-party source (official POLB drayage registry)    +2
//   temporal context (dated registry snapshot 2026-07-01)                +1
//   coverage/completeness (full active registry, 1,823 carriers)         +1
//   address detail sufficient to geocode                                 +1
//   = 7/10  (docked 3: no per-row GPS in source — geocoding deferred when no
//            valid Maps key; no per-carrier fleet-size / status / SCAC field)
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { chunk } from "../lib/csvChunk";

const USEFULNESS_SCORE = 7;
const BATCH_SIZE = 500;

const carrierRow = v.object({
  carrierKey: v.string(),
  name: v.string(),
  address: v.optional(v.union(v.string(), v.null())),
  city: v.optional(v.union(v.string(), v.null())),
  state: v.optional(v.union(v.string(), v.null())),
  zip: v.optional(v.union(v.string(), v.null())),
  lat: v.optional(v.union(v.number(), v.null())),
  lng: v.optional(v.union(v.number(), v.null())),
  geocodeStatus: v.optional(v.union(v.string(), v.null())),
});

export const run = action({
  args: {
    rows: v.array(carrierRow),
    // Optional shared timestamp so a multi-chunk load stamps ONE fetchedAt.
    fetchedAt: v.optional(v.number()),
  },
  handler: async (ctx, { rows, fetchedAt: fetchedAtArg }) => {
    if (rows.length === 0) {
      throw new Error(
        "carriers/ingest:run received zero rows — refusing to proceed (no " +
          "fabricated carriers). Run prep_polb_carriers.py + geocode.py first.",
      );
    }
    const fetchedAt = fetchedAtArg ?? Date.now();

    let inserted = 0;
    let patched = 0;
    let located = 0;
    let inCorridor = 0;
    for (const batch of chunk(rows, BATCH_SIZE)) {
      const res = await ctx.runMutation(
        internal.carriers.mutations.upsertCarrierBatch,
        { rows: batch, fetchedAt, usefulnessScore: USEFULNESS_SCORE },
      );
      inserted += res.inserted;
      patched += res.patched;
      located += res.located;
      inCorridor += res.inCorridor;
    }

    const result = {
      received: rows.length,
      inserted,
      patched,
      located,
      inCorridor,
      fetchedAt,
    };
    console.log("carriers/ingest:run", JSON.stringify(result));
    return result;
  },
});
