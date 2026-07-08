// THE REPORT QUERY (P12-15) — the single most important artifact of Phase 12.
//
// hotspotReport({lat,lng,radiusM, hotspotId?}) is ONE Convex query that fuses all
// six live data layers into the structured payload that grounds BOTH the flagship
// query (flagship.test.ts) AND the Phase-15 LLM sales brief. Built once, here,
// honestly.
//
// THE SIX SECTIONS (each from a live layer):
//   carriers        — carriersInRadius (12-05, spatial)                  P12-15a
//   parking         — parkingInRadius + totalSpots (12-07, spatial)      P12-15b
//   pois            — poisInRadius grouped by type (12-07, spatial)      P12-15c
//   chargers        — fiveClosest + class8Gap (12-04, spatial)          P12-15d
//   score           — the MODELED hotspot score + components + inputs    P12-15e
//                     (read from the nearest persisted modeledDwell hotspot;
//                      falls back to an inline computeHotspotScore from the
//                      gathered proxies when no persisted hotspot is near)
//   freightContext  — FAF zone-061 outbound totals (12-03, zonal)        P12-15f
// plus the DERIVED gap analysis:
//   whatsMissing    — {mobileEnergyOpportunity, ...} — high modeled demand AND
//                     zero in-radius Class-8 charging = the siting/mobile-energy
//                     opportunity; plus zero-coverage flags + the Phase-13
//                     deferral markers (detour cost + CO2 are NOT computed here).
//
// 1s QUERY CAP (T-12-08b): every lookup is radius-bounded (nearestPoints /
// class8Gap over a small probe set), and the modeled score is READ from the
// precomputed hotspots table (hotspots/compute did the heavy proxy aggregation
// offline) — the query never re-aggregates the whole corridor. The FAF read hits
// the (061, year) index partition only.
//
// HONESTY (P12-12): score.method is ALWAYS "modeled" and score.inputs lists the
// four proxies — report.test.ts asserts this. whatsMissing NEVER fabricates a
// detour cost or CO2 number: those are flagged as Phase-13/external inputs.
import { query } from "./_generated/server";
import { v } from "convex/values";
import { nearestPoints } from "./lib/spatial";
import {
  computeHotspotScore,
  HOTSPOT_SCORE_INPUTS,
  type HotspotScoreInputs,
} from "./hotspots/score";

const FAF_YEAR = 2023;
const PORT_ZONE = "061";
const TRUCK_MODE = "1";
// The modeled-demand threshold above which a zero-Class-8 location is flagged a
// mobile-energy / siting opportunity. Tunable; documented default.
const OPPORTUNITY_SCORE_THRESHOLD = 0.5;

