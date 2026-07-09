// Convex ACTION — the simulate entry point.
// Wraps orchestrator.runSimulation, persists results to the simulations table.
//
// NOTE: Convex actions don't have ctx.db — they use ctx.runQuery/runMutation.
// Table reads (truckConfigs, corridors, elevationProfiles) go through
// internal queries defined here. Charger search uses the spatial layer.

import { action, query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { runSimulation, type OrchestratorCtx } from "./orchestrator";
import { computeInputsHashAsync, PHYSICS_VERSION, CHARGER_VERSION } from "./inputsHash";
import type {
  ElevationPoint,
  SimulateRequest,
  TruckParams,
  ConditionsSpec,
} from "./types";
import type { ChargerSearchCtx } from "./chargingPlanner";

const MIN_HD_POWER_KW = 350.0;

/**
 * Workbench / scenario forms pass file slugs (ecascadia_438); truckConfigs
 * rows are keyed by display `name`. Keep this map in sync with
 * apps/web/src/lib/scenario-schema.ts TRUCK_SLUG_BY_NAME.
 */
const TRUCK_NAME_BY_SLUG: Record<string, string> = {
  ecascadia_291: "Freightliner eCascadia 291 kWh",
  ecascadia_438: "Freightliner eCascadia 438 kWh",
  t680e_375: "Kenworth T680E 375 kWh",
  vnr_electric_375: "Volvo VNR Electric 375 kWh",
  vnr_electric_565: "Volvo VNR Electric 565 kWh",
  tesla_semi_800: "Tesla Semi Long Range",
  tesla_semi_500: "Tesla Semi Standard Range",
};

function resolveTruckLookupName(slugOrName: string): string {
  return TRUCK_NAME_BY_SLUG[slugOrName] ?? slugOrName;
}

// ── Internal queries for table reads (actions can't use ctx.db) ─────────────

/** Query: get truck config by display name or workbench slug. */
export const getTruckConfig = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const lookup = resolveTruckLookupName(name);
    const byName = await ctx.db
      .query("truckConfigs")
      .withIndex("by_name", (q) => q.eq("name", lookup))
      .first();
    if (byName) return byName;
    if (lookup !== name) {
      return await ctx.db
        .query("truckConfigs")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
    }
    return null;
  },
});

/** Query: get corridor by key. */
export const getCorridor = query({
  args: { corridorKey: v.string() },
  handler: async (ctx, { corridorKey }) => {
    const row = await ctx.db
      .query("corridors")
      .withIndex("by_corridorKey", (q) => q.eq("corridorKey", corridorKey))
      .first();
    return row;
  },
});

/** Query: get elevation profile by corridor key. */
export const getElevationProfile = query({
  args: { corridorKey: v.string() },
  handler: async (ctx, { corridorKey }) => {
    const row = await ctx.db
      .query("elevationProfiles")
      .filter((q) => q.eq(q.field("corridorKey"), corridorKey))
      .first();
    return row;
  },
});

/** Query: search HD chargers near a point (using spatial layer). */
export const searchChargers = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
  },
  handler: async (ctx, { lat, lng, radiusM }) => {
    const { nearestPoints } = await import("../lib/spatial");
    const results = await nearestPoints(ctx, {
      table: "chargers" as const,
      point: { lat, lng },
      maxDistanceM: radiusM,
      filter: (doc: any) =>
        doc.powerKw !== undefined && doc.powerKw >= MIN_HD_POWER_KW,
    });
    return results.map((r) => ({
      station_id: (r.doc as any).stationId ?? String((r.doc as any)._id),
      name: (r.doc as any).name ?? null,
      lat: (r.doc as any).location?.lat ?? 0,
      lon: (r.doc as any).location?.lng ?? 0,
      power_kw: (r.doc as any).powerKw ?? 0,
      hd_capable: true,
      distance_m: r.distanceM,
    }));
  },
});

// ── Mutation: save simulation ────────────────────────────────────────────────

