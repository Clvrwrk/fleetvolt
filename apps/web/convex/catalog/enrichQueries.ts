import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

/** Rows eligible for Firecrawl media enrichment. */
export const listForEnrichment = internalQuery({
  args: {
    limit: v.number(),
    onlyMissing: v.boolean(),
    offset: v.number(),
  },
  returns: v.array(
    v.object({
      slug: v.string(),
      hvipVehicleUrl: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const all = await ctx.db.query("catalogVehicles").take(300);
    const eligible = all
      .filter((r) => typeof r.hvipVehicleUrl === "string" && r.hvipVehicleUrl.length > 0)
      .filter((r) => (args.onlyMissing ? !r.imageUrl : true))
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .slice(args.offset, args.offset + args.limit)
      .map((r) => ({
        slug: r.slug,
        hvipVehicleUrl: r.hvipVehicleUrl as string,
      }));
    return eligible;
  },
});
