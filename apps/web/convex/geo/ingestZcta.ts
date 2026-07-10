/**
 * CA ZCTA ingest — Census TIGER tl_2022_us_zcta520 (local shapefile prep).
 *
 * Driven by scripts/zcta_load.mjs after:
 *   services/simulator/.venv/bin/python3.14 data/ingest/census/prep_ca_zcta.py
 */
import { v } from "convex/values";
import { action, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

const USEFULNESS_SCORE = 9;

const zctaRow = v.object({
  zcta: v.string(),
  name: v.string(),
  centroid: v.object({ lat: v.number(), lng: v.number() }),
  bbox: v.object({
    minLat: v.number(),
    minLng: v.number(),
    maxLat: v.number(),
    maxLng: v.number(),
  }),
  ring: v.array(v.object({ lat: v.number(), lng: v.number() })),
  countyFips: v.optional(v.string()),
  airDistrict: v.optional(v.string()),
  aggregateScore: v.optional(v.number()),
});

export const upsertZctaBatch = internalMutation({
  args: {
    rows: v.array(zctaRow),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  returns: v.object({
    inserted: v.number(),
    patched: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, { rows, fetchedAt, usefulnessScore }) => {
    let inserted = 0;
    let patched = 0;
    for (const r of rows) {
      if (r.ring.length < 3) continue;
      const doc = {
        zcta: r.zcta,
        name: r.name,
        centroid: r.centroid,
        bbox: r.bbox,
        ring: r.ring,
        ...(r.countyFips ? { countyFips: r.countyFips } : {}),
        ...(r.airDistrict ? { airDistrict: r.airDistrict } : {}),
        ...(typeof r.aggregateScore === "number"
          ? { aggregateScore: r.aggregateScore }
          : {}),
        provenance: {
          source: "Census" as const,
          fetchedAt,
          usefulnessScore,
          matchMethod: "tiger_zcta520_local",
          method: "measured" as const,
          year: 2020,
        },
      };
      const existing = await ctx.db
        .query("geoZcta")
        .withIndex("by_zcta", (q) => q.eq("zcta", r.zcta))
        .unique();
      if (existing) {
        // Preserve score/county/airDistrict if re-ingest omits them.
        await ctx.db.patch(existing._id, {
          ...doc,
          ...(typeof r.aggregateScore !== "number" &&
          typeof existing.aggregateScore === "number"
            ? { aggregateScore: existing.aggregateScore }
            : {}),
          ...(!r.countyFips && existing.countyFips
            ? { countyFips: existing.countyFips }
            : {}),
          ...(!r.airDistrict && existing.airDistrict
            ? { airDistrict: existing.airDistrict }
            : {}),
        });
        patched += 1;
      } else {
        await ctx.db.insert("geoZcta", doc);
        inserted += 1;
      }
    }
    return { inserted, patched, total: rows.length };
  },
});

/** Attach countyFips / airDistrict / aggregateScore from geoRegions counties. */
export const attachZctaCountyContext = internalMutation({
  args: {},
  returns: v.object({
    updated: v.number(),
    total: v.number(),
    countiesUsed: v.number(),
  }),
  handler: async (ctx) => {
    const counties = await ctx.db
      .query("geoRegions")
      .withIndex("by_level", (q) => q.eq("level", "county"))
      .collect();
    const ca = counties.filter((c) => c.fips.startsWith("06") && c.bbox);
    const zctas = await ctx.db.query("geoZcta").collect();
    let updated = 0;
    for (const z of zctas) {
      const containing = ca.filter(
        (c) =>
          c.bbox &&
          z.centroid.lat >= c.bbox.minLat &&
          z.centroid.lat <= c.bbox.maxLat &&
          z.centroid.lng >= c.bbox.minLng &&
          z.centroid.lng <= c.bbox.maxLng,
      );
      let chosen = containing[0];
      if (containing.length > 1) {
        chosen = containing
          .filter((c) => c.centroid)
          .sort((a, b) => {
            const da =
              (a.centroid!.lat - z.centroid.lat) ** 2 +
              (a.centroid!.lng - z.centroid.lng) ** 2;
            const db =
              (b.centroid!.lat - z.centroid.lat) ** 2 +
              (b.centroid!.lng - z.centroid.lng) ** 2;
            return da - db;
          })[0];
      }
      if (!chosen) continue;
      await ctx.db.patch(z._id, {
        countyFips: chosen.fips,
        ...(chosen.airDistrict ? { airDistrict: chosen.airDistrict } : {}),
        ...(typeof chosen.aggregateScore === "number"
          ? { aggregateScore: chosen.aggregateScore }
          : {}),
      });
      updated += 1;
    }
    return { updated, total: zctas.length, countiesUsed: ca.length };
  },
});

/** Remove ZCTAs outside primary CA ZIP range (artifacts from looser bbox ingest). */
export const purgeNonCaliforniaZcta = action({
  args: {},
  returns: v.object({ deleted: v.number(), remaining: v.number() }),
  handler: async (
    ctx,
  ): Promise<{ deleted: number; remaining: number }> => {
    return await ctx.runMutation(internal.geo.ingestZcta.purgeNonCaliforniaZctaMutation, {});
  },
});

export const purgeNonCaliforniaZctaMutation = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number(), remaining: v.number() }),
  handler: async (ctx) => {
    const all = await ctx.db.query("geoZcta").collect();
    let deleted = 0;
    for (const z of all) {
      const n = Number(z.zcta);
      if (!Number.isFinite(n) || n < 90001 || n > 96162) {
        await ctx.db.delete(z._id);
        deleted += 1;
      }
    }
    const remaining = all.length - deleted;
    return { deleted, remaining };
  },
});

export const ingestZcta = action({
  args: {
    rows: v.array(zctaRow),
    fetchedAt: v.optional(v.number()),
  },
  returns: v.object({
    received: v.number(),
    inserted: v.number(),
    patched: v.number(),
    fetchedAt: v.number(),
    countyAttach: v.object({
      updated: v.number(),
      total: v.number(),
      countiesUsed: v.number(),
    }),
  }),
  handler: async (
    ctx,
    { rows, fetchedAt: fetchedAtArg },
  ): Promise<{
    received: number;
    inserted: number;
    patched: number;
    fetchedAt: number;
    countyAttach: { updated: number; total: number; countiesUsed: number };
  }> => {
    if (rows.length === 0) {
      throw new Error(
        "geo/ingestZcta: received zero ZCTAs — run prep_ca_zcta.py first.",
      );
    }
    const fetchedAt = fetchedAtArg ?? Date.now();
    const BATCH = 100;
    let inserted = 0;
    let patched = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const res = await ctx.runMutation(internal.geo.ingestZcta.upsertZctaBatch, {
        rows: batch,
        fetchedAt,
        usefulnessScore: USEFULNESS_SCORE,
      });
      inserted += res.inserted;
      patched += res.patched;
    }
    const countyAttach: {
      updated: number;
      total: number;
      countiesUsed: number;
    } = await ctx.runMutation(
      internal.geo.ingestZcta.attachZctaCountyContext,
      {},
    );
    return {
      received: rows.length,
      inserted,
      patched,
      fetchedAt,
      countyAttach,
    };
  },
});
