// Modeled-hotspot persistence mutations (P12-11 / P12-12) — the internalMutation
// that writes a computed MODELED dwell/demand score into the hotspots table.
//
// HONESTY (P12-12, T-12-08a): every row written here is kind:"modeledDwell" with
// provenance{source:"ESTIMATE", method:"modeled", inputs:[the four proxies]} and
// carries the score + the per-proxy components (scoreInputs) for audit. A
// modeled score can NEVER be stored as observed dwell — the source is ESTIMATE
// and the method is modeled, enforced by the shared provenance validator.
//
// Idempotency: upsert keyed by a stable location signature (rounded lat/lng) so
// re-running compute for the same candidate grid patches rather than duplicates.
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { HOTSPOT_SCORE_INPUTS } from "./score";

/** Stable-ish key for a candidate location (6 decimal places ~ 0.1 m). */
function locKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export const upsertModeledHotspot = internalMutation({
  args: {
    location: v.object({ lat: v.number(), lng: v.number() }),
    title: v.string(),
    score: v.number(),
    components: v.any(),
    proxies: v.object({
      parkingCapacity: v.number(),
      truckAADT: v.number(),
      fafFlowKtons: v.number(),
      carrierCount: v.number(),
    }),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  handler: async (
    ctx,
    { location, title, score, components, proxies, fetchedAt, usefulnessScore },
  ) => {
    const key = locKey(location.lat, location.lng);

    const dimensions = [
      { label: "Modeled demand score", value: score.toFixed(3) },
      { label: "Parking capacity (NATD spots)", value: String(proxies.parkingCapacity) },
      { label: "5-axle truck AADT (CalTrans)", value: String(proxies.truckAADT) },
      { label: "FAF zone-061 flow (ktons, zonal)", value: proxies.fafFlowKtons.toFixed(0) },
      { label: "Carriers within radius (POLB)", value: String(proxies.carrierCount) },
    ];

    const doc = {
      kind: "modeledDwell" as const,
      location,
      title,
      dimensions,
      score,
      scoreInputs: { components, proxies, locKey: key },
      meta: { locKey: key },
      provenance: {
        source: "ESTIMATE" as const,
        fetchedAt,
        usefulnessScore,
        matchMethod: "modeled",
        method: "modeled" as const,
        inputs: [...HOTSPOT_SCORE_INPUTS],
      },
    };

    // Upsert by the location signature stored in meta.locKey (scan only the
    // small modeledDwell partition via the by_kind index).
    const existing = await ctx.db
      .query("hotspots")
      .withIndex("by_kind", (q) => q.eq("kind", "modeledDwell"))
      .collect();
    const match = existing.find((h) => h.meta?.locKey === key);

    if (match) {
      await ctx.db.patch(match._id, doc);
      return { action: "patched" as const, id: match._id, score };
    }
    const id = await ctx.db.insert("hotspots", doc);
    return { action: "inserted" as const, id, score };
  },
});
