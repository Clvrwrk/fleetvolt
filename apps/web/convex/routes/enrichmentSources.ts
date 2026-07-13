import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { internalQuery } from "../_generated/server";
import { isClass8Capable } from "../chargers/classify";
import { distanceToPolylineM, type LatLng } from "../lib/haversine";
import { segmentsInBbox } from "../lib/spatial";
import {
  MAX_ROUTE_PROBES,
  ROUTE_HIGHWAY_RADIUS_M,
  ROUTE_POINT_RADIUS_M,
  aadtStatistics,
  coverage,
  expandedRouteBbox,
  polylineDistanceM,
  sampleRoute,
} from "./enrichmentPolicy";

const FAF_ORIGIN = "061";
const FAF_YEAR = 2023;
const TRUCK_MODE = "1";
const MAX_DETAIL_ROWS = 60;
const DISTANCE_ROAD_POINTS = 128;
const SOURCE_READ_CAPS = {
  chargers: 8_000,
  parking: 8_000,
  pois: 12_000,
  carriers: 8_000,
  fleetYards: 8_000,
} as const;

const args = { requestHash: v.string(), now: v.number() };

async function loadRoute(ctx: QueryCtx, requestHash: string) {
  const route = await ctx.db
    .query("routeGeometries")
    .withIndex("by_requestHash", (q) => q.eq("requestHash", requestHash))
    .unique();
  if (!route || route.coordinates.length < 8) {
    throw new Error("No usable persisted road geometry exists for this request hash");
  }
  const fullRoad: LatLng[] = route.coordinates.map((point) => ({
    lat: point.latitude,
    lng: point.longitude,
  }));
  return {
    route,
    fullRoad,
    distanceRoad: sampleRoute(fullRoad, DISTANCE_ROAD_POINTS),
  };
}

function fetchedAt(rows: Array<{ provenance?: { fetchedAt?: number } }>): number | null {
  const values = rows
    .map((row) => row.provenance?.fetchedAt)
    .filter((value): value is number => typeof value === "number");
  return values.length > 0 ? Math.max(...values) : null;
}

function topEntries(values: Map<string, number>, limit = 5) {
  return [...values.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, amount]) => ({ key, ktons: amount }));
}

export const routeContext = internalQuery({
  args,
  handler: async (ctx, input) => {
    const { route, fullRoad } = await loadRoute(ctx, input.requestHash);
    return {
      route: {
        provider: route.provider,
        pointCount: fullRoad.length,
        geometryPulledAt: route.pulledAt,
        geometryExpiresAt: route.expiresAt,
        distanceMeters: route.distanceMeters ?? null,
        durationSeconds: route.durationSeconds ?? null,
      },
      corridor: {
        sampleCount: sampleRoute(fullRoad, MAX_ROUTE_PROBES).length,
        distanceRoadPointCount: sampleRoute(fullRoad, DISTANCE_ROAD_POINTS).length,
        pointAssetRadiusM: ROUTE_POINT_RADIUS_M,
        highwayRadiusM: ROUTE_HIGHWAY_RADIUS_M,
        highwayBbox: expandedRouteBbox(fullRoad, ROUTE_HIGHWAY_RADIUS_M),
      },
    };
  },
});

export const trafficAlongRoute = internalQuery({
  args,
  handler: async (ctx, input) => {
    const { fullRoad, distanceRoad } = await loadRoute(ctx, input.requestHash);
    const highwayCandidates = await segmentsInBbox(ctx, {
      table: "highwaySegments",
      bbox: expandedRouteBbox(fullRoad, ROUTE_HIGHWAY_RADIUS_M),
    });
    const matches = highwayCandidates
      .map((doc) => ({ doc, distanceM: polylineDistanceM(distanceRoad, doc.path) }))
      .filter((row) => row.distanceM <= ROUTE_HIGHWAY_RADIUS_M)
      .sort((a, b) => a.distanceM - b.distanceM);
    return {
      coverage: coverage(highwayCandidates.length > 0, matches.length, "Caltrans_5axle_truckAADT", "road_polyline_within_2km", {
        sourceFetchedAt: fetchedAt(matches.map((row) => row.doc)) ?? fetchedAt(highwayCandidates),
        unit: "trucks/day",
      }),
      statistics: aadtStatistics(matches.map((row) => row.doc.truckAADT)),
      routes: [...new Set(matches.map((row) => row.doc.route))],
      segments: matches.slice(0, MAX_DETAIL_ROWS).map(({ doc, distanceM }) => ({
        segmentId: doc.segmentId,
        route: doc.route,
        truckAADT: doc.truckAADT ?? null,
        totalAADT: doc.aadt ?? null,
        distanceToRouteM: Math.round(distanceM),
      })),
    };
  },
});

