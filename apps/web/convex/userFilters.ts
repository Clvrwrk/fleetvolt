// Anonymous view-state persistence for /pulse (D-07).
//
// `filterKey` is an ANONYMOUS localStorage UUID (generated client-side on first
// mount), NOT a WorkOS subject id — Convex runs unauthenticated in Phase 7
// (D-06). This key will be rekeyed to a WorkOS subject id in Phase 10 by
// swapping the key source; the shape stays the same.
//
// Thin, unauthenticated — no ctx.auth anywhere.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/** Sensible default view state when a filterKey has no persisted row yet. */
const DEFAULT_FILTERS = {
  timeMode: "5yr" as const,
  overlays: { tam: false, sam: false, som: false },
};

/** Read the persisted filter row for an anonymous filterKey (by_key index). */
export const get = query({
  args: { filterKey: v.string() },
  handler: async (ctx, { filterKey }) => {
    const row = await ctx.db
      .query("userFilters")
      .withIndex("by_key", (q) => q.eq("filterKey", filterKey))
      .unique();
    if (row) return row;
    // No row yet — return a default view-state object (not persisted).
    return { filterKey, ...DEFAULT_FILTERS };
  },
});

/**
 * Insert-or-patch the filter row for an anonymous filterKey. Used by the Wave 2
 * port selector to persist selectedPort under the anonymous key (D-07).
 */
export const upsert = mutation({
  args: {
    filterKey: v.string(),
    timeMode: v.optional(
      v.union(v.literal("5yr"), v.literal("1yr"), v.literal("live")),
    ),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    overlays: v.optional(
      v.object({
        tam: v.boolean(),
        sam: v.boolean(),
        som: v.boolean(),
      }),
    ),
    selectedPort: v.optional(v.string()),
    selectedFlowPath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { filterKey, ...patch } = args;
    const existing = await ctx.db
      .query("userFilters")
      .withIndex("by_key", (q) => q.eq("filterKey", filterKey))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("userFilters", {
      filterKey,
      timeMode: patch.timeMode ?? DEFAULT_FILTERS.timeMode,
      overlays: patch.overlays ?? DEFAULT_FILTERS.overlays,
      periodStart: patch.periodStart,
      periodEnd: patch.periodEnd,
      selectedPort: patch.selectedPort,
      selectedFlowPath: patch.selectedFlowPath,
    });
  },
});
