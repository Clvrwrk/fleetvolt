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
  galleryUrls: v.optional(v.array(v.string())),
  scrapedAt: v.optional(v.number()),
  provenance,
});

export const list = query({
  args: {
    category: v.optional(v.string()),
    oem: v.optional(v.string()),
    vehicleClassLabel: v.optional(v.string()),
    technology: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(catalogVehicleDoc),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 250, 300);
    const category = args.category;

    let rows = category
      ? await ctx.db
          .query("catalogVehicles")
          .withIndex("by_category", (q) => q.eq("category", category))
          .take(limit)
      : args.oem
        ? await ctx.db
            .query("catalogVehicles")
            .withIndex("by_oem", (q) => q.eq("oem", args.oem!))
            .take(limit)
        : await ctx.db.query("catalogVehicles").take(limit);

    if (args.oem && category) {
      rows = rows.filter((r) => r.oem === args.oem);
    }
    if (args.vehicleClassLabel) {
      rows = rows.filter((r) => r.vehicleClassLabel === args.vehicleClassLabel);
    }
    if (args.technology) {
      rows = rows.filter((r) => r.technology === args.technology);
    }

    return rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

/** Distinct filter facets for the catalog sidebar. */
export const listFacets = query({
  args: {},
  returns: v.object({
    oems: v.array(v.string()),
    categories: v.array(v.string()),
    classes: v.array(v.string()),
    technologies: v.array(v.string()),
    total: v.number(),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("catalogVehicles").take(300);
    const oems = new Set<string>();
    const categories = new Set<string>();
    const classes = new Set<string>();
    const technologies = new Set<string>();
    for (const r of rows) {
      if (r.oem) oems.add(r.oem);
      if (r.category) categories.add(r.category);
      if (r.vehicleClassLabel) classes.add(r.vehicleClassLabel);
      if (r.technology) technologies.add(r.technology);
    }
    return {
      oems: [...oems].sort((a, b) => a.localeCompare(b)),
      categories: [...categories].sort((a, b) => a.localeCompare(b)),
      classes: [...classes].sort((a, b) => a.localeCompare(b)),
      technologies: [...technologies].sort((a, b) => a.localeCompare(b)),
      total: rows.length,
    };
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
