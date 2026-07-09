// Catalog-vehicle queries — unauth read surface for HVIP browse + EPA card detail.
// Public planning data (same pattern as trucks.list).
import { v } from "convex/values";
import { query } from "../_generated/server";
import { catalogFields } from "./mutations";
import { provenance } from "../lib/provenance";

const catalogVehicleDoc = v.object({
  _id: v.id("catalogVehicles"),
  _creationTime: v.number(),
  ...catalogFields,
  provenance,
});

export const list = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(catalogVehicleDoc),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 250, 300);
    const category = args.category;

    const rows = category
      ? await ctx.db
          .query("catalogVehicles")
          .withIndex("by_category", (q) => q.eq("category", category))
          .take(limit)
      : await ctx.db.query("catalogVehicles").take(limit);

    return rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(catalogVehicleDoc, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("catalogVehicles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});
