// Truck-config ingest mutations (P14-TRUCKS) — batched, idempotent
// internalMutation that upserts enriched truck configs by name (by_name index).
//
// Mirrors the established carriers/chargers pattern. The truck JSON files in
// data/trucks/ carry BOTH the existing physics fields (nameplate_kwh,
// usable_kwh, drag_coefficient, etc.) AND the new street metadata fields
// (vehicleClass, streetEfficiencyKwhPerMi, batteryHealthGuidance, etc.).
//
// Idempotency: upsert keyed by `name` (by_name index) — a re-run patches
// existing rows, never duplicates. One fetchedAt is stamped by the action and
// threaded through every call.
//
// Provenance (P14-TRUCKS): {source:"ESTIMATE", fetchedAt, usefulnessScore,
// matchMethod:"street_enriched", method:"estimate"} — street data is derived
// from pilot programs, OEM demos, and CARB BEDT averages, NOT from direct
// measurement of FleetVolt trucks. The `method:"estimate"` label is honest.
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const truckRow = v.object({
  name: v.string(),
  oemModel: v.optional(v.string()),
  isPreset: v.boolean(),
  batteryUsableKwh: v.optional(v.number()),
  curbWeightLbs: v.optional(v.number()),
  cdA: v.optional(v.number()),
  rollingResistanceCoeff: v.optional(v.number()),
  regenEfficiency: v.optional(v.number()),
  auxKwBase: v.optional(v.number()),
  maxChargeRateKw: v.optional(v.number()),
  params: v.optional(v.any()),
  // Street metadata fields (all optional, additive)
  vehicleClass: v.optional(
    v.union(v.literal(6), v.literal(7), v.literal(8)),
  ),
  axleConfig: v.optional(v.string()),
  batteryNameplateKwh: v.optional(v.number()),
  batteryChemistry: v.optional(v.string()),
  streetEfficiencyKwhPerMi: v.optional(
    v.object({
      min: v.number(),
      max: v.number(),
      typical: v.number(),
    }),
  ),
  ratedRangeMiles: v.optional(
    v.object({ typical: v.number(), max: v.number() }),
  ),
  recommendedMilesPerCharge: v.optional(
    v.object({ healthMin: v.number(), healthMax: v.number() }),
  ),
  batteryHealthGuidance: v.optional(
    v.object({
      dailyChargeTargetPct: v.number(),
      operatingWindowMinPct: v.number(),
      operatingWindowMaxPct: v.number(),
      dodMaxPct: v.number(),
      notes: v.string(),
    }),
  ),
  streetDataSources: v.optional(v.array(v.string())),
  streetDataConfidence: v.optional(
    v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
  ),
});

export const upsertTruckBatch = internalMutation({
  args: {
    rows: v.array(truckRow),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  handler: async (ctx, { rows, fetchedAt, usefulnessScore }) => {
    let inserted = 0;
    let patched = 0;

    for (const r of rows) {
      const doc = {
        name: r.name,
        oemModel: r.oemModel ?? undefined,
        isPreset: r.isPreset,
        batteryUsableKwh: r.batteryUsableKwh ?? undefined,
        curbWeightLbs: r.curbWeightLbs ?? undefined,
        cdA: r.cdA ?? undefined,
        rollingResistanceCoeff: r.rollingResistanceCoeff ?? undefined,
        regenEfficiency: r.regenEfficiency ?? undefined,
        auxKwBase: r.auxKwBase ?? undefined,
        maxChargeRateKw: r.maxChargeRateKw ?? undefined,
        params: r.params ?? undefined,
        // Street metadata
        vehicleClass: r.vehicleClass ?? undefined,
        axleConfig: r.axleConfig ?? undefined,
        batteryNameplateKwh: r.batteryNameplateKwh ?? undefined,
        batteryChemistry: r.batteryChemistry ?? undefined,
        streetEfficiencyKwhPerMi: r.streetEfficiencyKwhPerMi ?? undefined,
        ratedRangeMiles: r.ratedRangeMiles ?? undefined,
        recommendedMilesPerCharge: r.recommendedMilesPerCharge ?? undefined,
        batteryHealthGuidance: r.batteryHealthGuidance ?? undefined,
        streetDataSources: r.streetDataSources ?? undefined,
        streetDataConfidence: r.streetDataConfidence ?? undefined,
        provenance: {
          source: "ESTIMATE" as const,
          fetchedAt,
          usefulnessScore,
          matchMethod: "street_enriched",
          method: "estimate" as const,
        },
      };

      // Fully-selective upsert on the by_name index (reads at most one row).
      const existing = await ctx.db
        .query("truckConfigs")
        .withIndex("by_name", (q) => q.eq("name", r.name))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, doc);
        patched += 1;
      } else {
        await ctx.db.insert("truckConfigs", doc);
        inserted += 1;
      }
    }

    return { inserted, patched, total: rows.length };
  },
});
