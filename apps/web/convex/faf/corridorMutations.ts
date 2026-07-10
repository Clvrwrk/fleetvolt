/**
 * Persist road-traced freightCorridors (idempotent by corridorKey).
 */
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const pathPoint = v.object({ lat: v.number(), lng: v.number() });

export const upsertFreightCorridor = internalMutation({
  args: {
    corridorKey: v.string(),
    name: v.string(),
    originPortCode: v.string(),
    destLabel: v.string(),
    viaRouteLabel: v.string(),
    compareGroup: v.optional(v.string()),
    origin: pathPoint,
    dest: pathPoint,
    path: v.array(pathPoint),
    distanceMiles: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    intensity: v.number(),
    tier: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("heavy"),
    ),
    color: v.string(),
    directionHint: v.string(),
    truckAadtStats: v.optional(
      v.object({
        min: v.number(),
        max: v.number(),
        mean: v.number(),
        p90: v.number(),
        sampleCount: v.number(),
      }),
    ),
    bbox: v.object({
      minLat: v.number(),
      minLng: v.number(),
      maxLat: v.number(),
      maxLng: v.number(),
    }),
    fetchedAt: v.number(),
  },
  returns: v.object({
    corridorKey: v.string(),
    updated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("freightCorridors")
      .withIndex("by_corridorKey", (q) => q.eq("corridorKey", args.corridorKey))
      .first();

    const doc = {
      corridorKey: args.corridorKey,
      name: args.name,
      originPortCode: args.originPortCode,
      destLabel: args.destLabel,
      viaRouteLabel: args.viaRouteLabel,
      ...(args.compareGroup ? { compareGroup: args.compareGroup } : {}),
      origin: args.origin,
      dest: args.dest,
      path: args.path,
      ...(typeof args.distanceMiles === "number"
        ? { distanceMiles: args.distanceMiles }
        : {}),
      ...(typeof args.durationSeconds === "number"
        ? { durationSeconds: args.durationSeconds }
        : {}),
      intensity: args.intensity,
      tier: args.tier,
      color: args.color,
      directionHint: args.directionHint,
      ...(args.truckAadtStats
        ? { truckAadtStats: args.truckAadtStats }
        : {}),
      bbox: args.bbox,
      provenance: {
        source: "Caltrans_AADT" as const,
        year: 2019,
        fetchedAt: args.fetchedAt,
        usefulnessScore: 7,
        matchMethod: "google_routes_via_waypoints_aadt_sample",
        method: "modeled" as const,
        inputs: [
          "google_routes_via_waypoints",
          "Caltrans_TRK_5_AXLE_postmiles",
        ],
      },
    };

    if (existing) {
      // Full replace so omitted optionals (distanceMiles, durationSeconds,
      // truckAadtStats, compareGroup) do not survive rebuilds.
      await ctx.db.replace(existing._id, doc);
      return { corridorKey: args.corridorKey, updated: true };
    }
    await ctx.db.insert("freightCorridors", doc);
    return { corridorKey: args.corridorKey, updated: false };
  },
});
