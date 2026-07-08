import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { authKit } from "../auth";

const roleValidator = v.union(v.literal("driver"), v.literal("fleet_manager"), v.literal("caas"));

export const upsertMyUserAccount = mutation({
  args: {
    role: roleValidator,
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    companyName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await authKit.getAuthUser(ctx);
    if (!authUser) throw new Error("Authentication required");
    const now = Date.now();
    const existing = await ctx.db
      .query("userAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", authUser.id))
      .first();
    const payload = {
      userId: authUser.id,
      role: args.role,
      email: args.email ?? authUser.email,
      displayName: args.displayName ?? authUser.email,
      companyName: args.companyName,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { id: existing._id, patched: true };
    }
    const id = await ctx.db.insert("userAccounts", { ...payload, createdAt: now });
    return { id, inserted: true };
  },
});

export const upsertUserAccountFromWorkOS = mutation({
  args: {
    userId: v.string(),
    role: roleValidator,
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    companyName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("userAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    const payload = {
      userId: args.userId,
      role: args.role,
      email: args.email,
      displayName: args.displayName ?? args.email ?? "FleetVolt User",
      companyName: args.companyName,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { id: existing._id, patched: true };
    }
    const id = await ctx.db.insert("userAccounts", { ...payload, createdAt: now });
    return { id, inserted: true };
  },
});

export const upsertMyFleet = mutation({
  args: {
    fleetId: v.string(),
    name: v.string(),
    companyName: v.optional(v.string()),
    dotNumber: v.optional(v.string()),
    homeBase: v.optional(v.object({ lat: v.number(), lng: v.number(), label: v.optional(v.string()) })),
    vehicleCount: v.optional(v.number()),
    driverCount: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const authUser = await authKit.getAuthUser(ctx);
    if (!authUser) throw new Error("Authentication required");
    const now = Date.now();
    const existing = await ctx.db
      .query("userFleets")
      .withIndex("by_fleetId", (q) => q.eq("fleetId", args.fleetId))
      .first();
    const payload = { ...args, userId: authUser.id, updatedAt: now };
    if (existing) {
      if (existing.userId !== authUser.id) throw new Error("Fleet does not belong to current user");
      await ctx.db.patch(existing._id, payload);
      return { id: existing._id, patched: true };
    }
    const id = await ctx.db.insert("userFleets", { ...payload, createdAt: now });
    return { id, inserted: true };
  },
});

export const upsertMyRoute = mutation({
  args: {
    routeId: v.string(),
    fleetId: v.optional(v.string()),
    name: v.string(),
    origin: v.object({ label: v.string(), lat: v.optional(v.number()), lng: v.optional(v.number()) }),
    destination: v.object({ label: v.string(), lat: v.optional(v.number()), lng: v.optional(v.number()) }),
    waypoints: v.array(v.object({ lat: v.number(), lng: v.number(), label: v.optional(v.string()) })),
    assignedDriverIds: v.optional(v.array(v.string())),
    assignedTruckSlugs: v.optional(v.array(v.string())),
    status: v.union(v.literal("draft"), v.literal("planned"), v.literal("active"), v.literal("completed"), v.literal("archived")),
    schedule: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const authUser = await authKit.getAuthUser(ctx);
    if (!authUser) throw new Error("Authentication required");
    const now = Date.now();
    const existing = await ctx.db
      .query("userRoutes")
      .withIndex("by_routeId", (q) => q.eq("routeId", args.routeId))
      .first();
    const payload = { ...args, userId: authUser.id, updatedAt: now };
    if (existing) {
      if (existing.userId !== authUser.id) throw new Error("Route does not belong to current user");
      await ctx.db.patch(existing._id, payload);
      return { id: existing._id, patched: true };
    }
    const id = await ctx.db.insert("userRoutes", { ...payload, createdAt: now });
    return { id, inserted: true };
  },
});
