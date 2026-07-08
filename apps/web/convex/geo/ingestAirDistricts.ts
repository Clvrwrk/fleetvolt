// Air-district ingest ACTION (P-ROLES) — patches the `airDistrict` field on
// existing geoRegions rows (county level) using the CA air-district → county
// FIPS mapping in data/raw/geo/ca_air_districts.json.
//
// This is an ACTION (not mutation) because it reads a JSON data file and
// delegates to the internalMutation for the actual DB writes. Driven by
// scripts/air_district_load.mjs (or called directly).
//
// PROVENANCE: source "CARB" (California Air Resources Board), method
// "measured" — these are official air-district boundary assignments.
import { v } from "convex/values";
import { action, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

const USEFULNESS_SCORE = 8;

const districtEntry = v.object({
  code: v.string(),
  name: v.string(),
  counties: v.array(
    v.object({
      fips: v.string(),
      county: v.string(),
    }),
  ),
});

/**
 * Internal mutation that patches airDistrict on geoRegions rows matching the
 * given county FIPS codes. For each {fips, airDistrictCode} pair, finds the
 * geoRegions row with that fips and patches its airDistrict field.
 */
export const upsertAirDistrictBatch = internalMutation({
  args: {
    rows: v.array(
      v.object({
        fips: v.string(),
        airDistrict: v.string(),
      }),
    ),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  handler: async (ctx, { rows, fetchedAt, usefulnessScore }) => {
    let patched = 0;
    let notFound = 0;
    for (const r of rows) {
      const existing = await ctx.db
        .query("geoRegions")
        .withIndex("by_fips", (q) => q.eq("fips", r.fips))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          airDistrict: r.airDistrict,
          // Update provenance to reflect the CARB enrichment
          provenance: {
            ...(existing.provenance as Record<string, unknown>),
            source: "CARB" as const,
            fetchedAt,
            usefulnessScore,
            matchMethod: "carb_air_district",
          },
        });
        patched += 1;
      } else {
        notFound += 1;
      }
    }
    return { patched, notFound, total: rows.length };
  },
});

/**
 * ACTION: ingests the CA air-district → county FIPS mapping into geoRegions.
 * Accepts the parsed JSON from ca_air_districts.json and delegates to the
 * internal mutation for batched writes.
 *
 * Note: some counties span multiple air districts (e.g. San Bernardino is split
 * between SCAQMD and MDAQMD). In those cases, the FIRST matching district in
 * the JSON wins (the primary one). This is a known approximation.
 */
export const ingestAirDistricts = action({
  args: {
    districts: v.array(districtEntry),
    fetchedAt: v.optional(v.number()),
  },
  handler: async (ctx, { districts, fetchedAt: fetchedAtArg }) => {
    if (districts.length === 0) {
      throw new Error(
        "geo/ingestAirDistricts: received zero districts — refusing to proceed.",
      );
    }
    const fetchedAt = fetchedAtArg ?? Date.now();

    // Build the flat {fips, airDistrict} list. For counties that appear in
    // multiple districts, only the first occurrence is kept (dedup by fips).
    const fipsToDistrict = new Map<string, string>();
    for (const district of districts) {
      for (const county of district.counties) {
        if (!fipsToDistrict.has(county.fips)) {
          fipsToDistrict.set(county.fips, district.code);
        }
      }
    }

    const rows = Array.from(fipsToDistrict.entries()).map(([fips, airDistrict]) => ({
      fips,
      airDistrict,
    }));

    const BATCH_SIZE = 200;
    let totalPatched = 0;
    let totalNotFound = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const res = await ctx.runMutation(internal.geo.ingestAirDistricts.upsertAirDistrictBatch, {
        rows: batch,
        fetchedAt,
        usefulnessScore: USEFULNESS_SCORE,
      });
      totalPatched += res.patched;
      totalNotFound += res.notFound;
    }

    return {
      received: districts.length,
      fipsMappings: rows.length,
      patched: totalPatched,
      notFound: totalNotFound,
      fetchedAt,
    };
  },
});
