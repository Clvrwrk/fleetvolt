// Thin Convex spatial queries (P12-04) — mirrors ports.ts (thin, unauth, D-06).
//
// All logic lives in convex/lib/spatial.ts; these wrappers only shape args and
// map results to the PostGIS-field-aligned response so the P12-05 parity
// comparison is field-for-field with services/simulator ChargerNearResponse
// (station_id, name, power_kw, hd_capable, operator, distance_m).
//
// Used by tests + downstream plans (12-04 charger gap, 12-06 corridor, 12-08
// report). Never import @convex-dev/geospatial from here — go through lib/spatial.
import { query } from "./_generated/server";
import { v } from "convex/values";
import {
  nearestPoints,
  pointsInRectangle,
  segmentsNearPoint,
} from "./lib/spatial";

/**
 * 5-closest-chargers-within-radius (+ optional class8 filter) — the flagship
 * query (FLAGSHIP-QUERY-VERIFIED) and the ST_DWithin/ST_Distance replacement.
 * Returns rows field-aligned with the simulator's ChargerNearResponse, sorted
 * ascending by distanceM.
 */
export const nearestChargers = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
    class8Only: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { lat, lng, radiusM, class8Only, limit }) => {
    const results = await nearestPoints(ctx, {
      table: "chargers",
      point: { lat, lng },
      maxDistanceM: radiusM,
      limit,
      filter: class8Only ? (doc) => doc.isClass8Capable : undefined,
      filterEq: class8Only
        ? { field: "isClass8Capable", value: true }
        : undefined,
    });
    return results.map(({ doc, distanceM }) => ({
      stationId: doc.stationId,
      name: doc.name ?? null,
      powerKw: doc.powerKw,
      isClass8Capable: doc.isClass8Capable,
      operator: doc.operator ?? null,
      distanceM,
    }));
  },
});

/** Chargers inside an axis-aligned rectangle — ST_MakeEnvelope replacement. */
export const chargersInRegion = query({
  args: {
    minLat: v.number(),
    minLng: v.number(),
    maxLat: v.number(),
    maxLng: v.number(),
  },
  handler: async (ctx, { minLat, minLng, maxLat, maxLng }) => {
    const docs = await pointsInRectangle(ctx, {
      table: "chargers",
      bbox: { minLat, minLng, maxLat, maxLng },
    });
    return docs.map((doc) => ({
      stationId: doc.stationId,
      name: doc.name ?? null,
      powerKw: doc.powerKw,
      isClass8Capable: doc.isClass8Capable,
      operator: doc.operator ?? null,
      location: doc.location,
    }));
  },
});

/**
 * Highway segments within radius of a point (LINE data, bbox+haversine) —
 * used by 12-06 corridor parity + 12-08. Returns ascending by point-to-polyline
 * distance.
 */
export const segmentsNear = query({
  args: { lat: v.number(), lng: v.number(), radiusM: v.number() },
  handler: async (ctx, { lat, lng, radiusM }) => {
    const results = await segmentsNearPoint(ctx, {
      table: "highwaySegments",
      point: { lat, lng },
      maxDistanceM: radiusM,
    });
    return results.map(({ doc, distanceM }) => ({
      segmentId: doc.segmentId,
      route: doc.route,
      distanceM,
    }));
  },
});
