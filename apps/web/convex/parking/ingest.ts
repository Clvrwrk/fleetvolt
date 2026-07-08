// Parking ingest ACTION (P12-06 item 6) — receives prepped NATD CA truck-stop
// parking rows (read from data/ingest/natd/out/natd_parking.json by
// scripts/natd_load.mjs, chunked ≤5MiB per `npx convex run`) and upserts them
// into Convex `parking` via batched internalMutations that spatial-index every
// row (12-02). numberOfSpots is the P12-12 capacity proxy.
//
// Idempotent: upsert keyed by parkingKey. One fetchedAt stamped by the first
// call and threaded back by the loader so a multi-chunk load shares it.
//
// usefulnessScore = the data-review-gate rubric OUTPUT on the NATD bytes
// (DINT-03), rationale in 12-07-SUMMARY.md:
//   identity/keys (OBJECTID, stable parkingKey)                 +2
//   precise geography (WGS84 lat/lng per site)                  +1
//   measured public federal source (NATD/BTS truck-stop census) +2
//   capacity proxy present (number_of_spots on every CA row)    +1
//   provenance method:"measured" + hgv-by-definition            +1
//   = 7/10  (docked 3: no per-site vintage/date, small CA n=83,
//            spot counts are static NATD snapshots not live occupancy)
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { chunk } from "../lib/csvChunk";

const USEFULNESS_SCORE = 7;
const BATCH_SIZE = 50;

const parkingRow = v.object({
  parkingKey: v.string(),
  name: v.optional(v.union(v.string(), v.null())),
  lat: v.number(),
  lng: v.number(),
  numberOfSpots: v.optional(v.union(v.number(), v.null())),
  hgv: v.optional(v.boolean()),
});

export const run = action({
  args: {
    rows: v.array(parkingRow),
    fetchedAt: v.optional(v.number()),
  },
  handler: async (ctx, { rows, fetchedAt: fetchedAtArg }) => {
    if (rows.length === 0) {
      throw new Error(
        "parking/ingest:run received zero rows — refusing to proceed (no " +
          "fabricated parking). Run data/ingest/natd/prep_parking.py first.",
      );
    }
    const fetchedAt = fetchedAtArg ?? Date.now();

    let inserted = 0;
    let patched = 0;
    let withSpots = 0;
    for (const batch of chunk(rows, BATCH_SIZE)) {
      const res = await ctx.runMutation(
        internal.parking.mutations.upsertParkingBatch,
        { rows: batch, fetchedAt, usefulnessScore: USEFULNESS_SCORE },
      );
      inserted += res.inserted;
      patched += res.patched;
      withSpots += res.withSpots;
    }

    const result = { received: rows.length, inserted, patched, withSpots, fetchedAt };
    console.log("parking/ingest:run", JSON.stringify(result));
    return result;
  },
});
