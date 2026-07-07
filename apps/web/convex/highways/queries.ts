// Highway-segment READ surface (P12-06) — thin, unauth query wrappers over the
// CalTrans Truck-AADT highwaySegments the ingest populated. All spatial logic
// delegates to lib/spatial (the 12-02 bbox+haversine LINE path); these are thin
// wrappers only, never touching @convex-dev/geospatial directly.
//
// Three queries:
//   • segmentsInBbox        — the ST_Extent / corridor-region replacement
//                             (P12-05 parity gate): segments whose bbox overlaps
//                             the query rectangle.
//   • mostCongestedRoute    — FLAGSHIP GAP #1 closed (P12-10a): ranks routes by
//                             aggregate 5-axle truckAADT and returns the top
//                             corridor(s) FROM DATA — replaces the hardcoded
//                             "most congested route = POLB→SB" constant.
//   • corridorCongestion    — segments in a corridor bbox with their truckAADT,
//                             the freight-intensity proxy the 12-08 hotspot
//                             score + the pulse-intensity render consume.
import { v } from "convex/values";
import { query } from "../_generated/server";
import { segmentsInBbox as segmentsInBboxSpatial } from "../lib/spatial";

const bboxArgs = {
  minLat: v.number(),
  minLng: v.number(),
  maxLat: v.number(),
  maxLng: v.number(),
};

/**
 * Corridor-region query — the ST_Extent / ST_MakeEnvelope-&&-bbox replacement
 * (P12-05). Returns every highwaySegment whose bbox overlaps the query
 * rectangle. Delegates to lib/spatial.segmentsInBbox (LINE bbox-intersection),
 * so the parity gate in queries.test.ts exercises the same math the flagship
 * corridor-region answer uses.
 */
export const segmentsInBbox = query({
  args: bboxArgs,
  handler: async (ctx, { minLat, minLng, maxLat, maxLng }) => {
    const rows = await segmentsInBboxSpatial(ctx, {
      table: "highwaySegments",
      bbox: { minLat, minLng, maxLat, maxLng },
    });
    return rows.map((doc) => ({
      segmentId: doc.segmentId,
      route: doc.route,
      truckAADT: doc.truckAADT ?? null,
      aadt: doc.aadt ?? null,
      bbox: doc.bbox,
    }));
  },
});

/**
 * FLAGSHIP GAP #1 — most congested freight route, DATA-DRIVEN (P12-10a).
 *
 * The flagship computation previously HARDCODED "most congested route =
 * POLB→SB". This query makes it real: it groups every ingested segment by
 * `route`, sums and maxes the 5-axle truckAADT (the Class-8 congestion proxy),
 * and returns the top `limit` routes ordered by aggregate 5-axle volume — so the
 * answer comes from the CalTrans data, not a constant. Ranking on 5-axle
 * truckAADT (NOT total `aadt`) keeps the freight-congestion story on
 * heavy-combination trucks (Phase-7 PITFALLS #7).
 */
export const mostCongestedRoute = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("highwaySegments").collect();
    const byRoute = new Map<
      string,
      { route: string; sumTruckAADT: number; maxTruckAADT: number; segmentCount: number }
    >();
    for (const doc of rows) {
      const t = doc.truckAADT;
      if (typeof t !== "number") continue; // never fabricate a 0 for missing data
      const cur =
        byRoute.get(doc.route) ??
        { route: doc.route, sumTruckAADT: 0, maxTruckAADT: 0, segmentCount: 0 };
      cur.sumTruckAADT += t;
      cur.maxTruckAADT = Math.max(cur.maxTruckAADT, t);
      cur.segmentCount += 1;
      byRoute.set(doc.route, cur);
    }
    const ranked = [...byRoute.values()].sort(
      (a, b) => b.sumTruckAADT - a.sumTruckAADT,
    );
    return ranked.slice(0, Math.max(1, limit ?? 1));
  },
});

/**
 * Corridor congestion — segments inside a corridor bbox with their 5-axle
 * truckAADT, ordered desc. Feeds the 12-08 hotspot freight-proxy and the
 * pulse-intensity render. Delegates the spatial filter to lib/spatial, then
 * projects the congestion fields.
 */
export const corridorCongestion = query({
  args: bboxArgs,
  handler: async (ctx, { minLat, minLng, maxLat, maxLng }) => {
    const rows = await segmentsInBboxSpatial(ctx, {
      table: "highwaySegments",
      bbox: { minLat, minLng, maxLat, maxLng },
    });
    const segments = rows.map((doc) => ({
      segmentId: doc.segmentId,
      route: doc.route,
      truckAADT: doc.truckAADT ?? null,
      aadt: doc.aadt ?? null,
      path: doc.path,
    }));
    segments.sort((a, b) => (b.truckAADT ?? 0) - (a.truckAADT ?? 0));
    const totalTruckAADT = segments.reduce(
      (acc, s) => acc + (s.truckAADT ?? 0),
      0,
    );
    return { count: segments.length, totalTruckAADT, segments };
  },
});
