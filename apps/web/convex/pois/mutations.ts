// POI ingest mutations (P12-14) — batched, idempotent internalMutations that
// upsert OSM-extracted POIs by (elementType+osmId) AND spatial-index each row at
// write time (12-02 spatial.insertPoint) so poisInRadius() is immediately
// queryable. Called from pois/ingest.ts (the action), which chunks rows to
// ≤50/call (stays under the 1s mutation cap + 5MiB arg limit AND the geospatial
// component's 4096-reads/mutation re-index limit — same batch discipline as the
// charger point-ingest).
//
// classifyPoi (pois/classify.ts) is the SINGLE precedence spec, mirrored in the
// Python extractor — the mutation re-derives `type` from the raw tags via
// classifyPoi so the stored type can never disagree with the shared spec.
//
// Idempotency: upsert keyed by osmKey = "<elementType>/<osmId>" (by_osmKey
// index) — re-running patches, never duplicates.
//
// Provenance (P12-14): {source:"OSM", fetchedAt, usefulnessScore,
// matchMethod:"osm_extract", method:"extracted", inputs:[matched osm tag]} — the
// POI is EXTRACTED from the pbf, honestly recorded with the matched tag.
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { insertPoint } from "../lib/spatial";
import { classifyPoi, matchedTag } from "./classify";

const poiRow = v.object({
  osmId: v.number(),
  elementType: v.string(),
  type: v.string(), // advisory; re-derived from tags via classifyPoi
  name: v.optional(v.union(v.string(), v.null())),
  lat: v.number(),
  lng: v.number(),
  tags: v.optional(v.any()),
});

export const upsertPoiBatch = internalMutation({
  args: {
    rows: v.array(poiRow),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  handler: async (ctx, { rows, fetchedAt, usefulnessScore }) => {
    let inserted = 0;
    let patched = 0;
    let skippedUnclassified = 0;
    const byType: Record<string, number> = {};

    for (const r of rows) {
      const tags = (r.tags ?? {}) as Record<string, string>;
      // Re-derive type from the shared classifier — the stored type is never
      // trusted from the wire; it must match the single precedence spec.
      const type = classifyPoi(tags);
      if (type === null) {
        skippedUnclassified += 1;
        continue;
      }
      byType[type] = (byType[type] ?? 0) + 1;

      const osmKey = `${r.elementType}/${r.osmId}`;
      const doc = {
        type,
        name: r.name ?? undefined,
        location: { lat: r.lat, lng: r.lng },
        tags,
        osmKey,
        provenance: {
          source: "OSM" as const,
          fetchedAt,
          usefulnessScore,
          matchMethod: "osm_extract",
          method: "extracted" as const,
          inputs: [matchedTag(tags, type)],
        },
      };

      const existing = await ctx.db
        .query("pois")
        .withIndex("by_osmKey", (q) => q.eq("osmKey", osmKey))
        .unique();

      let id;
      if (existing) {
        await ctx.db.patch(existing._id, doc);
        id = existing._id;
        patched += 1;
      } else {
        id = await ctx.db.insert("pois", doc);
        inserted += 1;
      }

      // Spatial-index at write time (12-02). filterFields {type} enables the
      // in-index by-type filter for poisInRadius(types). No-op on haversine.
      await insertPoint(ctx, {
        table: "pois",
        id,
        location: { lat: r.lat, lng: r.lng },
        filterFields: { type },
      });
    }

    return { inserted, patched, skippedUnclassified, byType, total: rows.length };
  },
});
