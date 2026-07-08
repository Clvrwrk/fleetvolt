// Truck-config ingest ACTION (P14-TRUCKS) — receives enriched truck config
// rows (read from data/trucks/*.json by scripts/trucks_load.mjs, which passes
// them as args) and upserts them into Convex via batched internalMutations.
//
// WHY AN ACTION (not a mutation): the loader may hand us up to ~10 rows in a
// single call; the action re-chunks to BATCH_SIZE-row internalMutation calls
// (each well under the 1s mutation cap + 5MiB arg limit). The Convex bundler
// rejects node:fs/node:path in convex/ files — so the loader script (outside
// convex/) reads the JSON files and passes the data as args. This mirrors the
// carriers pattern exactly (carriers/ingest.ts + carriers_load.mjs).
//
// Idempotent: upsert keyed by `name` (mutations.upsertTruckBatch, by_name
// index). Re-run patches, never duplicates. One fetchedAt stamped by the FIRST
// call and passed back by the loader so a multi-chunk load shares a single
// fetchedAt.
//
// usefulnessScore = 7/10 — the street data is derived from pilot programs
// (PepsiCo, ABF, NFI), OEM demos (DTNA), and CARB BEDT averages. It is
// real-world but NOT direct measurement of FleetVolt trucks, hence
// source:"ESTIMATE" + method:"estimate". The data has strong provenance
// (multiple independent fleet operators confirming similar efficiency ranges)
// but is still an estimate of what a given truck will achieve on a given route.
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { chunk } from "../lib/csvChunk";

const USEFULNESS_SCORE = 7;
const BATCH_SIZE = 50;

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

export const run = action({
  args: {
    rows: v.array(truckRow),
    fetchedAt: v.optional(v.number()),
  },
  handler: async (ctx, { rows, fetchedAt: fetchedAtArg }) => {
    if (rows.length === 0) {
      throw new Error(
        "trucks/ingest:run received zero rows — refusing to proceed (no " +
          "fabricated trucks). Run trucks_load.mjs first.",
      );
    }
    const fetchedAt = fetchedAtArg ?? Date.now();

    let inserted = 0;
    let patched = 0;
    for (const batch of chunk(rows, BATCH_SIZE)) {
      const res = await ctx.runMutation(
        internal.trucks.mutations.upsertTruckBatch,
        { rows: batch, fetchedAt, usefulnessScore: USEFULNESS_SCORE },
      );
      inserted += res.inserted;
      patched += res.patched;
    }

    const result = {
      received: rows.length,
      inserted,
      patched,
      fetchedAt,
    };
    console.log("trucks/ingest:run", JSON.stringify(result));
    return result;
  },
});
