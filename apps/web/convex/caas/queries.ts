// CaaS (Charging-as-a-Service) queries (P-ROLES).
//
//   • getCaasCompany(caasId)              — single CaaS company
//   • listDeploymentZones(caasId)          — all zones for a company
//   • getZoneReport(zoneId)               — zone metadata + full hotspotReport
//                                            (delegates to report.hotspotReport)
//   • getChargerGapByArea({level,...})     — aggregate charger availability +
//                                            class8 gap across a geographic area
//   • listZonesByPriority(caasId)          — zones sorted high→medium→low
//   • getZoneGeoContext(zoneId)            — {state, county, airDistrict,
//                                            zipCodes nearby} for a zone
import { query } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { nearestPoints } from "../lib/spatial";

/** Get a CaaS company by caasId. Returns null if not found. */
export const getCaasCompany = query({
  args: { caasId: v.string() },
  handler: async (ctx, { caasId }) => {
    const company = await ctx.db
      .query("caasCompanies")
      .withIndex("by_caasId", (q) => q.eq("caasId", caasId))
      .first();
    return company ?? null;
  },
});

/** List all deployment zones for a CaaS company. */
export const listDeploymentZones = query({
  args: { caasId: v.string() },
  handler: async (ctx, { caasId }) => {
    return await ctx.db
      .query("caasDeploymentZones")
      .withIndex("by_caasId", (q) => q.eq("caasId", caasId))
      .collect();
  },
});

/** List zones by priority: high → medium → low → null. */
export const listZonesByPriority = query({
  args: { caasId: v.string() },
  handler: async (ctx, { caasId }) => {
    const zones = await ctx.db
      .query("caasDeploymentZones")
      .withIndex("by_caasId", (q) => q.eq("caasId", caasId))
      .collect();
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return zones.sort((a, b) => {
      const pa = a.priority ? priorityOrder[a.priority] : 3;
      const pb = b.priority ? priorityOrder[b.priority] : 3;
      return pa - pb;
    });
  },
});

/**
 * Get the full zone report: zone metadata + the hotspotReport from report.ts
 * for the zone's centroid. This is the CaaS equivalent of the hotspot drill-down.
 */
export const getZoneReport = query({
  args: { zoneId: v.string() },
  handler: async (ctx, { zoneId }) => {
    const zone = await ctx.db
      .query("caasDeploymentZones")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", zoneId))
      .first();
    if (!zone) return null;

    // Delegate to the existing hotspotReport — reuses all six data layers.
    const report = await ctx.runQuery(api.report.hotspotReport, {
      lat: zone.centroid.lat,
      lng: zone.centroid.lng,
      radiusM: zone.radiusM,
    });

    return {
      zone: {
        zoneId: zone.zoneId,
        caasId: zone.caasId,
        name: zone.name,
        level: zone.level,
        fips: zone.fips ?? null,
        airDistrict: zone.airDistrict ?? null,
        zipCode: zone.zipCode ?? null,
        centroid: zone.centroid,
        radiusM: zone.radiusM,
        modeledDwellScore: zone.modeledDwellScore ?? null,
        freightFlowKtons: zone.freightFlowKtons ?? null,
        carrierCount: zone.carrierCount ?? null,
        parkingCapacity: zone.parkingCapacity ?? null,
        existingChargers: zone.existingChargers ?? null,
        class8ChargerGap: zone.class8ChargerGap ?? null,
        recommendedPowerKw: zone.recommendedPowerKw ?? null,
        priority: zone.priority ?? null,
      },
      report,
    };
  },
});

/**
 * Get geographic context for a zone: {state, county, airDistrict, zipCodes nearby,
 * address candidates}. Reads from geoRegions for state/county/airDistrict, and
 * from nearby parking/carriers for address candidates.
 */