export const freightContext = internalQuery({
  args,
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("freightOD")
      .withIndex("by_orig_year", (q) =>
        q.eq("dmsOrig", FAF_ORIGIN).eq("year", FAF_YEAR),
      )
      .collect();
    let totalKtons = 0;
    let totalValueUSD = 0;
    let truckKtons = 0;
    let truckValueUSD = 0;
    const byDestination = new Map<string, number>();
    const byCommodity = new Map<string, number>();
    for (const row of rows) {
      const tons = row.tonsKtons ?? 0;
      const value = row.valueUSD ?? 0;
      totalKtons += tons;
      totalValueUSD += value;
      if (row.dmsMode === TRUCK_MODE) {
        truckKtons += tons;
        truckValueUSD += value;
      }
      byDestination.set(row.dmsDest, (byDestination.get(row.dmsDest) ?? 0) + tons);
      if (row.sctg2) byCommodity.set(row.sctg2, (byCommodity.get(row.sctg2) ?? 0) + tons);
    }
    return {
      coverage: coverage(rows.length > 0, rows.length, "FAF5", "regional_origin_zone_context", {
        sourceFetchedAt: fetchedAt(rows),
        scope: `FAF origin zone ${FAF_ORIGIN}; annual context, not segment traffic`,
        units: { tonsKtons: "thousand tons/year", valueUSD: "million USD/year" },
        truncated: false,
      }),
      originZone: FAF_ORIGIN,
      year: FAF_YEAR,
      totalKtons,
      totalValueUSD,
      truckKtons,
      truckValueUSD,
      topDestinations: topEntries(byDestination),
      topCommodities: topEntries(byCommodity),
    };
  },
});

export const chargersAlongRoute = internalQuery({
  args,
  handler: async (ctx, input) => {
    const { distanceRoad } = await loadRoute(ctx, input.requestHash);
    const read = await ctx.db.query("chargers").take(SOURCE_READ_CAPS.chargers + 1);
    const truncated = read.length > SOURCE_READ_CAPS.chargers;
    const rows = read.slice(0, SOURCE_READ_CAPS.chargers);
    const matches = rows
      .map((doc) => ({ doc, distanceM: distanceToPolylineM(doc.location, distanceRoad) }))
      .filter((row) => row.distanceM <= ROUTE_POINT_RADIUS_M)
      .sort((a, b) => a.distanceM - b.distanceM);
    const class8 = matches.filter(
      ({ doc }) => doc.isClass8Capable && isClass8Capable(doc.powerKw, doc.maxVehicleClass),
    );
    return {
      coverage: coverage(rows.length > 0, matches.length, "AFDC", "road_proximity_within_8km", {
        sourceFetchedAt: fetchedAt(matches.map((row) => row.doc)) ?? fetchedAt(rows),
        truncated,
      }),
      class8WithinCorridor: rows.length === 0 ? null : class8.length,
      class8Gap: rows.length === 0 ? null : class8.length === 0,
      closestClass8DistanceM: class8[0]?.distanceM ?? null,
      items: matches.slice(0, MAX_DETAIL_ROWS).map(({ doc, distanceM }) => ({
        stationId: doc.stationId,
        name: doc.name ?? null,
        location: doc.location,
        distanceToRouteM: Math.round(distanceM),
        powerKw: doc.powerKw,
        isClass8Capable: doc.isClass8Capable,
        maxVehicleClass: doc.maxVehicleClass ?? null,
        connectorTypes: doc.connectorTypes,
      })),
    };
  },
});

export const parkingAlongRoute = internalQuery({
  args,
  handler: async (ctx, input) => {
    const { distanceRoad } = await loadRoute(ctx, input.requestHash);
    const read = await ctx.db.query("parking").take(SOURCE_READ_CAPS.parking + 1);
    const truncated = read.length > SOURCE_READ_CAPS.parking;
    const rows = read.slice(0, SOURCE_READ_CAPS.parking);
    const matches = rows
      .map((doc) => ({ doc, distanceM: distanceToPolylineM(doc.location, distanceRoad) }))
      .filter((row) => row.distanceM <= ROUTE_POINT_RADIUS_M)
      .sort((a, b) => a.distanceM - b.distanceM);
    return {
      coverage: coverage(rows.length > 0, matches.length, "NATD", "road_proximity_within_8km", {
        sourceFetchedAt: fetchedAt(matches.map((row) => row.doc)) ?? fetchedAt(rows),
        truncated,
      }),
      totalSpots: matches.reduce((sum, row) => sum + (row.doc.numberOfSpots ?? 0), 0),
      items: matches.slice(0, MAX_DETAIL_ROWS).map(({ doc, distanceM }) => ({
        parkingKey: doc.parkingKey ?? String(doc._id),
        name: doc.name ?? null,
        location: doc.location,
        distanceToRouteM: Math.round(distanceM),
        numberOfSpots: doc.numberOfSpots ?? null,
        hgv: doc.hgv ?? null,
      })),
    };
  },
});

