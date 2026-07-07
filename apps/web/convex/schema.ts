// Convex schema for the /pulse Freight Pulse surface (Phase 7).
//
// Six tables. The five DATA tables (ports, highwaySegments, freightFlows,
// hotspots, marketSizing) each embed the SHARED `provenance` validator from
// ./lib/provenance, so no data record can exist without
// {source, fetchedAt, usefulnessScore, matchMethod} (DINT-01 / SRC-01).
// userFilters is the only table exempt — it holds anonymous view state, not data.
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { provenance } from "./lib/provenance";

export default defineSchema({
  // Port anchors: POLA/POLB/HUE/OAK/SF/SD. Rendered as AdvancedMarkers (Wave 2).
  ports: defineTable({
    name: v.string(),
    code: v.string(), // POLA/POLB/HUE/OAK/SF/SD
    location: v.object({ lat: v.number(), lng: v.number() }),
    annualTEU: v.optional(v.number()),
    metrics: v.optional(v.any()),
    provenance,
  }).index("by_code", ["code"]),

  highwaySegments: defineTable({
    segmentId: v.string(), // Caltrans/FAF route id
    route: v.string(), // "I-710","I-110","I-5","US-101"
    // simplify-js-thinned lat/lng polyline (Convex ~1MB doc guard, PITFALLS #11)
    path: v.array(v.object({ lat: v.number(), lng: v.number() })),
    aadt: v.optional(v.number()),
    // truck AADT kept DISTINCT from aadt — never conflate FAF vs PeMS (PITFALLS #7)
    truckAADT: v.optional(v.number()),
    bbox: v.object({
      minLat: v.number(),
      minLng: v.number(),
      maxLat: v.number(),
      maxLng: v.number(),
    }),
    provenance,
  })
    .index("by_route", ["route"])
    .index("by_segmentId", ["segmentId"]),

  freightFlows: defineTable({
    segmentId: v.string(), // FK -> highwaySegments.segmentId
    periodStart: v.number(),
    periodEnd: v.number(),
    granularity: v.union(
      v.literal("year"),
      v.literal("month"),
      v.literal("hour"),
    ),
    tons: v.optional(v.number()), // FAF annual tonnage (explicit unit)
    volume: v.number(), // normalized -> width (Phase 8)
    congestion: v.number(), // 0..1 -> R/Y/G (Phase 8)
    provenance,
  })
    .index("by_segment_period", ["segmentId", "periodStart"])
    .index("by_period", ["periodStart"]),

  // Seeded in P7, rendered P9.
  hotspots: defineTable({
    kind: v.union(
      v.literal("parking"),
      v.literal("congestion"),
      v.literal("truckingHQ"),
      v.literal("solarCharger"),
    ),
    location: v.object({ lat: v.number(), lng: v.number() }),
    title: v.string(),
    dimensions: v.array(
      v.object({ label: v.string(), value: v.string() }),
    ),
    meta: v.optional(v.any()),
    provenance,
  }).index("by_kind", ["kind"]),

  // Seeded in P7, rendered P9. provenance.source MUST be "ESTIMATE" — these
  // figures are estimates with a methodology basis, never measured (PITFALLS #9).
  marketSizing: defineTable({
    tier: v.union(v.literal("TAM"), v.literal("SAM"), v.literal("SOM")),
    regionPolygon: v.array(v.object({ lat: v.number(), lng: v.number() })),
    valueUSD: v.number(),
    label: v.string(),
    provenance,
  }).index("by_tier", ["tier"]),

  // D-07: anonymous, NOT WorkOS-keyed in P7. `filterKey` is a localStorage UUID
  // (or "anonymous" singleton). Rekey to a WorkOS subject id in Phase 10.
  // No provenance — this is view state, not data.
  userFilters: defineTable({
    filterKey: v.string(),
    timeMode: v.union(v.literal("5yr"), v.literal("1yr"), v.literal("live")),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    overlays: v.object({
      tam: v.boolean(),
      sam: v.boolean(),
      som: v.boolean(),
    }),
    selectedPort: v.optional(v.string()), // P7 port selector state
    selectedFlowPath: v.optional(v.string()),
  }).index("by_key", ["filterKey"]),
});
