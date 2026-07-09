/**
 * Internal helpers for corridor builder (AADT candidate fetch).
 */
import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { segmentsInBbox } from "../lib/spatial";

export const highwaySamplesInBbox = internalQuery({
  args: {
    minLat: v.number(),
    minLng: v.number(),
    maxLat: v.number(),
    maxLng: v.number(),
  },
  returns: v.array(
    v.object({
      location: v.object({ lat: v.number(), lng: v.number() }),
      truckAADT: v.number(),
      route: v.string(),
    }),
  ),
  handler: async (ctx, bbox) => {
    const rows = await segmentsInBbox(ctx, {
      table: "highwaySegments",
      bbox,
    });
    const out: Array<{
      location: { lat: number; lng: number };
      truckAADT: number;
      route: string;
    }> = [];
    for (const doc of rows) {
      if (typeof doc.truckAADT !== "number") continue;
      const p = doc.path[0];
      if (!p) continue;
      out.push({
        location: { lat: p.lat, lng: p.lng },
        truckAADT: doc.truckAADT,
        route: doc.route,
      });
    }
    return out;
  },
});
