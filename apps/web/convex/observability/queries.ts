import { v } from "convex/values";
import { query } from "../_generated/server";
import { authKit } from "../auth";

export const myQueryHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const authUser = await authKit.getAuthUser(ctx);
    if (!authUser) return [];
    return await ctx.db
      .query("userQueryHistory")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", authUser.id))
      .order("desc")
      .take(limit ?? 50);
  },
});

export const mySiteErrors = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const authUser = await authKit.getAuthUser(ctx);
    if (!authUser) return [];
    return await ctx.db
      .query("siteErrors")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", authUser.id))
      .order("desc")
      .take(limit ?? 50);
  },
});

export const recentErrors = query({
  args: {
    severity: v.optional(v.union(v.literal("info"), v.literal("warn"), v.literal("error"), v.literal("fatal"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { severity, limit }) => {
    if (severity) {
      return await ctx.db
        .query("siteErrors")
        .withIndex("by_severity_createdAt", (q) => q.eq("severity", severity))
        .order("desc")
        .take(limit ?? 100);
    }
    return await ctx.db.query("siteErrors").order("desc").take(limit ?? 100);
  },
});
