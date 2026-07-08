// POI + parking radius queries (P12-15b/c) — the thin, unauth read surface that
// turns the ingested NATD parking + OSM POIs (spatial-indexed via 12-02) into
// the report-payload shapes the 12-08 report query consumes. All spatial work
// delegates to lib/spatial.nearestPoints (never @convex-dev/geospatial directly)
// so these queries are backend-agnostic (component OR haversine).
//
//   • poisInRadius       — POIs within radius, optionally filtered to a set of
//                          types, grouped by type (P12-15c "what's there").
//   • parkingInRadius     — parking sites within radius + totalSpotsWithinRadius,
//                          the P12-15b parking payload + the P12-12 capacity
//                          proxy sum the hotspot score consumes.
import { query } from "../_generated/server";
import { v } from "convex/values";
import { nearestPoints } from "../lib/spatial";
import type { PoiType } from "./classify";

/**
 * POIs within `radiusM` of (lat,lng), optionally restricted to `types`,
 * ascending by distance and grouped by type. The type filter is a doc-level JS
 * predicate on doc.type (nearestPoints over-fetches then filters) so it cannot
 * be fooled by a filterKey drift.
 */
export const poisInRadius = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
    types: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { lat, lng, radiusM, types, limit }) => {
    const typeSet = types && types.length > 0 ? new Set(types) : null;
    const results = await nearestPoints(ctx, {
      table: "pois",
      point: { lat, lng },
      maxDistanceM: radiusM,
      limit: limit ?? 200,
      filter: typeSet ? (doc) => typeSet.has(doc.type) : undefined,
    });

    const flat = results.map(({ doc, distanceM }) => ({
      type: doc.type as PoiType,
      name: doc.name ?? null,
      location: doc.location,
      distanceM,
    }));

    const byType: Record<string, typeof flat> = {};
    for (const row of flat) {
      (byType[row.type] ??= []).push(row);
    }

    return { total: flat.length, pois: flat, byType };
  },
});

/**
 * Parking sites within `radiusM` of (lat,lng), ascending by distance, plus
 * totalSpotsWithinRadius — the summed numberOfSpots (the P12-12 capacity proxy)
 * across every in-radius site with a numeric spot count.
 */
export const parkingInRadius = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { lat, lng, radiusM, limit }) => {
    const results = await nearestPoints(ctx, {
      table: "parking",
      point: { lat, lng },
      maxDistanceM: radiusM,
      limit: limit ?? 100,
    });

    let totalSpotsWithinRadius = 0;
    const parking = results.map(({ doc, distanceM }) => {
      if (typeof doc.numberOfSpots === "number") {
        totalSpotsWithinRadius += doc.numberOfSpots;
      }
      return {
        name: doc.name ?? null,
        numberOfSpots: doc.numberOfSpots ?? null,
        hgv: doc.hgv ?? null,
        location: doc.location,
        distanceM,
      };
    });

    return { count: parking.length, totalSpotsWithinRadius, parking };
  },
});
