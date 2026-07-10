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
// Single source of truth for the Class-8 gap read (see chargers/class8.ts).
import { toConfigRow, class8WithinRadius } from "./class8";

/**
 * Nearest TRUE Class-8-capable chargers (≥350 kW AND MD/HD) within radius,
 * ascending by distance.
 *
 * Prefer the in-index `class8` filterKey (set at ingest via insertPoint
 * filterFields:{class8}). Do NOT use a JS-only filter here — nearestPoints
 * multiplies fetchLimit by 5 when a JS filter is present, which blows the
 * Convex document-read budget on long corridors.
 */
export const nearestClass8 = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { lat, lng, radiusM, limit }) => {
    // Delegates to the shared class8WithinRadius primitive (in-index filter +
    // defense-in-depth predicate) so this can never diverge from class8Gap.
    const { chargers } = await class8WithinRadius(ctx, {
      point: { lat, lng },
      radiusM,
      limit: limit ?? 5,
    });
    return chargers;
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
 *
 * Read-budget guard: evenly sample ≤12 probes and use the in-index `class8`
 * filterKey (no JS-filter over-fetch). Long SF→Barstow polylines previously
 * blew the 32k document-read cap via 24×(64×5) geospatial nearest scans.
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

    const probes = sampleCorridorProbes(corridorPoints, 12);

    for (const pt of probes) {
      // Shared Class-8 read primitive — small limit: gap analysis needs presence
      // + closest, not a full catalog.
      const { chargers } = await class8WithinRadius(ctx, { point: pt, radiusM, limit: 8 });
      for (const row of chargers) {
        const prev = class8ByStation.get(row.stationId);
        if (!prev || row.distanceM < prev.distanceM) {
          class8ByStation.set(row.stationId, { row, distanceM: row.distanceM });
        }
      }
    }

    const class8Rows = [...class8ByStation.values()].sort(
      (a, b) => a.distanceM - b.distanceM,
    );
    const closestClass8DistanceM =
      class8Rows.length > 0 ? class8Rows[0]!.distanceM : null;

    // Reality check: the 5 closest ANY-class chargers near the first corridor
    // point (typically the origin) — the LD units that are the wrong answer.
    let fiveClosestAnyClass: ReturnType<typeof toConfigRow>[] = [];
    if (corridorPoints.length > 0) {
      const origin = corridorPoints[0]!;
      const anyHits = await nearestPoints(ctx, {
        table: "chargers",
        point: { lat: origin.lat, lng: origin.lng },
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

/** Evenly sample corridor probes so long polylines stay under the read budget. */
function sampleCorridorProbes(
  points: Array<{ lat: number; lng: number }>,
  maxPoints: number,
): Array<{ lat: number; lng: number }> {
  if (points.length <= maxPoints) return points;
  const lastIndex = points.length - 1;
  const sampled: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const index = Math.round((i / (maxPoints - 1)) * lastIndex);
    sampled.push(points[index]!);
  }
  return sampled;
}
