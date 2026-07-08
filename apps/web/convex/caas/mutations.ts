// CaaS (Charging-as-a-Service) mutations (P-ROLES).
//
//   • createCaasCompany       — upsert by caasId
//   • createDeploymentZone     — insert/upsert caasDeploymentZones by zoneId
//   • updateZonePriority       — patch priority on an existing zone
//
// No auth yet — any caller with a caasId can mutate. Phase 10 (WorkOS) will
// gate behind a session check.
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const createCaasCompany = mutation({
  args: {
    caasId: v.string(),
    name: v.string(),
    serviceArea: v.optional(
      v.object({
        states: v.array(v.string()),
        counties: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("caasCompanies")
      .withIndex("by_caasId", (q) => q.eq("caasId", args.caasId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        createdAt: existing.createdAt,
        updatedAt: now,
      });
      return { _id: existing._id, caasId: args.caasId, updated: true };
    }

    const _id = await ctx.db.insert("caasCompanies", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return { _id, caasId: args.caasId, updated: false };
  },
});

export const createDeploymentZone = mutation({
  args: {
    zoneId: v.string(),
    caasId: v.string(),
    name: v.string(),
    level: v.union(
      v.literal("nation"),
      v.literal("state"),
      v.literal("county"),
      v.literal("air_district"),
      v.literal("zip"),
    ),
    fips: v.optional(v.string()),
    airDistrict: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    centroid: v.object({ lat: v.number(), lng: v.number() }),
    radiusM: v.number(),
    modeledDwellScore: v.optional(v.number()),
    freightFlowKtons: v.optional(v.number()),
    carrierCount: v.optional(v.number()),
    parkingCapacity: v.optional(v.number()),
    existingChargers: v.optional(v.number()),
    class8ChargerGap: v.optional(v.boolean()),
    recommendedPowerKw: v.optional(v.number()),
    priority: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("caasDeploymentZones")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, createdAt: existing.createdAt });
      return { _id: existing._id, zoneId: args.zoneId, updated: true };
    }

    const _id = await ctx.db.insert("caasDeploymentZones", { ...args, createdAt: now });
    return { _id, zoneId: args.zoneId, updated: false };
  },
});

export const updateZonePriority = mutation({
  args: {
    zoneId: v.string(),
    priority: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
  },
  handler: async (ctx, args) => {
    const zone = await ctx.db
      .query("caasDeploymentZones")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", args.zoneId))
      .first();
    if (!zone) throw new Error(`Deployment zone not found: ${args.zoneId}`);
    await ctx.db.patch(zone._id, { priority: args.priority });
    return { zoneId: args.zoneId, priority: args.priority, updated: true };
  },
});
