// P15-01: Hotspot queries for the Hotspot Explorer map.
//
// listModeledHotspots returns all modeledDwell hotspots via the by_kind index
// — these are the individual hotspot pins rendered at county zoom (≥9).
// Thin, unauthenticated, read-only — parity with ports.ts list/getByCode.
import { query } from "../_generated/server";

export const listModeledHotspots = query({
  args: {},
  handler: async (ctx) => {
    const hs = await ctx.db
      .query("hotspots")
      .withIndex("by_kind", (q) => q.eq("kind", "modeledDwell"))
      .collect();
    return hs.map((h) => ({
      _id: h._id,
      title: h.title,
      location: h.location,
      score: h.score,
      scoreInputs: h.scoreInputs,
    }));
  },
});
