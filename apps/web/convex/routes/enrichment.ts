import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalAction } from "../_generated/server";

type CategoryWithCoverage = {
  coverage?: { state?: string; reason?: string };
};

function unavailableReasons(snapshot: Record<string, CategoryWithCoverage>) {
  return Object.entries(snapshot)
    .filter(([, value]) => value?.coverage?.state === "unavailable")
    .map(([category, value]) => ({ category, reason: value.coverage?.reason }));
}

export const buildSnapshot = internalAction({
  args: { requestHash: v.string(), now: v.number() },
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const [route, traffic, freight, chargers, parking, amenities, carriers, fleetYards] =
      await Promise.all([
        ctx.runQuery(internal.routes.enrichmentSources.routeContext, args),
        ctx.runQuery(internal.routes.enrichmentSources.trafficAlongRoute, args),
        ctx.runQuery(internal.routes.enrichmentSources.freightContext, args),
        ctx.runQuery(internal.routes.enrichmentSources.chargersAlongRoute, args),
        ctx.runQuery(internal.routes.enrichmentSources.parkingAlongRoute, args),
        ctx.runQuery(internal.routes.enrichmentSources.amenitiesAlongRoute, args),
        ctx.runQuery(internal.routes.enrichmentSources.carriersAlongRoute, args),
        ctx.runQuery(internal.routes.enrichmentSources.fleetYardsAlongRoute, args),
      ]);
    const categories = {
      traffic,
      freight,
      chargers,
      parking,
      amenities,
      carriers,
      fleetYards,
    };
    return {
      version: 1,
      requestHash: args.requestHash,
      computedAt: args.now,
      ...route,
      ...categories,
      unavailable: unavailableReasons(categories),
    };
  },
});

export const forRoute = action({
  args: { requestHash: v.string(), force: v.optional(v.boolean()) },
  handler: async (
    ctx,
    args,
  ): Promise<{ snapshot: unknown; metadata: Record<string, unknown> }> => {
    const now = Date.now();
    const claim = await ctx.runMutation(internal.routes.enrichmentRepository.claim, {
      requestHash: args.requestHash,
      now,
      force: args.force,
    });
    if (claim.state === "fresh" && claim.cached) return claim.cached;
    if (claim.state === "stale-refreshing") {
      if (claim.cached) return claim.cached;
      throw new Error("Route intelligence refresh is already in progress; retry shortly");
    }

    try {
      const snapshot = await ctx.runAction(internal.routes.enrichment.buildSnapshot, {
        requestHash: args.requestHash,
        now,
      });
      const receipt = await ctx.runMutation(
        internal.routes.enrichmentRepository.complete,
        { requestHash: args.requestHash, snapshot, now: Date.now() },
      );
      return {
        snapshot,
        metadata: {
          requestHash: args.requestHash,
          cacheStatus: claim.cached ? "database-refreshed" : "database-miss-write",
          freshness: "fresh",
          ...receipt,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stale = await ctx.runMutation(internal.routes.enrichmentRepository.fail, {
        requestHash: args.requestHash,
        error: message,
        now: Date.now(),
      });
      if (stale) {
        return {
          ...stale,
          metadata: {
            ...stale.metadata,
            warning: `Refresh failed; serving stale route intelligence. ${message}`,
          },
        };
      }
      throw new Error(`Route intelligence is unavailable: ${message}`);
    }
  },
});