export const amenitiesAlongRoute = internalQuery({
  args,
  handler: async (ctx, input) => {
    const { distanceRoad } = await loadRoute(ctx, input.requestHash);
    const read = await ctx.db.query("pois").take(SOURCE_READ_CAPS.pois + 1);
    const truncated = read.length > SOURCE_READ_CAPS.pois;
    const rows = read.slice(0, SOURCE_READ_CAPS.pois);
    const matches = rows
      .map((doc) => ({ doc, distanceM: distanceToPolylineM(doc.location, distanceRoad) }))
      .filter((row) => row.distanceM <= ROUTE_POINT_RADIUS_M)
      .sort((a, b) => a.distanceM - b.distanceM);
    const countsByType = matches.reduce<Record<string, number>>((counts, row) => {
      counts[row.doc.type] = (counts[row.doc.type] ?? 0) + 1;
      return counts;
    }, {});
    return {
      coverage: coverage(rows.length > 0, matches.length, "OpenStreetMap", "road_proximity_within_8km", {
        sourceFetchedAt: fetchedAt(matches.map((row) => row.doc)) ?? fetchedAt(rows),
        truncated,
      }),
      countsByType,
      items: matches.slice(0, MAX_DETAIL_ROWS).map(({ doc, distanceM }) => ({
        osmKey: doc.osmKey ?? String(doc._id),
        type: doc.type,
        name: doc.name ?? null,
        location: doc.location,
        distanceToRouteM: Math.round(distanceM),
      })),
    };
  },
});

export const carriersAlongRoute = internalQuery({
  args,
  handler: async (ctx, input) => {
    const { distanceRoad } = await loadRoute(ctx, input.requestHash);
    const read = await ctx.db.query("carriers").take(SOURCE_READ_CAPS.carriers + 1);
    const truncated = read.length > SOURCE_READ_CAPS.carriers;
    const rows = read.slice(0, SOURCE_READ_CAPS.carriers);
    const matches = rows
      .filter((doc) => doc.location !== undefined)
      .map((doc) => ({ doc, distanceM: distanceToPolylineM(doc.location!, distanceRoad) }))
      .filter((row) => row.distanceM <= ROUTE_POINT_RADIUS_M)
      .sort((a, b) => a.distanceM - b.distanceM);
    return {
      coverage: coverage(rows.length > 0, matches.length, "POLB_carrier_registry", "road_proximity_within_8km", {
        sourceFetchedAt: fetchedAt(matches.map((row) => row.doc)) ?? fetchedAt(rows),
        scope: "geocoded carriers only",
        truncated,
      }),
      items: matches.slice(0, MAX_DETAIL_ROWS).map(({ doc, distanceM }) => ({
        carrierKey: doc.carrierKey ?? String(doc._id),
        name: doc.name,
        location: doc.location ?? null,
        distanceToRouteM: Math.round(distanceM),
        city: doc.city ?? null,
        corridorCity: doc.corridorCity ?? null,
      })),
    };
  },
});

export const fleetYardsAlongRoute = internalQuery({
  args,
  handler: async (ctx, input) => {
    const { distanceRoad } = await loadRoute(ctx, input.requestHash);
    const read = await ctx.db
      .query("fleetParkingLots")
      .take(SOURCE_READ_CAPS.fleetYards + 1);
    const truncated = read.length > SOURCE_READ_CAPS.fleetYards;
    const rows = read.slice(0, SOURCE_READ_CAPS.fleetYards);
    const matches = rows
      .map((doc) => ({ doc, distanceM: distanceToPolylineM(doc.location, distanceRoad) }))
      .filter((row) => row.distanceM <= ROUTE_POINT_RADIUS_M)
      .sort((a, b) => a.distanceM - b.distanceM);
    return {
      coverage: coverage(rows.length > 0, matches.length, "FleetVolt_fleetParkingLots", "road_proximity_within_8km", { truncated }),
      items: matches.slice(0, MAX_DETAIL_ROWS).map(({ doc, distanceM }) => ({
        lotId: doc.lotId,
        fleetId: doc.fleetId,
        name: doc.name,
        location: doc.location,
        distanceToRouteM: Math.round(distanceM),
        capacityTrucks: doc.capacityTrucks,
        amenities: doc.amenities,
        existingChargers: doc.existingChargers ?? null,
      })),
    };
  },
});
