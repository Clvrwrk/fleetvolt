// Driver profile queries (P-DRIVER).
//
//   • getProfile(driverId)            — single profile by driverId
//   • listPreferredTrucks()           — all truckConfigs (for vehicle dropdown)
//   • listCarriersNear(lat,lng,radiusM) — delegates to carriers/queries
//   • listCorridorCities()            — the canonical corridor-city set
//   • listCorridors()                 — all corridors (for preferred corridor)
//
// These are thin read wrappers — no business logic. The carrier query delegates
// to carriers/queries.carriersInRadius so the spatial layer stays in one place.
import { query } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { CORRIDOR_CITIES } from "../carriers/corridorCity";

/** Get a driver profile by driverId. Returns null if not found. */
export const getProfile = query({
  args: { driverId: v.string() },
  handler: async (ctx, { driverId }) => {
    const profile = await ctx.db
      .query("driverProfiles")
      .withIndex("by_driverId", (q) => q.eq("driverId", driverId))
      .first();
    return profile ?? null;
  },
});

/** List all truck configs for the vehicle-selection dropdown. */
export const listPreferredTrucks = query({
  args: {},
  handler: async (ctx) => {
    const trucks = await ctx.db.query("truckConfigs").collect();
    return trucks.map((t) => ({
      name: t.name,
      oemModel: t.oemModel ?? null,
      vehicleClass: t.vehicleClass ?? null,
      batteryUsableKwh: t.batteryUsableKwh ?? null,
    }));
  },
});

/** List all corridors for the preferred-corridor dropdown. */
export const listCorridors = query({
  args: {},
  handler: async (ctx) => {
    const corridors = await ctx.db.query("corridors").collect();
    return corridors.map((c) => ({
      corridorKey: c.corridorKey,
      name: c.name,
      distanceMiles: c.distanceMiles ?? null,
    }));
  },
});

/** The canonical corridor-city cluster names (for the city selector). */
export const listCorridorCities = query({
  args: {},
  handler: async () => {
    return CORRIDOR_CITIES;
  },
});

/**
 * Delegated carrier search — calls carriers/queries.carriersInRadius so the
 * spatial layer (lib/spatial.nearestPoints) stays in one place. Returns the
 * same carrier row shape (name, address, city, corridorCity, distanceM).
 */
export const listCarriersNear = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(api.carriers.queries.carriersInRadius, {
      lat: args.lat,
      lng: args.lng,
      radiusM: args.radiusM,
      limit: args.limit ?? 50,
    });
  },
});
