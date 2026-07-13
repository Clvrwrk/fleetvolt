import { v } from "convex/values";
import { action, internalMutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

const point = v.object({ lat: v.number(), lng: v.number() });
const countyRow = v.object({
  fips: v.string(),
  centroid: point,
  bbox: v.object({
    minLat: v.number(),
    minLng: v.number(),
    maxLat: v.number(),
    maxLng: v.number(),
  }),
  rings: v.array(v.array(point)),
});

export const patchBatch = internalMutation({
  args: { rows: v.array(countyRow), fetchedAt: v.number() },
  returns: v.object({ patched: v.number(), missing: v.number() }),
  handler: async (ctx, { rows, fetchedAt }) => {
    let patched = 0;
    let missing = 0;
    for (const row of rows) {
      const county = await ctx.db
        .query("geoRegions")
        .withIndex("by_fips", (q) => q.eq("fips", row.fips))
        .unique();
      if (!county || county.level !== "county") {
        missing += 1;
        continue;
      }
      const rings = row.rings.filter((ring) => ring.length >= 3);
      if (rings.length === 0) continue;
      await ctx.db.patch(county._id, {
        centroid: row.centroid,
        bbox: row.bbox,
        rings,
        provenance: {
          source: "CA_Geoportal" as const,
          fetchedAt,
          usefulnessScore: 10,
          matchMethod: "ca_geoportal_county_identifiers",
          method: "measured" as const,
          year: 2026,
        },
      });
      patched += 1;
    }
    return { patched, missing };
  },
});

export const ingest = action({
  args: { rows: v.array(countyRow), fetchedAt: v.optional(v.number()) },
  returns: v.object({ received: v.number(), patched: v.number(), missing: v.number() }),
  handler: async (ctx, { rows, fetchedAt: suppliedFetchedAt }) => {
    if (rows.length === 0) throw new Error("County geometry ingest received zero rows.");
    const fetchedAt = suppliedFetchedAt ?? Date.now();
    let patched = 0;
    let missing = 0;
    for (let offset = 0; offset < rows.length; offset += 20) {
      const result = await ctx.runMutation(
        internal.geo.ingestCountyGeometry.patchBatch,
        { rows: rows.slice(offset, offset + 20), fetchedAt },
      );
      patched += result.patched;
      missing += result.missing;
    }
    return { received: rows.length, patched, missing };
  },
});

export const coverage = query({
  args: {},
  returns: v.object({ counties: v.number(), drawable: v.number(), rings: v.number() }),
  handler: async (ctx) => {
    const counties = await ctx.db
      .query("geoRegions")
      .withIndex("by_level", (q) => q.eq("level", "county"))
      .collect();
    const california = counties.filter((county) => county.fips.startsWith("06"));
    return {
      counties: california.length,
      drawable: california.filter((county) => county.rings?.length).length,
      rings: california.reduce(
        (total, county) => total + (county.rings?.length ?? 0),
        0,
      ),
    };
  },
});
