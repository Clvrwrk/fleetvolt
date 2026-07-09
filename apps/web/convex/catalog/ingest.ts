// Catalog-vehicle ingest ACTION — receives HVIP catalog rows (built by
// scripts/catalog_load.ts from the official CSV + data/trucks links) and upserts
// them via batched internalMutations. Mirrors trucks/ingest.ts.
//
// usefulnessScore = 8/10 — official California HVIP eligible-vehicles CSV,
// enriched with FleetVolt physics-truck street efficiency where linked.
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { chunk } from "../lib/csvChunk";
import { catalogRow } from "./mutations";

const USEFULNESS_SCORE = 8;
const BATCH_SIZE = 50;

export const run = action({
  args: {
    rows: v.array(catalogRow),
    fetchedAt: v.optional(v.number()),
  },
  returns: v.object({
    received: v.number(),
    inserted: v.number(),
    patched: v.number(),
    fetchedAt: v.number(),
  }),
  handler: async (ctx, { rows, fetchedAt: fetchedAtArg }) => {
    if (rows.length === 0) {
      throw new Error(
        "catalog/ingest:run received zero rows — refusing to proceed. " +
          "Run catalog_load.ts first.",
      );
    }
    const fetchedAt = fetchedAtArg ?? Date.now();

    let inserted = 0;
    let patched = 0;
    for (const batch of chunk(rows, BATCH_SIZE)) {
      const res = await ctx.runMutation(
        internal.catalog.mutations.upsertCatalogBatch,
        { rows: batch, fetchedAt, usefulnessScore: USEFULNESS_SCORE },
      );
      inserted += res.inserted;
      patched += res.patched;
    }

    const result = {
      received: rows.length,
      inserted,
      patched,
      fetchedAt,
    };
    console.log("catalog/ingest:run", JSON.stringify(result));
    return result;
  },
});
