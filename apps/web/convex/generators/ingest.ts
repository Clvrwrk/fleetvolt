/**
 * Load trafficGenerators rows (prepped JSON passed by scripts/generators_load.mjs).
 *
 *   python3 data/ingest/caltrans/prep_traffic_generators.py
 *   node scripts/generators_load.mjs
 */
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";

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

export const run = action({
  args: {
    rows: v.array(generatorRow),
    fetchedAt: v.optional(v.number()),
  },
  returns: v.object({
    inserted: v.number(),
    patched: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, { rows, fetchedAt: fetchedAtArg }) => {
    if (rows.length === 0) {
      throw new Error(
        "generators/ingest:run received zero rows — run prep_traffic_generators.py first.",
      );
    }
    const fetchedAt = fetchedAtArg ?? Date.now();
    const usefulnessScore = 7;
    const BATCH = 40;
    let inserted = 0;
    let patched = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const result = await ctx.runMutation(
        internal.generators.mutations.upsertGeneratorBatch,
        { rows: chunk, fetchedAt, usefulnessScore },
      );
      inserted += result.inserted;
      patched += result.patched;
    }

    return { inserted, patched, total: rows.length };
  },
});
