// P15-01: Geo region queries for the Hotspot Explorer map.
//
// listGeoRegions returns geoRegions optionally filtered by level (nation|state|
// county) via the by_level index. At nation zoom (≤5), state-level regions with
// aggregateScore are rendered; at state zoom (6–8), county-level regions render.
// Thin, unauthenticated, read-only — parity with ports.ts.
import { query } from "../_generated/server";
import { v } from "convex/values";

export const listGeoRegions = query({
  args: {
    level: v.optional(
      v.union(
        v.literal("nation"),
        v.literal("state"),
        v.literal("county"),
      ),
    ),
  },
  handler: async (ctx, { level }) => {
    const q = ctx.db.query("geoRegions");
    const rows = level
      ? await q.withIndex("by_level", (q2) => q2.eq("level", level)).collect()
      : await q.collect();
    return rows.map((r) => ({
      _id: r._id,
      fips: r.fips,
      name: r.name,
      level: r.level,
      parentFips: r.parentFips ?? null,
      centroid: r.centroid ?? null,
      bbox: r.bbox ?? null,
      aggregateScore: r.aggregateScore ?? null,
    }));
  },
});
