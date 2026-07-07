// FAF ingest mutations (P12-03) — batched, idempotent internalMutations that
// write freightOD OD flows + the fafZones/fafModes/fafCommodities lookups.
//
// Called from the faf/ingestActuals action (freightOD) and faf/lookups action
// (lookups), which chunk the prepped JSON to ≤500 rows/call (lib/csvChunk) so
// each mutation stays under the 1s cap + 5MiB arg limit.
//
// Idempotency (mirrors seed/ports.ts): freightOD is upserted by the composite
// key (year, dmsDest, dmsMode, sctg2) — re-running patches, never duplicates.
// Lookups upsert by their id index. One fetchedAt stamped per run (passed in).
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

// FAF freight-out-of-port provenance is a region join (dms_orig=061 → dest).
const MATCH_METHOD = "FAF_region_join";

const freightODRow = v.object({
  year: v.number(),
  dmsOrig: v.string(),
  dmsDest: v.string(),
  dmsMode: v.optional(v.string()),
  sctg2: v.optional(v.string()),
  tonsKtons: v.optional(v.number()), // THOUSAND tons (ktons)
  valueUSD: v.optional(v.number()), // MILLIONS USD
});

export const upsertFreightODBatch = internalMutation({
  args: {
    rows: v.array(freightODRow),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  handler: async (ctx, { rows, fetchedAt, usefulnessScore }) => {
    let inserted = 0;
    let patched = 0;
    for (const r of rows) {
      const provenance = {
        source: "FAF5" as const,
        year: r.year,
        fetchedAt,
        usefulnessScore,
        matchMethod: MATCH_METHOD,
      };
      const doc = {
        year: r.year,
        dmsOrig: r.dmsOrig,
        dmsDest: r.dmsDest,
        dmsMode: r.dmsMode,
        sctg2: r.sctg2,
        tonsKtons: r.tonsKtons,
        valueUSD: r.valueUSD,
        provenance,
      };
      // Match on the composite key via by_orig_year index (dmsOrig,year), then
      // narrow in-handler on dest/mode/sctg2.
      const candidates = await ctx.db
        .query("freightOD")
        .withIndex("by_orig_year", (q) =>
          q.eq("dmsOrig", r.dmsOrig).eq("year", r.year),
        )
        .collect();
      const existing = candidates.find(
        (c) =>
          c.dmsDest === r.dmsDest &&
          c.dmsMode === r.dmsMode &&
          c.sctg2 === r.sctg2,
      );
      if (existing) {
        await ctx.db.patch(existing._id, doc);
        patched += 1;
      } else {
        await ctx.db.insert("freightOD", doc);
        inserted += 1;
      }
    }
    return { inserted, patched, total: rows.length };
  },
});

export const upsertLookups = internalMutation({
  args: {
    zones: v.array(
      v.object({
        zoneId: v.string(),
        name: v.string(),
        state: v.optional(v.union(v.string(), v.null())),
      }),
    ),
    modes: v.array(v.object({ modeId: v.string(), label: v.string() })),
    commodities: v.array(v.object({ sctg2: v.string(), label: v.string() })),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  handler: async (ctx, { zones, modes, commodities, fetchedAt, usefulnessScore }) => {
    const provenance = {
      source: "FAF5" as const,
      fetchedAt,
      usefulnessScore,
      matchMethod: MATCH_METHOD,
    };
    let z = 0;
    let m = 0;
    let c = 0;

    for (const zone of zones) {
      const doc = {
        zoneId: zone.zoneId,
        name: zone.name,
        state: zone.state ?? undefined,
        provenance,
      };
      const existing = await ctx.db
        .query("fafZones")
        .withIndex("by_zoneId", (q) => q.eq("zoneId", zone.zoneId))
        .unique();
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("fafZones", doc);
      z += 1;
    }

    for (const mode of modes) {
      const doc = { modeId: mode.modeId, label: mode.label, provenance };
      const existing = await ctx.db
        .query("fafModes")
        .withIndex("by_modeId", (q) => q.eq("modeId", mode.modeId))
        .unique();
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("fafModes", doc);
      m += 1;
    }

    for (const commodity of commodities) {
      const doc = { sctg2: commodity.sctg2, label: commodity.label, provenance };
      const existing = await ctx.db
        .query("fafCommodities")
        .withIndex("by_sctg2", (q) => q.eq("sctg2", commodity.sctg2))
        .unique();
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("fafCommodities", doc);
      c += 1;
    }

    return { zones: z, modes: m, commodities: c };
  },
});
