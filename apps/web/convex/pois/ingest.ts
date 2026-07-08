// POI ingest ACTION (P12-14) — receives prepped OSM-extracted POI rows (read
// from data/ingest/osm/out/osm_pois.json by scripts/pois_load.mjs, chunked
// ≤5MiB per `npx convex run`) and upserts them into Convex `pois` via batched
// internalMutations that spatial-index every row (12-02). The rows come from a
// streaming pyosmium pass over california-latest.osm.pbf, corridor-bbox-bounded.
//
// Idempotent: upsert keyed by osmKey ("<elementType>/<osmId>"). One fetchedAt
// stamped by the first call and threaded back by the loader.
//
// usefulnessScore = the data-review-gate rubric OUTPUT on the OSM bytes
// (DINT-03), rationale in 12-07-SUMMARY.md:
//   identity/keys (osm element type+id -> stable osmKey)        +2
//   precise geography (node lat/lon; way centroid)              +1
//   free public crowd-sourced source (OSM/Geofabrik)            +1
//   tag-driven type + provenance (method:"extracted", inputs)   +1
//   coverage (all P12-14 truck-relevant amenities in corridor)  +1
//   = 6/10  (docked 4: crowd-sourced completeness varies by area,
//            hgv-tagging on parking is sparse, no freshness stamp,
//            way centroid approximates polygon location)
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { chunk } from "../lib/csvChunk";

const USEFULNESS_SCORE = 6;
const BATCH_SIZE = 50;

const poiRow = v.object({
  osmId: v.number(),
  elementType: v.string(),
  type: v.string(),
  name: v.optional(v.union(v.string(), v.null())),
  lat: v.number(),
  lng: v.number(),
  tags: v.optional(v.any()),
});

export const run = action({
  args: {
    rows: v.array(poiRow),
    fetchedAt: v.optional(v.number()),
  },
  handler: async (ctx, { rows, fetchedAt: fetchedAtArg }) => {
    if (rows.length === 0) {
      throw new Error(
        "pois/ingest:run received zero rows — refusing to proceed (no " +
          "fabricated POIs). Run data/ingest/osm/extract_pois.py first.",
      );
    }
    const fetchedAt = fetchedAtArg ?? Date.now();

    let inserted = 0;
    let patched = 0;
    let skippedUnclassified = 0;
    const byType: Record<string, number> = {};
    for (const batch of chunk(rows, BATCH_SIZE)) {
      const res = await ctx.runMutation(internal.pois.mutations.upsertPoiBatch, {
        rows: batch,
        fetchedAt,
        usefulnessScore: USEFULNESS_SCORE,
      });
      inserted += res.inserted;
      patched += res.patched;
      skippedUnclassified += res.skippedUnclassified;
      for (const [k, n] of Object.entries(res.byType)) {
        byType[k] = (byType[k] ?? 0) + (n as number);
      }
    }

    const result = {
      received: rows.length,
      inserted,
      patched,
      skippedUnclassified,
      byType,
      fetchedAt,
    };
    console.log("pois/ingest:run", JSON.stringify(result));
    return result;
  },
});
