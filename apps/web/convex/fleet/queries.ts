// Fleet Manager queries (P-ROLES).
//
//   • getFleet(fleetId)               — single fleet company by fleetId
//   • listFleetDrivers(fleetId)         — all drivers in a fleet
//   • listFleetParkingLots(fleetId)     — all parking lots in a fleet
//   • listFleetRoutes(fleetId)          — all routes in a fleet
//   • getFleetOverview(fleetId)         — returns everything: company + drivers + lots + routes
//   • getRouteChargers(routeId)         — chargers available along a route's waypoints
//                                          (delegates to the existing spatial charger layer)
import { query } from "../_generated/server";
import { v } from "convex/values";
import { nearestPoints } from "../lib/spatial";

/** Get a fleet company by fleetId. Returns null if not found. */
export const getFleet = query({
  args: { fleetId: v.string() },
  handler: async (ctx, { fleetId }) => {
    const fleet = await ctx.db
      .query("fleetCompanies")
      .withIndex("by_fleetId", (q) => q.eq("fleetId", fleetId))
      .first();
    return fleet ?? null;
  },
});

/** List all drivers in a fleet. */
export const listFleetDrivers = query({
  args: { fleetId: v.string() },
  handler: async (ctx, { fleetId }) => {
    return await ctx.db
      .query("fleetDrivers")
      .withIndex("by_fleetId", (q) => q.eq("fleetId", fleetId))
      .collect();
  },
});

/** List all parking lots in a fleet. */
export const listFleetParkingLots = query({
  args: { fleetId: v.string() },
  handler: async (ctx, { fleetId }) => {
    return await ctx.db
      .query("fleetParkingLots")
      .withIndex("by_fleetId", (q) => q.eq("fleetId", fleetId))
      .collect();
  },
});

/** List all routes in a fleet. */
export const listFleetRoutes = query({
  args: { fleetId: v.string() },
  handler: async (ctx, { fleetId }) => {
    return await ctx.db
      .query("fleetRoutes")
      .withIndex("by_fleetId", (q) => q.eq("fleetId", fleetId))
      .collect();
  },
});

/** Get everything for a fleet in one call: company + drivers + lots + routes. */
export const getFleetOverview = query({
  args: { fleetId: v.string() },
  handler: async (ctx, { fleetId }) => {
    const [company, drivers, parkingLots, routes] = await Promise.all([
      ctx.db
        .query("fleetCompanies")
        .withIndex("by_fleetId", (q) => q.eq("fleetId", fleetId))
        .first(),
      ctx.db
        .query("fleetDrivers")
        .withIndex("by_fleetId", (q) => q.eq("fleetId", fleetId))
        .collect(),
      ctx.db
        .query("fleetParkingLots")
        .withIndex("by_fleetId", (q) => q.eq("fleetId", fleetId))
        .collect(),
      ctx.db
        .query("fleetRoutes")
        .withIndex("by_fleetId", (q) => q.eq("fleetId", fleetId))
        .collect(),
    ]);

    return {
      company: company ?? null,
      drivers,
      parkingLots,
      routes,
      summary: {
        driverCount: drivers.length,
        activeDrivers: drivers.filter((d) => d.status === "active").length,
        parkingLotCount: parkingLots.length,
        routeCount: routes.length,
        totalParkingCapacity: parkingLots.reduce(
          (sum, lot) => sum + lot.capacityTrucks,
          0,
        ),
        totalExistingChargers: parkingLots.reduce(
          (sum, lot) => sum + (lot.existingChargers ?? 0),
          0,
        ),
      },
    };
  },
});

/**
 * Get chargers available along a fleet route's waypoints.
 * For each waypoint, finds nearby Class-8-capable chargers within the given
 * radius (default 10km). Reuses the existing spatial nearestPoints layer.
 */
export const getRouteChargers = query({
  args: {
    routeId: v.string(),
    radiusM: v.optional(v.number()),
  },
  handler: async (ctx, { routeId, radiusM }) => {
    const r = radiusM ?? 10_000;
    const route = await ctx.db
      .query("fleetRoutes")
      .withIndex("by_routeId", (q) => q.eq("routeId", routeId))
      .first();
    if (!route) return null;

    const chargersByWaypoint = await Promise.all(
      route.waypoints.map(async (wp, idx) => {
        const hits = await nearestPoints(ctx, {
          table: "chargers",
          point: wp,
          maxDistanceM: r,
          limit: 10,
        });
        return {
          waypointIndex: idx,
          waypoint: wp,
          class8Chargers: hits
            .filter((h) => h.doc.isClass8Capable)
            .map(({ doc, distanceM }) => ({
              stationId: doc.stationId,
              name: doc.name ?? null,
              powerKw: doc.powerKw,
              isClass8Capable: doc.isClass8Capable,
              distanceM,
            })),
          allChargers: hits.map(({ doc, distanceM }) => ({
            stationId: doc.stationId,
            name: doc.name ?? null,
            powerKw: doc.powerKw,
            isClass8Capable: doc.isClass8Capable,
            distanceM,
          })),
        };
      }),
    );

    const allClass8 = chargersByWaypoint.flatMap((w) => w.class8Chargers);
    const uniqueClass8Stations = new Map(allClass8.map((c) => [c.stationId, c]));

    return {
      routeId,
      routeName: route.name,
      waypointCount: route.waypoints.length,
      class8ChargerCount: uniqueClass8Stations.size,
      hasClass8Gap: uniqueClass8Stations.size === 0,
      chargersByWaypoint,
    };
  },
});
