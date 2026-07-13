// Carrier ingest mutations (P12-09) — batched, idempotent internalMutation that
// upserts POLB carriers by carrierKey AND (when the row is geocoded OK) spatial-
// indexes it via 12-02's insertPoint so carrier-density-within-radius (P12-15a)
// is immediately queryable. Called from carriers/ingest.ts (the action), which
// chunks the geocoded rows.
//
// LOCATION IS OPTIONAL AND HONEST (must_haves): geocoding is imperfect and can be
// deferred (12-05 geocode: no valid Maps key → geocodeStatus FAILED). A row is
// spatial-indexed ONLY when geocodeStatus === "OK" and a finite lat/lng is
// present; unlocated carriers still upsert (name/city/corridorCity/geocodeStatus)
// so they stay queryable by corridorCity but are excluded from spatial results.
//
// Idempotency (T-12-05e): upsert keyed by carrierKey (by_carrierKey index) — a
// re-run patches existing rows, never duplicates. One fetchedAt stamped by the
// action, threaded through every call.
//
// Provenance (P12-02): {source:"POLB_Carriers", fetchedAt, usefulnessScore,
// matchMethod:"geocoded", method:"geocoded"}.
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { insertPoint } from "../lib/spatial";
import { normalizeCorridorCity } from "./corridorCity";

const carrierRow = v.object({
  carrierKey: v.string(),
  name: v.string(),
  address: v.optional(v.union(v.string(), v.null())),
  city: v.optional(v.union(v.string(), v.null())),
  state: v.optional(v.union(v.string(), v.null())),
  zip: v.optional(v.union(v.string(), v.null())),
  lat: v.optional(v.union(v.number(), v.null())),
  lng: v.optional(v.union(v.number(), v.null())),
  geocodeStatus: v.optional(v.union(v.string(), v.null())),
  contactName: v.optional(v.union(v.string(), v.null())),
  phone: v.optional(v.union(v.string(), v.null())),
  email: v.optional(v.union(v.string(), v.null())),
  tractorCount: v.optional(v.union(v.number(), v.null())),
  website: v.optional(v.union(v.string(), v.null())),
});

export const upsertCarrierBatch = internalMutation({
  args: {
    rows: v.array(carrierRow),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  handler: async (ctx, { rows, fetchedAt, usefulnessScore }) => {
    let inserted = 0;
    let patched = 0;
    let located = 0;
    let inCorridor = 0;

    for (const r of rows) {
      const city = r.city ?? undefined;
      const corridorCity = normalizeCorridorCity(city ?? null) ?? undefined;
      if (corridorCity) inCorridor += 1;

      // Only attach a location when the geocode succeeded AND coords are finite.
      const hasLocation =
        r.geocodeStatus === "OK" &&
        typeof r.lat === "number" &&
        typeof r.lng === "number" &&
        Number.isFinite(r.lat) &&
        Number.isFinite(r.lng);
      const location = hasLocation
        ? { lat: r.lat as number, lng: r.lng as number }
        : undefined;
      if (hasLocation) located += 1;

      const doc = {
        carrierKey: r.carrierKey,
        name: r.name,
        address: r.address ?? undefined,
        city,
        state: r.state ?? undefined,
        zip: r.zip ?? undefined,
        location,
        corridorCity,
        geocodeStatus: r.geocodeStatus ?? undefined,
        contactName: r.contactName ?? undefined,
        phone: r.phone ?? undefined,
        email: r.email ?? undefined,
        tractorCount: r.tractorCount ?? undefined,
        website: r.website ?? undefined,
        provenance: {
          source: "POLB_Carriers" as const,
          fetchedAt,
          usefulnessScore,
          matchMethod: "geocoded",
          method: "geocoded" as const,
        },
      };

      // Fully-selective upsert on the by_carrierKey index (reads at most one row).
      const existing = await ctx.db
        .query("carriers")
        .withIndex("by_carrierKey", (q) => q.eq("carrierKey", r.carrierKey))
        .unique();
      const locationChanged =
        !existing?.location ||
        existing.location.lat !== location?.lat ||
        existing.location.lng !== location?.lng;

      let id;
      if (existing) {
        await ctx.db.patch(existing._id, doc);
        id = existing._id;
        patched += 1;
      } else {
        id = await ctx.db.insert("carriers", doc);
        inserted += 1;
      }

      // Spatial-index located carriers (12-02). No-op on the haversine backend.
      // filterFields {corridor} enables an in-index corridor partition filter.
      if (hasLocation && location && locationChanged) {
        await insertPoint(ctx, {
          table: "carriers",
          id,
          location,
          filterFields: { corridor: corridorCity != null },
        });
      }
    }

    return { inserted, patched, located, inCorridor, total: rows.length };
  },
});
