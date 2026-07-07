// Highway-segment ingest mutations (P12-06) — batched, idempotent
// internalMutations that upsert CalTrans Truck-AADT segments by segmentId.
//
// LINE data, NOT points: highwaySegments carry a bbox + simplify-js-thinned
// `path`, and the 12-02 spatial path for them is the hand-rolled bbox+haversine
// (segmentsInBbox / segmentsNearPoint). We therefore do NOT call the point-only
// geospatial component here (no spatial.insertPoint) — the bbox stored on each
// row IS the spatial index for the line queries.
//
// truckAADT vs aadt (Phase-7 PITFALLS #7 — never conflate):
//   truckAADT  <- CalTrans TRK_5_AXLE  (>=5-axle = Class-8 heavy-combination proxy)
//   aadt       <- CalTrans TOT_TRK_AADT (total TRUCK AADT)
// The two are kept strictly distinct; the 5-axle share is a clean subset of the
// total-truck denominator and is what mostCongestedRoute ranks on.
//
// Idempotency + namespace: upsert keyed by segmentId (by_segmentId index). The
// prep stamps segmentId = "CT-<OBJECTID>", a namespace that cannot collide with
// any Phase-7 seed segmentId — re-running patches, never duplicates, and never
// clobbers a Phase-7 row (T-12-06c).
//
// Provenance (P12-02): {source:"Caltrans_AADT", year, fetchedAt,
// usefulnessScore, matchMethod:"geo_join", method:"measured"} — these are
// measured CalTrans postmile counts, not modeled.
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const segmentRow = v.object({
  segmentId: v.string(),
  route: v.string(),
  path: v.array(v.object({ lat: v.number(), lng: v.number() })),
  bbox: v.object({
    minLat: v.number(),
    minLng: v.number(),
    maxLat: v.number(),
    maxLng: v.number(),
  }),
  truckAADT: v.optional(v.union(v.number(), v.null())),
  aadt: v.optional(v.union(v.number(), v.null())),
  year: v.optional(v.union(v.number(), v.null())),
});

/** Validate that the stored bbox actually encloses every path vertex. A prep
 *  bug that produced a bbox not containing its own path would silently break
 *  the bbox-intersection spatial queries, so we harden the write path. */
function bboxEnclosesPath(
  bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
  path: Array<{ lat: number; lng: number }>,
): boolean {
  const EPS = 1e-9;
  for (const p of path) {
    if (
      p.lat < bbox.minLat - EPS ||
      p.lat > bbox.maxLat + EPS ||
      p.lng < bbox.minLng - EPS ||
      p.lng > bbox.maxLng + EPS
    ) {
      return false;
    }
  }
  return true;
}

export const upsertSegmentBatch = internalMutation({
  args: {
    rows: v.array(segmentRow),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  handler: async (ctx, { rows, fetchedAt, usefulnessScore }) => {
    let inserted = 0;
    let patched = 0;
    let withTruck = 0;

    for (const r of rows) {
      if (!bboxEnclosesPath(r.bbox, r.path)) {
        throw new Error(
          `bbox does not enclose path for segment ${r.segmentId} — refusing ` +
            "to write a spatially-inconsistent row (prep bug).",
        );
      }
      const truckAADT = r.truckAADT ?? undefined;
      const aadt = r.aadt ?? undefined;
      if (truckAADT !== undefined) withTruck += 1;

      const doc = {
        segmentId: r.segmentId,
        route: r.route,
        path: r.path,
        bbox: r.bbox,
        aadt,
        truckAADT,
        provenance: {
          source: "Caltrans_AADT" as const,
          year: r.year ?? undefined,
          fetchedAt,
          usefulnessScore,
          matchMethod: "geo_join",
          method: "measured" as const,
        },
      };

      // Fully-selective upsert on the by_segmentId index (reads at most one row).
      const existing = await ctx.db
        .query("highwaySegments")
        .withIndex("by_segmentId", (q) => q.eq("segmentId", r.segmentId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, doc);
        patched += 1;
      } else {
        await ctx.db.insert("highwaySegments", doc);
        inserted += 1;
      }
      // NB: no spatial.insertPoint — lines use bbox+haversine (12-02), the
      // point-only geospatial component is intentionally not touched here.
    }

    return { inserted, patched, withTruck, total: rows.length };
  },
});
