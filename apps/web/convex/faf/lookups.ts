// FAF lookup seeding ACTION (P12-03) — seeds fafZones/fafModes/fafCommodities
// from the prepped faf_lookups.json (metadata workbook + CFS↔FAF crosswalk).
//
// Actions cannot read the local filesystem in prod, so the LOADER
// (scripts/faf_load.mjs) reads faf_lookups.json and passes it as the arg here;
// this action forwards to the idempotent upsertLookups internalMutation. The
// lookup set is small (~190 rows total) so a single call suffices.
//
// INVOCATION: node scripts/faf_load.mjs  (calls this before the actuals ingest).
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";

export const seed = action({
  args: {
    zones: v.array(
      v.object({
        zoneId: v.string(),
        name: v.string(),
        state: v.optional(v.union(v.string(), v.null())),
      }),
    ),
    modes: v.array(v.object({ modeId: v.string(), label: v.string() })),
    commodities: v.array(v.object({ sctg2: v.string(), label: v.string() })),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ zones: number; modes: number; commodities: number }> => {
    return await ctx.runMutation(internal.faf.mutations.upsertLookups, args);
  },
});