/** Mutation: save simulation record. */
export const saveSimulation = mutation({
  args: {
    inputsHash: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    corridorKey: v.optional(v.string()),
    truckConfigName: v.optional(v.string()),
    physicsVersion: v.optional(v.string()),
    chargerVersion: v.optional(v.string()),
    inputs: v.optional(v.any()),
    results: v.optional(v.any()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("simulations", {
      inputsHash: args.inputsHash,
      status: args.status,
      corridorKey: args.corridorKey,
      truckConfigName: args.truckConfigName,
      physicsVersion: args.physicsVersion,
      chargerVersion: args.chargerVersion,
      inputs: args.inputs,
      results: args.results,
      durationMs: args.durationMs,
      provenance: {
        source: "ESTIMATE",
        fetchedAt: Date.now(),
        usefulnessScore: 8,
        matchMethod: "modeled",
        method: "modeled",
        inputs: ["physics_engine", "port_drayage", "charging_planner"],
      },
    });
  },
});

/** Query: get cached simulation result by inputsHash. */
export const getCachedResult = query({
  args: { inputsHash: v.string() },
  handler: async (ctx, { inputsHash }) => {
    const sim = await ctx.db
      .query("simulations")
      .withIndex("by_inputsHash", (q) => q.eq("inputsHash", inputsHash))
      .first();
    if (sim?.status === "completed" && sim.results) {
      return sim.results;
    }
    return null;
  },
});

// ── ACTION: simulate ─────────────────────────────────────────────────────────

/**
 * CONVEX ACTION: simulate
 *
 * Runs the full physics simulation pipeline and persists results.
 * Caches by inputsHash — if a completed run exists, returns cached results.
 */
export const simulate = action({
  args: {
    request: v.any(),
  },
  handler: async (ctx, { request }): Promise<unknown> => {
    const req = request as SimulateRequest;
    const inputsHash = await computeInputsHashAsync(
      req as unknown as Record<string, unknown>,
      PHYSICS_VERSION,
      CHARGER_VERSION,
    );

    // Check for cached completed run
    const cached = await ctx.runQuery(api.physics.simulate.getCachedResult, {
      inputsHash,
    });
    if (cached) {
      return cached;
    }

    // Build charger search context
    const chargerSearchCtx: ChargerSearchCtx = {
      async searchHdChargers(lat, lon, radiusM) {
        return await ctx.runQuery(api.physics.simulate.searchChargers, {
          lat,
          lng: lon,
          radiusM,
        });
      },
      getApiKey() {
        return process.env.GOOGLE_MAPS_API_KEY ?? "";
      },
    };

    // Build orchestrator context
    const orchCtx: OrchestratorCtx = {
      chargerSearchCtx,
      async loadTruckConfig(slug: string, conditions: ConditionsSpec) {
        const truckRow = await ctx.runQuery(api.physics.simulate.getTruckConfig, {
          name: slug,
        });
        if (!truckRow) {
          throw new Error(`Truck config not found: ${slug}`);
        }
        const params = (truckRow.params ?? {}) as Record<string, unknown>;
        const filePayload: Record<string, unknown> = {
          name: truckRow.name,
          usable_kwh: truckRow.batteryUsableKwh ?? params.usable_kwh ?? 438,
          curb_weight_lbs: truckRow.curbWeightLbs ?? params.curb_weight_lbs ?? 26000,
          C_rr: truckRow.rollingResistanceCoeff ?? params.C_rr ?? 0.0065,
          drag_coefficient: params.drag_coefficient ?? 0.65,
          frontal_area_m2: truckRow.cdA ?? params.frontal_area_m2 ?? 9.8,
          regen_efficiency: truckRow.regenEfficiency ?? params.regen_efficiency ?? 0.70,
          aux_kw_base: truckRow.auxKwBase ?? params.aux_kw_base ?? 10.0,
          charge_curve: params.charge_curve ?? [],
        };
        const truck: TruckParams = {
          usable_kwh: Number(params.usable_kwh ?? filePayload.usable_kwh),
          curb_weight_lbs: Number(params.curb_weight_lbs ?? filePayload.curb_weight_lbs ?? 26000),
          payload_lbs: Number(conditions.payload_lbs ?? 0),
          C_rr: Number(params.C_rr ?? filePayload.C_rr ?? 0.0065),
          drag_coefficient: Number(params.drag_coefficient ?? filePayload.drag_coefficient ?? 0.65),
          frontal_area_m2: Number(params.frontal_area_m2 ?? filePayload.frontal_area_m2 ?? 9.8),
          regen_efficiency: Number(params.regen_efficiency ?? filePayload.regen_efficiency ?? 0.70),
          regen_power_cap_kw: Number(params.regen_power_cap_kw ?? 350.0),
          regen_soc_cutoff: Number(params.regen_soc_cutoff ?? 90.0),
          aux_kw_base: Number(params.aux_kw_base ?? filePayload.aux_kw_base ?? 10.0),
          drivetrain_efficiency: Number(params.drivetrain_efficiency ?? filePayload.drivetrain_efficiency ?? 0.92),
        };
        return { truck, oemParams: params, filePayload };
      },
      async resolveEndpoints(request: SimulateRequest) {
        const route = request.route;
        if (route.corridor_key) {
          const corridor = await ctx.runQuery(api.physics.simulate.getCorridor, {
            corridorKey: route.corridor_key,
          });
          if (!corridor) {
            throw new Error(`Unknown corridor: ${route.corridor_key}`);
          }
          return {
            originLat: corridor.origin.lat,
            originLon: corridor.origin.lng,
            destLat: corridor.dest.lat,
            destLon: corridor.dest.lng,
            corridorKey: route.corridor_key,
          };
        }
        if (route.origin && route.dest) {
          return {
            originLat: route.origin.lat,
            originLon: route.origin.lon,
            destLat: route.dest.lat,
            destLon: route.dest.lon,
            corridorKey: null,
          };
        }
        throw new Error("Route must have corridor_key or origin+dest");
      },
      async getElevationProfile(corridorKey, coordinates) {
        if (corridorKey) {
          const elevProfile = await ctx.runQuery(
            api.physics.simulate.getElevationProfile,
            { corridorKey },
          );
          if (elevProfile) {
            const profile: ElevationPoint[] = (elevProfile as any).profile.map(
              (p: any) => ({ dist_m: p.distM, elev_m: p.elevM }),
            );
            return {
              profile,
              source: "convex_cached",
              distanceM: profile[profile.length - 1]?.dist_m ?? 0,
              coordinates,
            };
          }
        }
        // Fallback: synthetic flat profile
        const distM = 100 * 1609.344;
        const profile: ElevationPoint[] = [
          { dist_m: 0, elev_m: 0 },
          { dist_m: distM, elev_m: 0 },
        ];
        return {
          profile,
          source: "synthetic_flat",
          distanceM: distM,
          coordinates,
        };
      },
    };

    // Run the simulation
    const startTime = Date.now();
    const response = await runSimulation(orchCtx, req);
    const durationMs = Date.now() - startTime;

    // Persist to simulations table
    await ctx.runMutation(api.physics.simulate.saveSimulation, {
      inputsHash,
      status: "completed" as const,
      corridorKey: response.corridor_key ?? undefined,
      truckConfigName: req.truck.slug,
      physicsVersion: PHYSICS_VERSION,
      chargerVersion: CHARGER_VERSION,
      inputs: req,
      results: response,
      durationMs,
    });

    return response;
  },
});
