// Charger flagship queries (P12-10b) — the thin, unauth read surface that turns
// the ingested AFDC chargers (chargers/ingest.ts) + the 12-02 spatial layer into
// the flagship sub-answers consumed by 12-08:
//   • nearestClass8  — nearest TRUE Class-8-capable chargers within radius.
//   • fiveClosest     — the 5 nearest chargers regardless of class, each with the
//                       full config (powerKw, maxVehicleClass, connectorTypes,
//                       evDcFastNum) so the UI can show WHY they are unusable.
//   • class8Gap       — the honest gap over a corridor: how many Class-8 chargers
//                       sit within radius of ANY corridor point (0 = the flagship
//                       siting opportunity), the closest Class-8 distance if any,
//                       and the 5 closest any-class chargers as the reality check.
//
// All spatial work delegates to lib/spatial.nearestPoints via spatial.ts's
// nearestChargers (never @convex-dev/geospatial directly), so these queries are
// backend-agnostic (component OR haversine). The Class-8 filter is applied both
// in-index (class8Only) AND as a defensive JS predicate on isClass8Capable so a
// filterKey drift can never inflate the gap (T-12-04b: never inflate the gap).
import { query } from "../_generated/server";
import { v } from "convex/values";
import { nearestPoints } from "../lib/spatial";

/** Shape a charger doc into the flagship "5 closest + config" row. */
function toConfigRow(
  doc: {
    stationId: string;
    name?: string | null;
    powerKw: number;
    maxVehicleClass?: "LD" | "MD" | "HD" | null;
    connectorTypes: string[];
    evDcFastNum?: number | null;
    isClass8Capable: boolean;
    operator?: string | null;
  },
  distanceM: number,
) {
  return {
    stationId: doc.stationId,
    name: doc.name ?? null,
    powerKw: doc.powerKw,
    maxVehicleClass: doc.maxVehicleClass ?? null,
    connectorTypes: doc.connectorTypes,
    evDcFastNum: doc.evDcFastNum ?? null,
    isClass8Capable: doc.isClass8Capable,
    operator: doc.operator ?? null,
    distanceM,
  };
}

/**
 * Nearest TRUE Class-8-capable chargers (≥350 kW AND MD/HD) within radius,
 * ascending by distance.
 *
 * The class8 predicate is applied as a JS filter on the doc's isClass8Capable
 * field (nearestPoints over-fetches, then filters), NOT via the in-index
 * filterEq. WHY: the 12-02 ingest indexes points with filterField key `class8`
 * (mutations.ts insertPoint filterFields:{class8}), so an in-index
 * `eq("isClass8Capable", …)` matches NOTHING and would silently return an empty
 * set — fabricating a Class-8 gap that live data does not have (the inverse of
 * T-12-04b). The doc-level JS predicate is authoritative and cannot be fooled by
 * a filterKey drift.
 */
export const nearestClass8 = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { lat, lng, radiusM, limit }) => {
    const results = await nearestPoints(ctx, {
      table: "chargers",
      point: { lat, lng },
      maxDistanceM: radiusM,
      limit: limit ?? 5,
      filter: (doc) => doc.isClass8Capable === true,
    });
    return results.map(({ doc, distanceM }) => toConfigRow(doc, distanceM));
  },
});

/**
 * The 5 closest chargers regardless of class — the flagship "5 closest + config"
 * table. Each row carries powerKw / maxVehicleClass / connectorTypes /
 * evDcFastNum so the UI can show the honest mismatch (LD 44–75 kW units that an
 * 80,000 lb Class-8 truck cannot use).
 */
export const fiveClosest = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { lat, lng, limit }) => {
    const results = await nearestPoints(ctx, {
      table: "chargers",
      point: { lat, lng },
      limit: limit ?? 5,
    });
    return results.map(({ doc, distanceM }) => toConfigRow(doc, distanceM));
  },
});

/**
 * The corridor Class-8 gap (P12-10b) — surfaces the flagship siting opportunity
 * rather than routing a truck to a useless LD stall. For a set of corridor
 * probe points, counts the UNIQUE Class-8-capable chargers within radius of ANY
 * point, reports the closest such charger's distance (null when none), and the
 * 5 closest any-class chargers (near the FIRST corridor point) as the reality
 * check. class8WithinCorridor === 0 IS the flagship answer for POLB→SB.
 */
export const class8Gap = query({
  args: {
    corridorPoints: v.array(v.object({ lat: v.number(), lng: v.number() })),
    radiusM: v.number(),
  },
  handler: async (ctx, { corridorPoints, radiusM }) => {
    const class8ByStation = new Map<
      string,
      { row: ReturnType<typeof toConfigRow>; distanceM: number }
    >();

    for (const pt of corridorPoints) {
      const hits = await nearestPoints(ctx, {
        table: "chargers",
        point: { lat: pt.lat, lng: pt.lng },
        maxDistanceM: radiusM,
        // pull a generous window so no in-radius Class-8 unit is missed. The
        // Class-8 filter is a doc-level JS predicate on isClass8Capable (NOT an
        // in-index filterEq) — the 12-02 index keys on `class8`, so an in-index
        // eq on isClass8Capable would match nothing and fabricate a false gap.
        limit: 64,
        filter: (doc) => doc.isClass8Capable === true,
      });
      for (const { doc, distanceM } of hits) {
        const prev = class8ByStation.get(doc.stationId);
        if (!prev || distanceM < prev.distanceM) {
          class8ByStation.set(doc.stationId, {
            row: toConfigRow(doc, distanceM),
            distanceM,
          });
        }
      }
    }

    const class8Rows = [...class8ByStation.values()].sort(
      (a, b) => a.distanceM - b.distanceM,
    );
    const closestClass8DistanceM =
      class8Rows.length > 0 ? class8Rows[0].distanceM : null;

    // Reality check: the 5 closest ANY-class chargers near the first corridor
    // point (typically the origin) — the LD units that are the wrong answer.
    let fiveClosestAnyClass: ReturnType<typeof toConfigRow>[] = [];
    if (corridorPoints.length > 0) {
      const anyHits = await nearestPoints(ctx, {
        table: "chargers",
        point: { lat: corridorPoints[0].lat, lng: corridorPoints[0].lng },
        limit: 5,
      });
      fiveClosestAnyClass = anyHits.map(({ doc, distanceM }) =>
        toConfigRow(doc, distanceM),
      );
    }

    return {
      class8WithinCorridor: class8ByStation.size,
      closestClass8DistanceM,
      class8Chargers: class8Rows.map((c) => c.row),
      fiveClosestAnyClass,
    };
  },
});
