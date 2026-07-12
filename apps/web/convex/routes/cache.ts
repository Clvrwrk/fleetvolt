import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  PTV_REFRESH_LEASE_MS,
  PTV_ROUTE_TTL_MS,
  cacheAgeDays,
  cacheDisposition,
  hasUsableRoadGeometry,
} from "./cachePolicy";

const coordinate = v.object({ latitude: v.number(), longitude: v.number() });
const provider = v.union(
  v.literal("ptv"),
  v.literal("google"),
  v.literal("valhalla"),
  v.literal("mock"),
);

type RouteDoc = Doc<"routeGeometries">;

function cachedResult(
  row: RouteDoc,
  now: number,
  cacheStatus: string,
) {
  if (!hasUsableRoadGeometry(row)) return null;
  return {
    provider: row.provider,
    coordinates: row.coordinates,
    ...(row.distanceMeters !== undefined
      ? { distanceMeters: row.distanceMeters }
      : {}),
    ...(row.durationSeconds !== undefined
      ? { durationSeconds: row.durationSeconds }
      : {}),
    ...(row.encodedPolyline !== undefined
      ? { encodedPolyline: row.encodedPolyline }
      : {}),
    warnings: row.warnings,
    metadata: {
      ...(row.providerMetadata ?? {}),
      requestHash: row.requestHash,
      cacheStatus,
      freshness: row.expiresAt > now ? "fresh" : "stale",
      pulledAt: row.pulledAt,
      expiresAt: row.expiresAt,
      cacheAgeDays: cacheAgeDays(row.pulledAt, now),
      accessCount: row.accessCount + 1,
      refreshCount: row.refreshCount,
      ...(row.lastRefreshError
        ? { lastRefreshError: row.lastRefreshError }
        : {}),
    },
  };
}

export const claim = internalMutation({
  args: {
    requestHash: v.string(),
    provider,
    origin: coordinate,
    destination: coordinate,
    waypoints: v.array(coordinate),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("routeGeometries")
      .withIndex("by_requestHash", (q) =>
        q.eq("requestHash", args.requestHash),
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("routeGeometries", {
        requestHash: args.requestHash,
        provider: args.provider,
        origin: args.origin,
        destination: args.destination,
        waypoints: args.waypoints,
        coordinates: [],
        warnings: [],
        pulledAt: 0,
        expiresAt: 0,
        refreshLeaseUntil: args.now + PTV_REFRESH_LEASE_MS,
        refreshState: "refreshing",
        lastRefreshAttemptAt: args.now,
        accessCount: 1,
        refreshCount: 0,
        lastAccessedAt: args.now,
        createdAt: args.now,
        updatedAt: args.now,
      });
      return { state: "refresh-owner" as const, cached: null };
    }

    const disposition = cacheDisposition(existing, args.now);
    await ctx.db.patch(existing._id, {
      accessCount: existing.accessCount + 1,
      lastAccessedAt: args.now,
      updatedAt: args.now,
      ...(disposition === "refresh-owner"
        ? {
            refreshLeaseUntil: args.now + PTV_REFRESH_LEASE_MS,
            refreshState: "refreshing" as const,
            lastRefreshAttemptAt: args.now,
            lastRefreshError: undefined,
          }
        : {}),
    });

    if (disposition === "fresh") {
      return {
        state: "fresh" as const,
        cached: cachedResult(existing, args.now, "database-hit"),
      };
    }
    if (disposition === "stale-refreshing") {
      return {
        state: "stale-refreshing" as const,
        cached: cachedResult(
          existing,
          args.now,
          "database-stale-refreshing",
        ),
      };
    }
    return {
      state: "refresh-owner" as const,
      cached: cachedResult(existing, args.now, "database-stale-refresh-owner"),
    };
  },
});

export const complete = internalMutation({
  args: {
    requestHash: v.string(),
    provider,
    coordinates: v.array(coordinate),
    distanceMeters: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    encodedPolyline: v.optional(v.string()),
    warnings: v.array(v.string()),
    providerMetadata: v.optional(v.any()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    if (!hasUsableRoadGeometry(args)) {
      throw new Error("Refusing to persist route geometry with fewer than 8 points");
    }
    const existing = await ctx.db
      .query("routeGeometries")
      .withIndex("by_requestHash", (q) =>
        q.eq("requestHash", args.requestHash),
      )
      .unique();
    if (!existing) {
      throw new Error("Route cache claim is missing before completion");
    }

    const expiresAt = args.now + PTV_ROUTE_TTL_MS;
    await ctx.db.patch(existing._id, {
      provider: args.provider,
      coordinates: args.coordinates,
      distanceMeters: args.distanceMeters,
      durationSeconds: args.durationSeconds,
      encodedPolyline: args.encodedPolyline,
      warnings: args.warnings,
      providerMetadata: args.providerMetadata,
      pulledAt: args.now,
      expiresAt,
      refreshLeaseUntil: undefined,
      refreshState: "fresh",
      lastRefreshError: undefined,
      refreshCount: existing.refreshCount + 1,
      updatedAt: args.now,
    });
    return {
      pulledAt: args.now,
      expiresAt,
      refreshCount: existing.refreshCount + 1,
    };
  },
});

export const fail = internalMutation({
  args: {
    requestHash: v.string(),
    error: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("routeGeometries")
      .withIndex("by_requestHash", (q) =>
        q.eq("requestHash", args.requestHash),
      )
      .unique();
    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      refreshLeaseUntil: undefined,
      refreshState: "failed",
      lastRefreshAttemptAt: args.now,
      lastRefreshError: args.error.slice(0, 500),
      updatedAt: args.now,
    });
    return cachedResult(existing, args.now, "database-stale-refresh-failed");
  },
});

export const getByHash = internalQuery({
  args: { requestHash: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("routeGeometries")
      .withIndex("by_requestHash", (q) =>
        q.eq("requestHash", args.requestHash),
      )
      .unique();
    return row
      ? cachedResult(row, args.now, "database-read")
      : null;
  },
});
