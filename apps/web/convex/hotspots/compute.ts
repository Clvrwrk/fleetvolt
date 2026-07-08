// Compute + persist MODELED hotspot scores from the ingested proxies (P12-11 /
// P12-12). This is the PRECOMPUTE step (T-12-08b): it gathers the four proxies
// for each candidate corridor location via radius-bounded spatial lookups, runs
// the pure computeHotspotScore, and upserts the result into the hotspots table
// so the P12-15 report query just READS the persisted score (staying under the
// 1s query cap) rather than re-aggregating proxies on every request.
//
// WHY AN ACTION: it fans out to several queries per candidate point (parking,
// congestion, carriers, freight) and can run long over a grid; the report query
// must stay cheap, so the heavy aggregation lives here, offline.
//
// HONESTY (P12-12): the persisted score is kind:"modeledDwell", provenance
// source:"ESTIMATE" / method:"modeled" / inputs[four proxies]. FAF is ZONAL
// (corridor-wide constant) — it scales the corridor's freight magnitude but does
// not discriminate between candidate points (documented in score.ts).
import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { computeHotspotScore, type HotspotScoreWeights } from "./score";

// usefulnessScore for a MODELED estimate: proxies are authoritative first-party
// feeds (NATD/CalTrans/FAF/POLB) but the composite is a model, not a measurement
// — capped at 6/10 (docked for: no dwell ground truth to calibrate against; the
// FAF term is zonal not spatial).
const USEFULNESS_SCORE = 6;

// FAF year for the zonal freight-magnitude term (latest actual vintage present).
const FAF_YEAR = 2023;

interface ProxyBundle {
  parkingCapacity: number;
  truckAADT: number;
  fafFlowKtons: number;
  carrierCount: number;
}

/** Small bbox (± ~radiusM) around a point for corridorCongestion. */
function bboxAround(lat: number, lng: number, radiusM: number) {
  const dLat = radiusM / 111_320;
  const dLng =
    radiusM / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6));
  return {
    minLat: lat - dLat,
    minLng: lng - dLng,
    maxLat: lat + dLat,
    maxLng: lng + dLng,
  };
}

export const computeCorridorHotspots = action({
  args: {
    candidatePoints: v.array(
      v.object({ lat: v.number(), lng: v.number(), title: v.optional(v.string()) }),
    ),
    radiusM: v.number(),
    weights: v.optional(
      v.object({
        parking: v.number(),
        truck: v.number(),
        faf: v.number(),
        carrier: v.number(),
      }),
    ),
  },
  handler: async (ctx, { candidatePoints, radiusM, weights }): Promise<{
    computed: number;
    fafFlowKtons: number;
    topScore: number;
    top: Array<{ title: string; score: number; proxies: ProxyBundle }>;
  }> => {
    if (candidatePoints.length === 0) {
      throw new Error(
        "computeCorridorHotspots received zero candidate points — refusing to " +
          "proceed (no fabricated hotspots).",
      );
    }
    const fetchedAt = Date.now();

    // FAF zone-061 outbound magnitude — ZONAL, corridor-wide constant (one read).
    const freight = (await ctx.runQuery(api.faf.queries.freightContext, {
      year: FAF_YEAR,
    })) as { truckKtons?: number };
    const fafFlowKtons: number = freight.truckKtons ?? 0;

    const results: Array<{
      title: string;
      lat: number;
      lng: number;
      score: number;
      proxies: ProxyBundle;
    }> = [];

    for (let i = 0; i < candidatePoints.length; i++) {
      const pt = candidatePoints[i];
      const title = pt.title ?? `Modeled hotspot @ ${pt.lat.toFixed(3)},${pt.lng.toFixed(3)}`;

      // Proxy 1: NATD parking capacity within radius (spatial).
      const parking = (await ctx.runQuery(api.pois.queries.parkingInRadius, {
        lat: pt.lat,
        lng: pt.lng,
        radiusM,
      })) as { totalSpotsWithinRadius?: number };
      const parkingCapacity = parking.totalSpotsWithinRadius ?? 0;

      // Proxy 2: max 5-axle truck AADT on nearby segments (spatial).
      const congestion = (await ctx.runQuery(
        api.highways.queries.corridorCongestion,
        bboxAround(pt.lat, pt.lng, radiusM),
      )) as { segments: Array<{ truckAADT: number | null }> };
      const truckAADT = congestion.segments.reduce(
        (mx: number, s: { truckAADT: number | null }) =>
          Math.max(mx, s.truckAADT ?? 0),
        0,
      );

      // Proxy 4: geocoded carriers within radius (spatial).
      const carriers = (await ctx.runQuery(
        api.carriers.queries.carriersInRadius,
        { lat: pt.lat, lng: pt.lng, radiusM, limit: 500 },
      )) as unknown[];
      const carrierCount = carriers.length;

      const proxies = { parkingCapacity, truckAADT, fafFlowKtons, carrierCount };
      const scored = computeHotspotScore(
        proxies,
        weights as HotspotScoreWeights | undefined,
      );

      await ctx.runMutation(internal.hotspots.mutations.upsertModeledHotspot, {
        location: { lat: pt.lat, lng: pt.lng },
        title,
        score: scored.score,
        components: scored.components,
        proxies,
        fetchedAt,
        usefulnessScore: USEFULNESS_SCORE,
      });

      results.push({ title, lat: pt.lat, lng: pt.lng, score: scored.score, proxies });
    }

    results.sort((a, b) => b.score - a.score);
    const summary: {
      computed: number;
      fafFlowKtons: number;
      topScore: number;
      top: Array<{ title: string; score: number; proxies: ProxyBundle }>;
    } = {
      computed: results.length,
      fafFlowKtons,
      topScore: results[0]?.score ?? 0,
      top: results.slice(0, 5).map((r) => ({
        title: r.title,
        score: Number(r.score.toFixed(3)),
        proxies: r.proxies,
      })),
    };
    console.log("hotspots/compute:computeCorridorHotspots", JSON.stringify(summary));
    return summary;
  },
});
