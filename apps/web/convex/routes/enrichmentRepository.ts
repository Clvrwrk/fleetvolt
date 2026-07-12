import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import {
  ENRICHMENT_REFRESH_LEASE_MS,
  ENRICHMENT_TTL_MS,
  cacheDisposition,
} from "./enrichmentPolicy";

type EnrichmentDoc = Doc<"routeEnrichments">;

function cachedResult(
  row: EnrichmentDoc,
  now: number,
  cacheStatus: string,
) {
  if (row.snapshot === undefined || row.computedAt <= 0) return null;
  return {
    snapshot: row.snapshot,
    metadata: {
      requestHash: row.requestHash,
      cacheStatus,
      freshness: row.expiresAt > now ? "fresh" : "stale",
      computedAt: row.computedAt,
      expiresAt: row.expiresAt,
      accessCount: row.accessCount + 1,
      refreshCount: row.refreshCount,
      ...(row.lastRefreshError ? { lastRefreshError: row.lastRefreshError } : {}),
    },
  };
}

export const claim = internalMutation({
  args: {
    requestHash: v.string(),
    now: v.number(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("routeEnrichments")
      .withIndex("by_requestHash", (q) => q.eq("requestHash", args.requestHash))
      .unique();

    if (!existing) {
      await ctx.db.insert("routeEnrichments", {
        requestHash: args.requestHash,
        computedAt: 0,
        expiresAt: 0,
        refreshLeaseUntil: args.now + ENRICHMENT_REFRESH_LEASE_MS,
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

    const normalDisposition = cacheDisposition(
      {
        hasSnapshot: existing.snapshot !== undefined && existing.computedAt > 0,
        expiresAt: existing.expiresAt,
        refreshLeaseUntil: existing.refreshLeaseUntil,
      },
      args.now,
    );
    const disposition =
      args.force === true && normalDisposition !== "stale-refreshing"
        ? "refresh-owner"
        : normalDisposition;

    await ctx.db.patch(existing._id, {
      accessCount: existing.accessCount + 1,
      lastAccessedAt: args.now,
      updatedAt: args.now,
      ...(disposition === "refresh-owner"
        ? {
            refreshLeaseUntil: args.now + ENRICHMENT_REFRESH_LEASE_MS,
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
        cached: cachedResult(existing, args.now, "database-stale-refreshing"),
      };
    }
    return {
      state: "refresh-owner" as const,
      cached: cachedResult(existing, args.now, "database-stale-refresh-owner"),
    };
  },
});

export const complete = internalMutation({
  args: { requestHash: v.string(), snapshot: v.any(), now: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("routeEnrichments")
      .withIndex("by_requestHash", (q) => q.eq("requestHash", args.requestHash))
      .unique();
    if (!existing) throw new Error("Route enrichment claim is missing before completion");

    const expiresAt = args.now + ENRICHMENT_TTL_MS;
    await ctx.db.patch(existing._id, {
      snapshot: args.snapshot,
      computedAt: args.now,
      expiresAt,
      refreshLeaseUntil: undefined,
      refreshState: "fresh",
      lastRefreshError: undefined,
      refreshCount: existing.refreshCount + 1,
      updatedAt: args.now,
    });
    return {
      computedAt: args.now,
      expiresAt,
      accessCount: existing.accessCount,
      refreshCount: existing.refreshCount + 1,
    };
  },
});

export const fail = internalMutation({
  args: { requestHash: v.string(), error: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("routeEnrichments")
      .withIndex("by_requestHash", (q) => q.eq("requestHash", args.requestHash))
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
      .query("routeEnrichments")
      .withIndex("by_requestHash", (q) => q.eq("requestHash", args.requestHash))
      .unique();
    return row ? cachedResult(row, args.now, "database-read") : null;
  },
});
