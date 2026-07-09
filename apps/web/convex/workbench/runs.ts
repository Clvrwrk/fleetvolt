import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { authKit } from "../auth";

const placeValidator = v.object({
  label: v.string(),
  latitude: v.number(),
  longitude: v.number(),
  kind: v.optional(v.string()),
  source: v.optional(v.string()),
  id: v.optional(v.string()),
});

const modeValidator = v.union(
  v.literal("driver_day_plan"),
  v.literal("fleet_contract_plan"),
  v.literal("caas_gap_map"),
);

export const getLatestRun = query({
  args: {
    mode: v.optional(modeValidator),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("workbenchRuns"),
      mode: modeValidator,
      origin: placeValidator,
      destination: placeValidator,
      routeGeometry: v.optional(v.any()),
      resultCards: v.optional(v.any()),
      providerWarnings: v.optional(v.array(v.string())),
      metadata: v.optional(v.any()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const authUser = await authKit.getAuthUser(ctx);
    if (!authUser) return null;

    const mode = args.mode ?? "driver_day_plan";
    const latest = await ctx.db
      .query("workbenchRuns")
      .withIndex("by_userId_mode_createdAt", (q) =>
        q.eq("userId", authUser.id).eq("mode", mode),
      )
      .order("desc")
      .first();

    if (!latest) return null;

    return {
      _id: latest._id,
      mode: latest.mode,
      origin: latest.origin,
      destination: latest.destination,
      routeGeometry: latest.routeGeometry,
      resultCards: latest.resultCards,
      providerWarnings: latest.providerWarnings,
      metadata: latest.metadata,
      createdAt: latest.createdAt,
    };
  },
});

export const saveRun = mutation({
  args: {
    mode: modeValidator,
    origin: placeValidator,
    destination: placeValidator,
    routeGeometry: v.optional(v.any()),
    resultCards: v.optional(v.any()),
    providerWarnings: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
  },
  returns: v.union(v.id("workbenchRuns"), v.null()),
  handler: async (ctx, args) => {
    const authUser = await authKit.getAuthUser(ctx);
    // Soft-fail when unauthenticated (e.g. E2E cookie / expired session) so
    // Calculate still updates the live map; persistence is best-effort.
    if (!authUser) return null;

    return await ctx.db.insert("workbenchRuns", {
      userId: authUser.id,
      mode: args.mode,
      origin: args.origin,
      destination: args.destination,
      routeGeometry: args.routeGeometry,
      resultCards: args.resultCards,
      providerWarnings: args.providerWarnings,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});
