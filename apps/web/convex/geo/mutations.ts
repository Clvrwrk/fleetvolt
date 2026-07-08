// Geo-region ingest mutations (P12-13) — batched idempotent upsert of the
// US -> State -> County rows (from data/ingest/census/out/geo_regions.json) into
// the geoRegions table (12-01 scaffold), keyed by fips (by_fips index).
//
// PROVENANCE (P12-02): source "Census", method "measured", matchMethod
// "census_api" — the FIPS/names are a measured government dataset. aggregateScore
// is left unset here; geo/rollup.ts fills it from the modeled hotspots.
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const regionRow = v.object({
  level: v.union(v.literal("nation"), v.literal("state"), v.literal("county")),
  fips: v.string(),
  name: v.string(),
  parentFips: v.optional(v.union(v.string(), v.null())),
  centroid: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  bbox: v.optional(
    v.object({
      minLat: v.number(),
      minLng: v.number(),
      maxLat: v.number(),
      maxLng: v.number(),
    }),
  ),
});

export const upsertGeoRegionBatch = internalMutation({
  args: {
    rows: v.array(regionRow),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  handler: async (ctx, { rows, fetchedAt, usefulnessScore }) => {
    let inserted = 0;
    let patched = 0;
    for (const r of rows) {
      const doc = {
        level: r.level,
        fips: r.fips,
        name: r.name,
        parentFips: r.parentFips ?? undefined,
        centroid: r.centroid,
        bbox: r.bbox,
        provenance: {
          source: "Census" as const,
          fetchedAt,
          usefulnessScore,
          matchMethod: "census_api",
          method: "measured" as const,
        },
      };
      const existing = await ctx.db
        .query("geoRegions")
        .withIndex("by_fips", (q) => q.eq("fips", r.fips))
        .unique();
      if (existing) {
        // Preserve an already-computed aggregateScore across re-ingest.
        await ctx.db.patch(existing._id, doc);
        patched += 1;
      } else {
        await ctx.db.insert("geoRegions", doc);
        inserted += 1;
      }
    }
    return { inserted, patched, total: rows.length };
  },
});