export const getZoneGeoContext = query({
  args: { zoneId: v.string() },
  handler: async (ctx, { zoneId }) => {
    const zone = await ctx.db
      .query("caasDeploymentZones")
      .withIndex("by_zoneId", (q) => q.eq("zoneId", zoneId))
      .first();
    if (!zone) return null;

    // Look up geoRegions that match the zone's fips or airDistrict.
    let state: string | null = null;
    let county: string | null = null;
    let airDistrict: string | null = zone.airDistrict ?? null;

    if (zone.fips) {
      const fipsLen = zone.fips.length;
      if (fipsLen >= 2) {
        const stateFips = zone.fips.substring(0, 2);
        const stateRow = await ctx.db
          .query("geoRegions")
          .withIndex("by_fips", (q) => q.eq("fips", stateFips))
          .first();
        if (stateRow) state = stateRow.name;
      }
      if (fipsLen >= 5) {
        const countyRow = await ctx.db
          .query("geoRegions")
          .withIndex("by_fips", (q) => q.eq("fips", zone.fips!))
          .first();
        if (countyRow) {
          county = countyRow.name;
          if (!airDistrict && countyRow.airDistrict) {
            airDistrict = countyRow.airDistrict;
          }
        }
      }
    }

    // Find nearby zip codes from geoRegions that have zipCodes populated.
    const nearbyZipCodes: string[] = [];
    if (zone.zipCode) nearbyZipCodes.push(zone.zipCode);

    // Get address candidates from nearby carriers (they have street addresses).
    const nearbyCarriers = await nearestPoints(ctx, {
      table: "carriers",
      point: zone.centroid,
      maxDistanceM: zone.radiusM,
      limit: 10,
    });
    const addressCandidates = nearbyCarriers
      .filter((h) => h.doc.address)
      .map(({ doc, distanceM }) => ({
        name: doc.name,
        address: doc.address ?? null,
        city: doc.city ?? null,
        state: doc.state ?? null,
        zip: doc.zip ?? null,
        distanceM,
      }));

    return {
      state,
      county,
      airDistrict,
      zipCodes: nearbyZipCodes,
      addressCandidates,
    };
  },
});

/**
 * Aggregate charger availability + class8 gap across a geographic area.
 * Given a level (state/county/air_district/zip) and a key, returns:
 *   {level, key, totalChargers, class8Chargers, class8Gap, zonesCovered}
 */
export const getChargerGapByArea = query({
  args: {
    level: v.union(
      v.literal("state"),
      v.literal("county"),
      v.literal("air_district"),
      v.literal("zip"),
    ),
    fips: v.optional(v.string()),
    airDistrict: v.optional(v.string()),
    zipCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Gather zones matching the area filter.
    let zones: Array<{
      zoneId: string;
      centroid: { lat: number; lng: number };
      radiusM: number;
      existingChargers?: number;
      class8ChargerGap?: boolean;
    }> = [];

    if (args.level === "air_district" && args.airDistrict) {
      const all = await ctx.db
        .query("caasDeploymentZones")
        .withIndex("by_level", (q) => q.eq("level", "air_district"))
        .collect();
      zones = all.filter((z) => z.airDistrict === args.airDistrict);
    } else if (args.level === "zip" && args.zipCode) {
      const all = await ctx.db
        .query("caasDeploymentZones")
        .withIndex("by_level", (q) => q.eq("level", "zip"))
        .collect();
      zones = all.filter((z) => z.zipCode === args.zipCode);
    } else if (args.fips) {
      zones = await ctx.db
        .query("caasDeploymentZones")
        .withIndex("by_level", (q) => q.eq("level", args.level))
        .filter((f) => f.eq(f.field("fips"), args.fips!))
        .collect();
    }

    // For each zone, count chargers via the spatial layer.
    let totalChargers = 0;
    let class8Chargers = 0;
    const zonesWithGap: string[] = [];

    for (const zone of zones) {
      const chargerHits = await nearestPoints(ctx, {
        table: "chargers",
        point: zone.centroid,
        maxDistanceM: zone.radiusM,
        limit: 50,
      });
      totalChargers += chargerHits.length;
      const c8 = chargerHits.filter((h) => h.doc.isClass8Capable).length;
      class8Chargers += c8;
      if (c8 === 0) zonesWithGap.push(zone.zoneId);
    }

    return {
      level: args.level,
      key:
        args.fips ?? args.airDistrict ?? args.zipCode ?? "unspecified",
      zonesCovered: zones.length,
      totalChargers,
      class8Chargers,
      class8Gap: class8Chargers === 0,
      zonesWithGap,
    };
  },
});
