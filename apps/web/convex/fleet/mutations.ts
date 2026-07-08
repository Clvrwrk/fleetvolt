// Fleet Manager mutations (P-ROLES).
//
//   • createFleet              — upsert by fleetId (insert or patch)
//   • addDriverToFleet          — insert fleetDrivers row (idempotent by fleetId+driverId)
//   • addParkingLot             — insert fleetParkingLots (idempotent by lotId)
//   • createRoute               — insert fleetRoutes (idempotent by routeId)
//   • assignDriverToRoute        — append driverId to route's assignedDriverIds
//   • assignTruckToDriver        — patch fleetDrivers.assignedTruckSlug
//   • assignTruckToRoute         — append truck slug to route's assignedTruckSlugs
//
// No auth yet — any caller with a fleetId can mutate. Phase 10 (WorkOS) will
// gate behind a session check.
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const createFleet = mutation({
  args: {
    fleetId: v.string(),
    name: v.string(),
    dotNumber: v.optional(v.string()),
    address: v.optional(v.string()),
    location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("fleetCompanies")
      .withIndex("by_fleetId", (q) => q.eq("fleetId", args.fleetId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        createdAt: existing.createdAt,
        updatedAt: now,
      });
      return { _id: existing._id, fleetId: args.fleetId, updated: true };
    }

    const _id = await ctx.db.insert("fleetCompanies", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return { _id, fleetId: args.fleetId, updated: false };
  },
});

export const addDriverToFleet = mutation({
  args: {
    fleetId: v.string(),
    driverId: v.string(),
    driverName: v.string(),
    assignedTruckSlug: v.optional(v.string()),
    assignedLotId: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("fleetDrivers")
      .withIndex("by_fleetId", (q) => q.eq("fleetId", args.fleetId))
      .filter((f) => f.eq(f.field("driverId"), args.driverId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        driverName: args.driverName,
        assignedTruckSlug: args.assignedTruckSlug ?? existing.assignedTruckSlug,
        assignedLotId: args.assignedLotId ?? existing.assignedLotId,
        status: args.status ?? existing.status,
      });
      return { _id: existing._id, fleetId: args.fleetId, driverId: args.driverId, updated: true };
    }

    const _id = await ctx.db.insert("fleetDrivers", {
      fleetId: args.fleetId,
      driverId: args.driverId,
      driverName: args.driverName,
      assignedTruckSlug: args.assignedTruckSlug,
      assignedLotId: args.assignedLotId,
      status: args.status ?? "active",
      createdAt: now,
    });
    return { _id, fleetId: args.fleetId, driverId: args.driverId, updated: false };
  },
});

export const addParkingLot = mutation({
  args: {
    lotId: v.string(),
    fleetId: v.string(),
    name: v.string(),
    address: v.optional(v.string()),
    location: v.object({ lat: v.number(), lng: v.number() }),
    amenities: v.array(v.string()),
    capacityTrucks: v.number(),
    existingChargers: v.optional(v.number()),
    chargerKw: v.optional(v.number()),
    powerAvailable: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("fleetParkingLots")
      .withIndex("by_lotId", (q) => q.eq("lotId", args.lotId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, createdAt: existing.createdAt });
      return { _id: existing._id, lotId: args.lotId, updated: true };
    }

    const _id = await ctx.db.insert("fleetParkingLots", { ...args, createdAt: now });
    return { _id, lotId: args.lotId, updated: false };
  },
});

export const createRoute = mutation({
  args: {
    routeId: v.string(),
    fleetId: v.string(),
    name: v.string(),
    originLotId: v.optional(v.string()),
    destLotId: v.optional(v.string()),
    waypoints: v.array(v.object({ lat: v.number(), lng: v.number() })),
    distanceMiles: v.optional(v.number()),
    assignedDriverIds: v.optional(v.array(v.string())),
    assignedTruckSlugs: v.optional(v.array(v.string())),
    schedule: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("fleetRoutes")
      .withIndex("by_routeId", (q) => q.eq("routeId", args.routeId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, createdAt: existing.createdAt });
      return { _id: existing._id, routeId: args.routeId, updated: true };
    }

    const _id = await ctx.db.insert("fleetRoutes", {
      routeId: args.routeId,
      fleetId: args.fleetId,
      name: args.name,
      originLotId: args.originLotId,
      destLotId: args.destLotId,
      waypoints: args.waypoints,
      distanceMiles: args.distanceMiles,
      assignedDriverIds: args.assignedDriverIds ?? [],
      assignedTruckSlugs: args.assignedTruckSlugs ?? [],
      schedule: args.schedule,
      createdAt: now,
    });
    return { _id, routeId: args.routeId, updated: false };
  },
});

export const assignDriverToRoute = mutation({
  args: {
    routeId: v.string(),
    driverId: v.string(),
  },
  handler: async (ctx, args) => {
    const route = await ctx.db
      .query("fleetRoutes")
      .withIndex("by_routeId", (q) => q.eq("routeId", args.routeId))
      .first();
    if (!route) throw new Error(`Route not found: ${args.routeId}`);
    if (!route.assignedDriverIds.includes(args.driverId)) {
      await ctx.db.patch(route._id, {
        assignedDriverIds: [...route.assignedDriverIds, args.driverId],
      });
    }
    return { routeId: args.routeId, driverId: args.driverId, assigned: true };
  },
});

export const assignTruckToDriver = mutation({
  args: {
    fleetId: v.string(),
    driverId: v.string(),
    truckSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const driver = await ctx.db
      .query("fleetDrivers")
      .withIndex("by_fleetId", (q) => q.eq("fleetId", args.fleetId))
      .filter((f) => f.eq(f.field("driverId"), args.driverId))
      .first();
    if (!driver) throw new Error(`Driver not found in fleet: ${args.driverId}`);
    await ctx.db.patch(driver._id, { assignedTruckSlug: args.truckSlug });
    return { fleetId: args.fleetId, driverId: args.driverId, truckSlug: args.truckSlug, assigned: true };
  },
});

export const assignTruckToRoute = mutation({
  args: {
    routeId: v.string(),
    truckSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const route = await ctx.db
      .query("fleetRoutes")
      .withIndex("by_routeId", (q) => q.eq("routeId", args.routeId))
      .first();
    if (!route) throw new Error(`Route not found: ${args.routeId}`);
    if (!route.assignedTruckSlugs.includes(args.truckSlug)) {
      await ctx.db.patch(route._id, {
        assignedTruckSlugs: [...route.assignedTruckSlugs, args.truckSlug],
      });
    }
    return { routeId: args.routeId, truckSlug: args.truckSlug, assigned: true };
  },
});