export const hotspotReport = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
    hotspotId: v.optional(v.id("hotspots")),
    fafYear: v.optional(v.number()),
  },
  handler: async (ctx, { lat, lng, radiusM, hotspotId, fafYear }) => {
    const point = { lat, lng };

    // ── carriers (12-05, spatial) ─────────────────────────────────────────────
    const carrierHits = await nearestPoints(ctx, {
      table: "carriers",
      point,
      maxDistanceM: radiusM,
      limit: 50,
    });
    const carriers = carrierHits.map(({ doc, distanceM }) => ({
      name: doc.name,
      city: doc.city ?? null,
      corridorCity: doc.corridorCity ?? null,
      location: doc.location ?? null,
      distanceM,
    }));

    // ── parking + totalSpots (12-07, spatial) ─────────────────────────────────
    const parkingHits = await nearestPoints(ctx, {
      table: "parking",
      point,
      maxDistanceM: radiusM,
      limit: 100,
    });
    let totalSpots = 0;
    const parkingList = parkingHits.map(({ doc, distanceM }) => {
      if (typeof doc.numberOfSpots === "number") totalSpots += doc.numberOfSpots;
      return {
        name: doc.name ?? null,
        numberOfSpots: doc.numberOfSpots ?? null,
        hgv: doc.hgv ?? null,
        location: doc.location,
        distanceM,
      };
    });

    // ── pois grouped by type (12-07, spatial) ─────────────────────────────────
    const poiHits = await nearestPoints(ctx, {
      table: "pois",
      point,
      maxDistanceM: radiusM,
      limit: 200,
    });
    const poisByType: Record<string, number> = {};
    const poisFlat = poiHits.map(({ doc, distanceM }) => {
      poisByType[doc.type] = (poisByType[doc.type] ?? 0) + 1;
      return { type: doc.type, name: doc.name ?? null, location: doc.location, distanceM };
    });

    // ── chargers: fiveClosest + class8 gap within radius (12-04, spatial) ─────
    const chargerHits = await nearestPoints(ctx, {
      table: "chargers",
      point,
      maxDistanceM: radiusM,
      limit: 64,
    });
    const class8InRadius = chargerHits.filter((h) => h.doc.isClass8Capable === true);
    const fiveClosestAll = await nearestPoints(ctx, {
      table: "chargers",
      point,
      limit: 5,
    });
    const fiveClosest = fiveClosestAll.map(({ doc, distanceM }) => ({
      stationId: doc.stationId,
      name: doc.name ?? null,
      powerKw: doc.powerKw,
      maxVehicleClass: doc.maxVehicleClass ?? null,
      connectorTypes: doc.connectorTypes,
      isClass8Capable: doc.isClass8Capable,
      distanceM,
    }));
    const class8WithinRadius = class8InRadius.length;
    const closestClass8DistanceM =
      class8InRadius.length > 0
        ? Math.min(...class8InRadius.map((h) => h.distanceM))
        : null;
    const chargers = {
      fiveClosest,
      class8WithinRadius,
      closestClass8DistanceM,
      class8Chargers: class8InRadius
        .sort((a, b) => a.distanceM - b.distanceM)
        .map(({ doc, distanceM }) => ({
          stationId: doc.stationId,
          name: doc.name ?? null,
          powerKw: doc.powerKw,
          maxVehicleClass: doc.maxVehicleClass ?? null,
          connectorTypes: doc.connectorTypes,
          isClass8Capable: doc.isClass8Capable,
          distanceM,
        })),
    };

    // ── modeled score: READ the nearest persisted modeledDwell hotspot ────────
    // (precomputed by hotspots/compute so the query stays under the 1s cap). If
    // an explicit hotspotId is given, use it; else find the nearest modeledDwell
    // hotspot within radius; else fall back to an inline compute from the proxies
    // we already gathered here (still labeled modeled).
    let scorePayload:
      | {
          score: number;
          method: "modeled";
          inputs: string[];
          components: unknown;
          source: "persisted" | "inline";
          hotspotId: string | null;
          title: string | null;
        }
      | null = null;

    let chosenHotspot = null as null | {
      _id: string;
      score?: number;
      scoreInputs?: unknown;
      title: string;
      location: { lat: number; lng: number };
    };

    if (hotspotId) {
      const h = await ctx.db.get(hotspotId);
      if (h && h.kind === "modeledDwell") {
        chosenHotspot = {
          _id: h._id,
          score: h.score,
          scoreInputs: h.scoreInputs,
          title: h.title,
          location: h.location,
        };
      }
    }
    if (!chosenHotspot) {
      const modeled = await ctx.db
        .query("hotspots")
        .withIndex("by_kind", (q) => q.eq("kind", "modeledDwell"))
        .collect();
      let best: (typeof modeled)[number] | null = null;
      let bestD = Infinity;
      for (const h of modeled) {
        const d = haversineM(point, h.location);
        if (d <= radiusM && d < bestD) {
          best = h;
          bestD = d;
        }
      }
      if (best) {
        chosenHotspot = {
          _id: best._id,
          score: best.score,
          scoreInputs: best.scoreInputs,
          title: best.title,
          location: best.location,
        };
      }
    }

    if (chosenHotspot && typeof chosenHotspot.score === "number") {
      const si = chosenHotspot.scoreInputs as { components?: unknown } | undefined;
      scorePayload = {
        score: chosenHotspot.score,
        method: "modeled",
        inputs: [...HOTSPOT_SCORE_INPUTS],
        components: si?.components ?? null,
        source: "persisted",
        hotspotId: chosenHotspot._id,
        title: chosenHotspot.title,
      };
    }

    // ── freight context (12-03, zonal) ────────────────────────────────────────
    const year = fafYear ?? FAF_YEAR;
    const freightRows = await ctx.db
      .query("freightOD")
      .withIndex("by_orig_year", (q) => q.eq("dmsOrig", PORT_ZONE).eq("year", year))
      .collect();
    let totalKtons = 0;
    let totalValueUSD = 0;
    let truckKtons = 0;
    let truckValueUSD = 0;
    for (const r of freightRows) {
      const k = r.tonsKtons ?? 0;
      const val = r.valueUSD ?? 0;
      totalKtons += k;
      totalValueUSD += val;
      if (r.dmsMode === TRUCK_MODE) {
        truckKtons += k;
        truckValueUSD += val;
      }
    }
    const freightContext = {
      origin: PORT_ZONE,
      year,
      rowCount: freightRows.length,
      totalKtons,
      totalValueUSD,
      truckKtons,
      truckValueUSD,
    };

    // ── modeled score fallback (inline from gathered proxies) ─────────────────
    // Only if no persisted modeledDwell hotspot was near. Uses the proxies this
    // query already read (parking totalSpots, max nearby truckAADT is NOT
    // gathered here so we approximate with 0 and document it) — kept honest by
    // still returning method:"modeled". In practice the precompute covers the
    // corridor so this branch is the safety net, not the primary path.
    if (!scorePayload) {
      // gather the two proxies not already computed: nearby truckAADT + faf flow.
      const inlineInputs: HotspotScoreInputs = {
        parkingCapacity: totalSpots,
        truckAADT: 0, // not spatially gathered in the read path — documented gap
        fafFlowKtons: truckKtons,
        carrierCount: carriers.length,
      };
      const inline = computeHotspotScore(inlineInputs);
      scorePayload = {
        score: inline.score,
        method: "modeled",
        inputs: [...HOTSPOT_SCORE_INPUTS],
        components: inline.components,
        source: "inline",
        hotspotId: null,
        title: null,
      };
    }

    // ── whatsMissing: DERIVED gaps (no fabricated physics numbers) ────────────
    const mobileEnergyOpportunity =
      scorePayload.score >= OPPORTUNITY_SCORE_THRESHOLD && class8WithinRadius === 0;
    const whatsMissing = {
      // high modeled demand + zero in-radius Class-8 charging = siting opportunity
      mobileEnergyOpportunity,
      opportunityThreshold: OPPORTUNITY_SCORE_THRESHOLD,
      // zero-coverage honesty flags
      noClass8Charging: class8WithinRadius === 0,
      noParkingCapacity: totalSpots === 0,
      noCarriersInRadius: carriers.length === 0,
      // DEFERRED to Phase 13 — the routing/physics layer, NOT computed here.
      // These are markers, never fabricated numbers (T-12-08d).
      deferredToPhase13: {
        detourCost: "external — Phase-13 routing/physics engine (not computed in Convex)",
        environmentalBenefit: "external — Phase-13 physics + grid-emissions (not computed in Convex)",
      },
    };

    return {
      location: point,
      radiusM,
      carriers,
      parking: { count: parkingList.length, totalSpots, parking: parkingList },
      pois: { total: poisFlat.length, byType: poisByType, pois: poisFlat },
      chargers,
      score: scorePayload,
      freightContext,
      whatsMissing,
    };
  },
});

// Local haversine (meters) — avoids importing the LINE helpers into a POINT query.
function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
