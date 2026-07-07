// Highway-segment ingest ACTION (P12-06) — receives prepped CalTrans Truck-AADT
// segment rows (read from data/ingest/caltrans/out/caltrans_segments.json by
// scripts/highways_load.mjs, which chunks them ≤5MiB per `npx convex run` call)
// and upserts them into Convex `highwaySegments` via batched internalMutations.
//
// WHY AN ACTION (not a plain mutation): the full CalTrans set is ~6,865 rows;
// the action re-chunks to 500-row internalMutation calls (each well under the
// 1s mutation cap + 5MiB arg limit) and can run long. Unlike the charger/carrier
// point ingests, this writes LINE rows (bbox+path) and does NOT spatial-index
// via the geospatial component — the bbox stored on each row is the index the
// 12-02 line queries (segmentsInBbox) use, so batches can be larger than the
// point-ingest's 50 (no per-row component re-index tree walk).
//
// Idempotent: upsert keyed by segmentId ("CT-<OBJECTID>"). Re-run patches,
// never duplicates. One fetchedAt stamped by the FIRST call and threaded back by
// the loader so a multi-chunk load shares a single fetchedAt.
//
// usefulnessScore = the data-review-gate rubric OUTPUT on the CalTrans bytes
// (DINT-03), rationale recorded in 12-06-SUMMARY.md:
//   identity/keys present (OBJECTID, RTE, POSTMILE, stable segmentId)     +2
//   precise geography (WGS84 postmile lat/lng)                            +1
//   temporal context (EST_YEAR dataset vintage per segment)              +1
//   measured public state source (CalTrans traffic census)               +2
//   full axle-class breakdown + provenance (method:"measured")            +1
//   coverage (statewide, all 6,865 postmiles)                            +1
//   = 8/10  (docked 2: postmile POINTS not routed LINESTRINGs — no true
//            polyline corridor geometry; per-segment estimate-year varies)
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { chunk } from "../lib/csvChunk";

const USEFULNESS_SCORE = 8;
const BATCH_SIZE = 500;

const segmentRow = v.object({
  segmentId: v.string(),
  route: v.string(),
  path: v.array(v.object({ lat: v.number(), lng: v.number() })),
  bbox: v.object({
    minLat: v.number(),
    minLng: v.number(),
    maxLat: v.number(),
    maxLng: v.number(),
  }),
  truckAADT: v.optional(v.union(v.number(), v.null())),
  aadt: v.optional(v.union(v.number(), v.null())),
  year: v.optional(v.union(v.number(), v.null())),
});

export const run = action({
  args: {
    rows: v.array(segmentRow),
    // Optional shared timestamp so a multi-chunk load stamps ONE fetchedAt.
    fetchedAt: v.optional(v.number()),
  },
  handler: async (ctx, { rows, fetchedAt: fetchedAtArg }) => {
    if (rows.length === 0) {
      throw new Error(
        "highways/ingest:run received zero rows — refusing to proceed (no " +
          "fabricated segments). Run data/ingest/caltrans/prep_truck_aadt.py first.",
      );
    }
    const fetchedAt = fetchedAtArg ?? Date.now();

    let inserted = 0;
    let patched = 0;
    let withTruck = 0;
    for (const batch of chunk(rows, BATCH_SIZE)) {
      const res = await ctx.runMutation(
        internal.highways.mutations.upsertSegmentBatch,
        { rows: batch, fetchedAt, usefulnessScore: USEFULNESS_SCORE },
      );
      inserted += res.inserted;
      patched += res.patched;
      withTruck += res.withTruck;
    }

    const result = {
      received: rows.length,
      inserted,
      patched,
      withTruck,
      fetchedAt,
    };
    console.log("highways/ingest:run", JSON.stringify(result));
    return result;
  },
});
