import { v } from "convex/values";
import { query } from "../_generated/server";
import { authKit } from "../auth";

export const myUserAccount = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authKit.getAuthUser(ctx);
    if (!authUser) return null;
    return await ctx.db
      .query("userAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", authUser.id))
      .first();
  },
});

export const myFleets = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const authUser = await authKit.getAuthUser(ctx);
    if (!authUser) return [];
    return await ctx.db
      .query("userFleets")
      .withIndex("by_userId_updatedAt", (q) => q.eq("userId", authUser.id))
      .order("desc")
      .take(limit ?? 50);
  },
});

export const myRoutes = query({
  args: { limit: v.optional(v.number()), fleetId: v.optional(v.string()) },
  handler: async (ctx, { limit, fleetId }) => {
    const authUser = await authKit.getAuthUser(ctx);
    if (!authUser) return [];
    if (fleetId) {
      return await ctx.db
        .query("userRoutes")
        .withIndex("by_fleetId", (q) => q.eq("fleetId", fleetId))
        .filter((q) => q.eq(q.field("userId"), authUser.id))
        .order("desc")
        .take(limit ?? 50);
    }
    return await ctx.db
      .query("userRoutes")
      .withIndex("by_userId_updatedAt", (q) => q.eq("userId", authUser.id))
      .order("desc")
      .take(limit ?? 50);
  },
});

export const getMyRoute = query({
  args: { routeId: v.string() },
  handler: async (ctx, { routeId }) => {
    const authUser = await authKit.getAuthUser(ctx);
    if (!authUser) return null;
    const route = await ctx.db
      .query("userRoutes")
      .withIndex("by_routeId", (q) => q.eq("routeId", routeId))
      .first();
    if (!route || route.userId !== authUser.id) return null;
    return route;
  },
});
