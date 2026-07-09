/**
 * trafficGenerators read surface — port popups + map markers.
 */
import { v } from "convex/values";
import { query } from "../_generated/server";
import { haversineMeters } from "../lib/haversine";

const generatorReturn = v.object({
  generatorId: v.string(),
  name: v.string(),
  assoc: v.string(),
  address: v.string(),
  city: v.string(),
  zip: v.string(),
  district: v.string(),
  county: v.string(),
  location: v.object({ lat: v.number(), lng: v.number() }),
  portCode: v.optional(v.string()),
  distanceMiles: v.optional(v.number()),
});

export const getById = query({
  args: { generatorId: v.string() },
  returns: v.union(generatorReturn, v.null()),
  handler: async (ctx, { generatorId }) => {
    const row = await ctx.db
      .query("trafficGenerators")
      .withIndex("by_generatorId", (q) => q.eq("generatorId", generatorId))
      .first();
    if (!row) return null;
    return {
      generatorId: row.generatorId,
      name: row.name,
      assoc: row.assoc,
      address: row.address,
      city: row.city,
      zip: row.zip,
      district: row.district,
      county: row.county,
      location: row.location,
      ...(row.portCode ? { portCode: row.portCode } : {}),
    };
  },
});

export const listByPort = query({
  args: { portCode: v.string() },
  returns: v.array(generatorReturn),
  handler: async (ctx, { portCode }) => {
    const rows = await ctx.db
      .query("trafficGenerators")
      .withIndex("by_portCode", (q) => q.eq("portCode", portCode))
      .collect();
    return rows.map((row) => ({
      generatorId: row.generatorId,
      name: row.name,
      assoc: row.assoc,
      address: row.address,
      city: row.city,
      zip: row.zip,
      district: row.district,
      county: row.county,
      location: row.location,
      portCode: row.portCode,
    }));
  },
});

export const listNearPort = query({
  args: {
    portCode: v.string(),
    radiusMiles: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(generatorReturn),
  handler: async (ctx, { portCode, radiusMiles, limit }) => {
    const port = await ctx.db
      .query("ports")
      .withIndex("by_code", (q) => q.eq("code", portCode))
      .unique();
    if (!port) return [];

    const radiusM = (radiusMiles ?? 25) * 1609.344;
    const max = limit ?? 40;

    // Prefer indexed portCode matches, then expand by distance for nearby untagged.
    const tagged = await ctx.db
      .query("trafficGenerators")
      .withIndex("by_portCode", (q) => q.eq("portCode", portCode))
      .collect();

    const all = await ctx.db.query("trafficGenerators").collect();
    const byId = new Map(tagged.map((r) => [r.generatorId, r]));
    for (const row of all) {
      if (byId.has(row.generatorId)) continue;
      const d = haversineMeters(port.location, row.location);
      if (d <= radiusM) byId.set(row.generatorId, row);
    }

    const ranked = [...byId.values()]
      .map((row) => {
        const distanceM = haversineMeters(port.location, row.location);
        return {
          generatorId: row.generatorId,
          name: row.name,
          assoc: row.assoc,
          address: row.address,
          city: row.city,
          zip: row.zip,
          district: row.district,
          county: row.county,
          location: row.location,
          ...(row.portCode ? { portCode: row.portCode } : {}),
          distanceMiles: Math.round((distanceM / 1609.344) * 10) / 10,
          _d: distanceM,
        };
      })
      .filter((r) => r._d <= radiusM)
      .sort((a, b) => a._d - b._d)
      .slice(0, max)
      .map(({ _d: _drop, ...rest }) => rest);

    return ranked;
  },
});

/** Port detail for map popup: TEU + nearby generators. */
export const portPopup = query({
  args: {
    portCode: v.string(),
    radiusMiles: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      code: v.string(),
      name: v.string(),
      location: v.object({ lat: v.number(), lng: v.number() }),
      annualTEU: v.optional(v.number()),
      provenanceYear: v.optional(v.number()),
      generators: v.array(generatorReturn),
    }),
    v.null(),
  ),
  handler: async (ctx, { portCode, radiusMiles }) => {
    const port = await ctx.db
      .query("ports")
      .withIndex("by_code", (q) => q.eq("code", portCode))
      .unique();
    if (!port) return null;

    const radiusM = (radiusMiles ?? 20) * 1609.344;
    const tagged = await ctx.db
      .query("trafficGenerators")
      .withIndex("by_portCode", (q) => q.eq("portCode", portCode))
      .collect();
    const all = await ctx.db.query("trafficGenerators").collect();
    const byId = new Map(tagged.map((r) => [r.generatorId, r]));
    for (const row of all) {
      if (byId.has(row.generatorId)) continue;
      if (haversineMeters(port.location, row.location) <= radiusM) {
        byId.set(row.generatorId, row);
      }
    }

    const generators = [...byId.values()]
      .map((row) => {
        const distanceM = haversineMeters(port.location, row.location);
        return {
          generatorId: row.generatorId,
          name: row.name,
          assoc: row.assoc,
          address: row.address,
          city: row.city,
          zip: row.zip,
          district: row.district,
          county: row.county,
          location: row.location,
          ...(row.portCode ? { portCode: row.portCode } : {}),
          distanceMiles: Math.round((distanceM / 1609.344) * 10) / 10,
          _d: distanceM,
        };
      })
      .sort((a, b) => a._d - b._d)
      .slice(0, 25)
      .map(({ _d: _drop, ...rest }) => rest);

    return {
      code: port.code,
      name: port.name,
      location: port.location,
      ...(typeof port.annualTEU === "number"
        ? { annualTEU: port.annualTEU }
        : {}),
      ...(typeof port.provenance?.year === "number"
        ? { provenanceYear: port.provenance.year }
        : {}),
      generators,
    };
  },
});
