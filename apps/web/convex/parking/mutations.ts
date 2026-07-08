// Parking ingest mutations (P12-06 item 6) — batched, idempotent
// internalMutations that upsert NATD truck-stop parking by parkingKey AND
// spatial-index each row at write time (12-02 spatial.insertPoint) so
// parkingInRadius() is immediately queryable. Called from parking/ingest.ts,
// chunked ≤50/call (under the 1s mutation cap + 5MiB arg + geospatial-component
// 4096-reads/mutation re-index limit — same batch discipline as chargers).
//
// numberOfSpots is the P12-12 capacity PROXY the 12-08 hotspot score consumes.
// Truck-stop parking is HGV by definition (hgv:true set by the prep).
//
// Idempotency: upsert keyed by parkingKey (stable NATD hash, by_parkingKey
// index) — re-running patches, never duplicates.
//
// Provenance (P12-06): {source:"NATD", fetchedAt, usefulnessScore,
// matchMethod:"geo", method:"measured"} — NATD reports MEASURED spot counts.
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { insertPoint } from "../lib/spatial";

const parkingRow = v.object({
  parkingKey: v.string(),
  name: v.optional(v.union(v.string(), v.null())),
  lat: v.number(),
  lng: v.number(),
  numberOfSpots: v.optional(v.union(v.number(), v.null())),
  hgv: v.optional(v.boolean()),
});

export const upsertParkingBatch = internalMutation({
  args: {
    rows: v.array(parkingRow),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  handler: async (ctx, { rows, fetchedAt, usefulnessScore }) => {
    let inserted = 0;
    let patched = 0;
    let withSpots = 0;

    for (const r of rows) {
      const numberOfSpots = r.numberOfSpots ?? undefined;
      if (typeof numberOfSpots === "number") withSpots += 1;

      const doc = {
        parkingKey: r.parkingKey,
        name: r.name ?? undefined,
        location: { lat: r.lat, lng: r.lng },
        numberOfSpots,
        hgv: r.hgv ?? true,
        provenance: {
          source: "NATD" as const,
          fetchedAt,
          usefulnessScore,
          matchMethod: "geo",
          method: "measured" as const,
        },
      };

      const existing = await ctx.db
        .query("parking")
        .withIndex("by_parkingKey", (q) => q.eq("parkingKey", r.parkingKey))
        .unique();

      let id;
      if (existing) {
        await ctx.db.patch(existing._id, doc);
        id = existing._id;
        patched += 1;
      } else {
        id = await ctx.db.insert("parking", doc);
        inserted += 1;
      }

      // Spatial-index at write time (12-02). filterFields {hgv} lets the report
      // query filter to HGV parking in-index. No-op on the haversine backend.
      await insertPoint(ctx, {
        table: "parking",
        id,
        location: { lat: r.lat, lng: r.lng },
        filterFields: { hgv: r.hgv ?? true },
      });
    }

    return { inserted, patched, withSpots, total: rows.length };
  },
});
