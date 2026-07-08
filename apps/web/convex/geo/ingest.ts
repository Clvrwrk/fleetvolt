// Geo-region ingest ACTION (P12-13) — receives the geo_regions.json rows (US +
// CA state + all CA counties, from prep_geo_regions.py) and upserts them into the
// geoRegions table via the batched internalMutation. Driven by scripts/geo_load.mjs.
//
// usefulnessScore = 8/10 for the Census FIPS/name dataset: authoritative
// first-party government source (+2), stable keys (FIPS) (+2), full CA county
// coverage (+1), current ACS5 2022 vintage (+1), measured not modeled (+2);
// docked 2 because county geometry (centroid/bbox) is only attached for the three
// corridor counties here (the rest can be TIGER-enriched later).
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";

const USEFULNESS_SCORE = 8;
const BATCH_SIZE = 200;

const regionRow = v.object({
  level: v.union(v.literal("nation"), v.literal("state"), v.literal("county")),
  fips: v.string(),
  name: v.string(),
  parentFips: v.optional(v.union(v.string(), v.null())),
  centroid: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  bbox: v.optional(
    v.object({
      minLat: v.number(),
      minLng: v.number(),
      maxLat: v.number(),
      maxLng: v.number(),
    }),
  ),
});

export const run = action({
  args: {
    rows: v.array(regionRow),
    fetchedAt: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { rows, fetchedAt: fetchedAtArg },
  ): Promise<{ received: number; inserted: number; patched: number; fetchedAt: number }> => {
    if (rows.length === 0) {
      throw new Error(
        "geo/ingest:run received zero regions — refusing to proceed (no " +
          "fabricated geo regions). Run prep_geo_regions.py first.",
      );
    }
    const fetchedAt = fetchedAtArg ?? Date.now();
    let inserted = 0;
    let patched = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const res = await ctx.runMutation(internal.geo.mutations.upsertGeoRegionBatch, {
        rows: batch,
        fetchedAt,
        usefulnessScore: USEFULNESS_SCORE,
      });
      inserted += res.inserted;
      patched += res.patched;
    }
    const result = { received: rows.length, inserted, patched, fetchedAt };
    console.log("geo/ingest:run", JSON.stringify(result));
    return result;
  },
});
