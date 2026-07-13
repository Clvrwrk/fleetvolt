import { v } from "convex/values";
import { action, internalMutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

const point = v.object({ lat: v.number(), lng: v.number() });
const districtRow = v.object({
  code: v.string(),
  name: v.string(),
  centroid: point,
  bbox: v.object({
    minLat: v.number(),
    minLng: v.number(),
    maxLat: v.number(),
    maxLng: v.number(),
  }),
  rings: v.array(v.array(point)),
});

export const upsertBatch = internalMutation({
  args: {
    rows: v.array(districtRow),
    fetchedAt: v.number(),
  },
  returns: v.object({ inserted: v.number(), patched: v.number() }),
  handler: async (ctx, { rows, fetchedAt }) => {
    let inserted = 0;
    let patched = 0;
    for (const row of rows) {
      const rings = row.rings.filter((ring) => ring.length >= 3);
      if (rings.length === 0) continue;
      const doc = {
        ...row,
        rings,
        provenance: {
          source: "CARB" as const,
          fetchedAt,
          usefulnessScore: 10,
          matchMethod: "carb_air_district_geojson",
          method: "measured" as const,
        },
      };
      const existing = await ctx.db
        .query("geoAirDistricts")
        .withIndex("by_code", (q) => q.eq("code", row.code))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, doc);
        patched += 1;
      } else {
        await ctx.db.insert("geoAirDistricts", doc);
        inserted += 1;
      }
    }
    return { inserted, patched };
  },
});

export const ingest = action({
  args: { rows: v.array(districtRow), fetchedAt: v.optional(v.number()) },
  returns: v.object({
    received: v.number(),
    inserted: v.number(),
    patched: v.number(),
  }),
  handler: async (ctx, { rows, fetchedAt: suppliedFetchedAt }) => {
    if (rows.length === 0) {
      throw new Error("Air-district geometry ingest received zero rows.");
    }
    const fetchedAt = suppliedFetchedAt ?? Date.now();
    let inserted = 0;
    let patched = 0;
    for (let offset = 0; offset < rows.length; offset += 20) {
      const result = await ctx.runMutation(
        internal.geo.ingestAirDistrictGeometry.upsertBatch,
        { rows: rows.slice(offset, offset + 20), fetchedAt },
      );
      inserted += result.inserted;
      patched += result.patched;
    }
    return { received: rows.length, inserted, patched };
  },
});

export const coverage = query({
  args: {},
  returns: v.object({ districts: v.number(), rings: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("geoAirDistricts").collect();
    return {
      districts: rows.length,
      rings: rows.reduce((total, row) => total + row.rings.length, 0),
    };
  },
});
