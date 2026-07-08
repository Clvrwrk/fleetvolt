// Driver profile mutations (P-DRIVER).
//
// createOrUpdateProfile — upsert by driverId. On first call, inserts; on
// subsequent calls, patches the existing row (preserving createdAt). The
// driverId is a stable anonymous ID (localStorage UUID or WorkOS subject).
//
// No auth yet — any caller with a driverId can upsert. Phase 10 (WorkOS) will
// gate this behind a session check.
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const createOrUpdateProfile = mutation({
  args: {
    driverId: v.string(),
    displayName: v.string(),
    email: v.optional(v.string()),
    associatedCarrierKey: v.optional(v.string()),
    preferredTruckSlug: v.optional(v.string()),
    defaultPayloadLbs: v.optional(v.number()),
    defaultWeatherPreset: v.optional(
      v.union(
        v.literal("ideal"),
        v.literal("hot"),
        v.literal("cold"),
        v.literal("headwind"),
      ),
    ),
    portDrayageEnabled: v.optional(v.boolean()),
    chargingPreferences: v.optional(
      v.object({
        soc_trigger_pct: v.number(),
        soc_floor_pct: v.number(),
        target_soc_pct: v.number(),
        min_arrival_soc_pct: v.number(),
      }),
    ),
    physicsOverrides: v.optional(
      v.object({
        C_rr: v.optional(v.number()),
        drag_coefficient: v.optional(v.number()),
        usable_kwh: v.optional(v.number()),
        aux_kw_base: v.optional(v.number()),
        regen_efficiency: v.optional(v.number()),
      }),
    ),
    homeTerminal: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        label: v.optional(v.string()),
      }),
    ),
    preferredCorridorKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("driverProfiles")
      .withIndex("by_driverId", (q) => q.eq("driverId", args.driverId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        createdAt: existing.createdAt, // preserve original
        updatedAt: now,
      });
      return { _id: existing._id, driverId: args.driverId, updated: true };
    }

    const _id = await ctx.db.insert("driverProfiles", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return { _id, driverId: args.driverId, updated: false };
  },
});
