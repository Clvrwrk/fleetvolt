// Carrier flagship queries (P12-10c / P12-15a) — the thin, unauth read surface
// that turns the ingested POLB carriers (carriers/ingest.ts) + the 12-02 spatial
// layer into the flagship "which trucking companies to target" sub-answers
// consumed by the 12-08 report query:
//   • carriersInRadius            — located carriers within radius of a point,
//                                    ascending by distance (the report's carrier
//                                    list, P12-15a). SPATIAL — located carriers only.
//   • carrierDensityByCorridorCity — carrier count per corridor city, desc, plus
//                                    totalInCorridor (the "companies to target"
//                                    cluster ranking, P12-10c). Works from city
//                                    text via the by_corridorCity index — answerable
//                                    even when geocoding is deferred (no location).
//   • topCarriersNear             — the outreach list: nearest located carriers to
//                                    a point (name/city/corridorCity/distance).
//
// All spatial work delegates to lib/spatial.nearestPoints (never
// @convex-dev/geospatial directly), so these queries are backend-agnostic
// (component OR haversine). carrierDensityByCorridorCity is an index scan on
// by_corridorCity — no spatial dependency, so the flagship cluster ranking holds
// regardless of geocode coverage.
import { query } from "../_generated/server";
import { v } from "convex/values";
import { nearestPoints } from "../lib/spatial";
import { CORRIDOR_CITIES } from "./corridorCity";

/** Shape a carrier doc + distance into a flagship outreach row. */
function toCarrierRow(
  doc: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    corridorCity?: string;
    location?: { lat: number; lng: number };
  },
  distanceM: number,
) {
  return {
    name: doc.name,
    address: doc.address ?? null,
    city: doc.city ?? null,
    state: doc.state ?? null,
    corridorCity: doc.corridorCity ?? null,
    location: doc.location ?? null,
    distanceM,
  };
}

/**
 * Located carriers within `radiusM` of `point`, ascending by distance — the
 * report query's carrier list (P12-15a). Only carriers with a location (geocode
 * OK) participate; unlocated carriers are queryable via
 * carrierDensityByCorridorCity instead. Returns [] when no carrier is geocoded.
 */
export const carriersInRadius = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { lat, lng, radiusM, limit }) => {
    const results = await nearestPoints(ctx, {
      table: "carriers",
      point: { lat, lng },
      maxDistanceM: radiusM,
      limit: limit ?? 50,
    });
    return results.map(({ doc, distanceM }) => toCarrierRow(doc, distanceM));
  },
});

/**
 * Carrier count per corridor city (P12-10c "companies to target" ranking),
 * descending by count, plus totalInCorridor (compare to the flagship ~685). Uses
 * the by_corridorCity index — a pure count over the tagged city text, so it works
 * even when geocoding is deferred. Cities outside the corridor set carry a null
 * corridorCity and are excluded (clean partition).
 */
export const carrierDensityByCorridorCity = query({
  args: {},
  handler: async (ctx) => {
    const counts: Record<string, number> = {};
    let totalInCorridor = 0;
    for (const city of CORRIDOR_CITIES) {
      const rows = await ctx.db
        .query("carriers")
        .withIndex("by_corridorCity", (q) => q.eq("corridorCity", city))
        .collect();
      counts[city] = rows.length;
      totalInCorridor += rows.length;
    }
    const clusters = CORRIDOR_CITIES.map((corridorCity) => ({
      corridorCity,
      count: counts[corridorCity],
    })).sort((a, b) => b.count - a.count);
    return { clusters, totalInCorridor };
  },
});

/**
 * The outreach list: the `limit` nearest LOCATED carriers to `point` within
 * `radiusM`, ascending by distance — the "who do we call first" list near a
 * siting opportunity. Located carriers only (spatial).
 */
export const topCarriersNear = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { lat, lng, radiusM, limit }) => {
    const results = await nearestPoints(ctx, {
      table: "carriers",
      point: { lat, lng },
      maxDistanceM: radiusM,
      limit: limit ?? 25,
    });
    return results.map(({ doc, distanceM }) => toCarrierRow(doc, distanceM));
  },
});
