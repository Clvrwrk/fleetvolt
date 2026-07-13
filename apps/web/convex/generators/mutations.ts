/**
 * trafficGenerators upsert — idempotent by generatorId.
 */
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const generatorRow = v.object({
  generatorId: v.string(),
  name: v.string(),
  assoc: v.string(),
  address: v.string(),
  city: v.string(),
  zip: v.string(),
  district: v.string(),
  county: v.string(),
  location: v.object({ lat: v.number(), lng: v.number() }),
  portCode: v.optional(v.string()),
});

export const upsertGeneratorBatch = internalMutation({
  args: {
    rows: v.array(generatorRow),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  returns: v.object({
    inserted: v.number(),
    patched: v.number(),
  }),
  handler: async (ctx, { rows, fetchedAt, usefulnessScore }) => {
    let inserted = 0;
    let patched = 0;

    for (const r of rows) {
      const existing = await ctx.db
        .query("trafficGenerators")
        .withIndex("by_generatorId", (q) => q.eq("generatorId", r.generatorId))
        .first();

      const doc = {
        generatorId: r.generatorId,
        name: r.name,
        assoc: r.assoc,
        address: r.address,
        city: r.city,
        zip: r.zip,
        district: r.district,
        county: r.county,
        location: r.location,
        ...(r.portCode ? { portCode: r.portCode } : {}),
        provenance: {
          source: "Caltrans_AADT" as const,
          year: 2019,
          fetchedAt,
          usefulnessScore,
          matchMethod: "web_mercator_reproject",
          method: "extracted" as const,
        },
      };

      if (existing) {
        // Replace so a missing portCode clears the prior value (patch would keep it).
        await ctx.db.replace(existing._id, doc);
        patched += 1;
      } else {
        await ctx.db.insert("trafficGenerators", doc);
        inserted += 1;
      }
    }

    return { inserted, patched };
  },
});
