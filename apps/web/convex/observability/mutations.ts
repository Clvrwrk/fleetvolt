import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { authKit } from "../auth";

const roleValidator = v.union(v.literal("driver"), v.literal("fleet_manager"), v.literal("caas"));

export const recordSiteError = mutation({
  args: {
    errorId: v.string(),
    route: v.optional(v.string()),
    url: v.optional(v.string()),
    component: v.optional(v.string()),
    severity: v.union(v.literal("info"), v.literal("warn"), v.literal("error"), v.literal("fatal")),
    message: v.string(),
    stack: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const authUser = await authKit.getAuthUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("siteErrors")
      .withIndex("by_errorId", (q) => q.eq("errorId", args.errorId))
      .first();
    const payload = { ...args, userId: authUser?.id, createdAt: now };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { patched: true, id: existing._id };
    }
    const id = await ctx.db.insert("siteErrors", payload);
    return { inserted: true, id };
  },
});

export const recordQueryHistory = mutation({
  args: {
    queryId: v.string(),
    role: v.optional(roleValidator),
    message: v.string(),
    response: v.optional(v.string()),
    visualizationType: v.optional(v.string()),
    status: v.union(v.literal("success"), v.literal("error")),
    errorMessage: v.optional(v.string()),
    queriesRun: v.optional(v.array(v.any())),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const authUser = await authKit.getAuthUser(ctx);
    if (!authUser) throw new Error("Authentication required to record query history");
    const now = Date.now();
    const existing = await ctx.db
      .query("userQueryHistory")
      .withIndex("by_queryId", (q) => q.eq("queryId", args.queryId))
      .first();
    const payload = { ...args, userId: authUser.id, createdAt: now };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { patched: true, id: existing._id };
    }
    const id = await ctx.db.insert("userQueryHistory", payload);
    return { inserted: true, id };
  },
});

export const recordQueryResponseError = mutation({
  args: {
    errorId: v.string(),
    queryId: v.optional(v.string()),
    functionName: v.optional(v.string()),
    args: v.optional(v.any()),
    errorMessage: v.string(),
    errorKind: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await authKit.getAuthUser(ctx);
    const existing = await ctx.db
      .query("queryResponseErrors")
      .withIndex("by_errorId", (q) => q.eq("errorId", args.errorId))
      .first();
    const payload = { ...args, userId: authUser?.id, createdAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { patched: true, id: existing._id };
    }
    const id = await ctx.db.insert("queryResponseErrors", payload);
    return { inserted: true, id };
  },
});

export const resolveSiteError = mutation({
  args: { errorId: v.string() },
  handler: async (ctx, { errorId }) => {
    const row = await ctx.db
      .query("siteErrors")
      .withIndex("by_errorId", (q) => q.eq("errorId", errorId))
      .first();
    if (!row) return { resolved: false };
    await ctx.db.patch(row._id, { resolvedAt: Date.now() });
    return { resolved: true };
  },
});
