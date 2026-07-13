/**
 * West-coast freight overview — prefers road-traced freightCorridors;
 * falls back to straight arcs when corridors have not been built yet.
 */
import { v } from "convex/values";
import { query } from "../_generated/server";

export type FreightTrafficTier = "low" | "medium" | "heavy";

const DESTINATIONS: Record<
  string,
  { label: string; lat: number; lng: number }
> = {
  barstow: { label: "Barstow / I-15", lat: 34.8958, lng: -117.0173 },
  ontario: { label: "Ontario / I-10", lat: 34.0633, lng: -117.6509 },
  bakersfield: { label: "Bakersfield / CA-99", lat: 35.3733, lng: -119.0187 },
  phoenix: { label: "Phoenix corridor", lat: 33.4484, lng: -112.074 },
  stockton: { label: "Stockton / I-5", lat: 37.9577, lng: -121.2908 },
  reno: { label: "Reno / I-80", lat: 39.5296, lng: -119.8138 },
  fresno: { label: "Fresno / CA-99", lat: 36.7378, lng: -119.7871 },
  tracy: { label: "Tracy / I-205", lat: 37.7397, lng: -121.4252 },
  las_vegas: { label: "Las Vegas", lat: 36.1699, lng: -115.1398 },
  sacramento: { label: "Sacramento / I-80", lat: 38.5816, lng: -121.4944 },
  shafter: { label: "Shafter / CA-99", lat: 35.5005, lng: -119.2718 },
  otay: { label: "Otay Mesa / Tijuana", lat: 32.555, lng: -116.938 },
  crescent_city: { label: "Crescent City / US-101", lat: 41.7558, lng: -124.2016 },
  redding: { label: "Redding / I-5", lat: 40.5865, lng: -122.3917 },
  la_basin: { label: "LA Basin / I-5", lat: 33.75, lng: -118.2 },
};

const PORT_ARCS: Array<{
  portCode: string;
  destKey: string;
  intensity: number;
  directionHint: string;
}> = [
  { portCode: "POLB", destKey: "barstow", intensity: 92, directionHint: "I-15 inland" },
  { portCode: "POLB", destKey: "ontario", intensity: 78, directionHint: "I-10 east" },
  { portCode: "POLB", destKey: "bakersfield", intensity: 55, directionHint: "I-5 north" },
  { portCode: "POLB", destKey: "phoenix", intensity: 48, directionHint: "I-10 east" },
  { portCode: "POLA", destKey: "ontario", intensity: 88, directionHint: "I-710 / I-10" },
  { portCode: "POLA", destKey: "barstow", intensity: 70, directionHint: "I-15 inland" },
  { portCode: "POLA", destKey: "fresno", intensity: 42, directionHint: "I-5 / CA-99" },
  { portCode: "OAK", destKey: "stockton", intensity: 74, directionHint: "I-580 / I-205" },
  { portCode: "OAK", destKey: "tracy", intensity: 68, directionHint: "I-580 east" },
  { portCode: "OAK", destKey: "sacramento", intensity: 52, directionHint: "I-80 east" },
  { portCode: "OAK", destKey: "reno", intensity: 38, directionHint: "I-80 east" },
  { portCode: "SF", destKey: "sacramento", intensity: 35, directionHint: "I-80 east" },
  { portCode: "SF", destKey: "stockton", intensity: 28, directionHint: "I-580 east" },
  { portCode: "HUE", destKey: "bakersfield", intensity: 32, directionHint: "US-101 / CA-126" },
  { portCode: "HUE", destKey: "ontario", intensity: 24, directionHint: "US-101 south" },
  { portCode: "SD", destKey: "phoenix", intensity: 40, directionHint: "I-8 east" },
  { portCode: "SD", destKey: "ontario", intensity: 30, directionHint: "I-15 north" },
  { portCode: "SD", destKey: "la_basin", intensity: 76, directionHint: "I-5 north" },
  { portCode: "POLB", destKey: "las_vegas", intensity: 58, directionHint: "I-15 north" },
  { portCode: "POLB", destKey: "shafter", intensity: 85, directionHint: "I-5 / CA-99 ZE" },
  { portCode: "POLB", destKey: "otay", intensity: 80, directionHint: "I-5 south ZE" },
  { portCode: "OAK", destKey: "redding", intensity: 42, directionHint: "I-5 north" },
  { portCode: "OAK", destKey: "crescent_city", intensity: 28, directionHint: "US-101 north" },
];

function tierForIntensity(intensity: number): FreightTrafficTier {
  if (intensity >= 85) return "heavy";
  if (intensity >= 50) return "medium";
  return "low";
}

function colorForTier(tier: FreightTrafficTier): string {
  if (tier === "heavy") return "#c0392b";
  if (tier === "medium") return "#d4a017";
  return "#3f9b6b";
}

const arcValidator = v.object({
  id: v.string(),
  portCode: v.string(),
  portName: v.string(),
  origin: v.object({ lat: v.number(), lng: v.number() }),
  destination: v.object({
    label: v.string(),
    lat: v.number(),
    lng: v.number(),
  }),
  path: v.array(v.object({ lat: v.number(), lng: v.number() })),
  intensity: v.number(),
  tier: v.union(
    v.literal("low"),
    v.literal("medium"),
    v.literal("heavy"),
  ),
  color: v.string(),
  directionHint: v.string(),
  dailyTruckIndex: v.number(),
  viaRouteLabel: v.optional(v.string()),
  compareGroup: v.optional(v.string()),
  distanceMiles: v.optional(v.number()),
  truckAadtMean: v.optional(v.number()),
  roadTraced: v.boolean(),
});

export const westCoastFreightFlows = query({
  args: {},
  returns: v.object({
    arcs: v.array(arcValidator),
    compareGroups: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        corridorKeys: v.array(v.string()),
      }),
    ),
    legend: v.object({
      low: v.string(),
      medium: v.string(),
      heavy: v.string(),
    }),
    note: v.string(),
  }),
  handler: async (ctx) => {
    const ports = await ctx.db.query("ports").collect();
    const byCode = new Map(ports.map((p) => [p.code, p]));
    const corridors = await ctx.db.query("freightCorridors").collect();

    if (corridors.length > 0) {
      const arcs = corridors.map((c) => {
        const port = byCode.get(c.originPortCode);
        const teuFactor = port?.annualTEU
          ? Math.min(1.25, Math.max(0.55, port.annualTEU / 9_000_000))
          : 0.7;
        const dailyTruckIndex = Math.round(c.intensity * teuFactor);
        return {
          id: c.corridorKey,
          portCode: c.originPortCode,
          portName: port?.name ?? c.originPortCode,
          origin: c.origin,
          destination: {
            label: c.destLabel,
            lat: c.dest.lat,
            lng: c.dest.lng,
          },
          path: c.path.length >= 2 ? c.path : [c.origin, c.dest],
          intensity: c.intensity,
          tier: c.tier,
          color: c.color,
          directionHint: c.directionHint,
          dailyTruckIndex,
          viaRouteLabel: c.viaRouteLabel,
          ...(c.compareGroup ? { compareGroup: c.compareGroup } : {}),
          ...(typeof c.distanceMiles === "number"
            ? { distanceMiles: c.distanceMiles }
            : {}),
          ...(c.truckAadtStats
            ? { truckAadtMean: c.truckAadtStats.mean }
            : {}),
          roadTraced: c.path.length >= 3,
        };
      });

      const groupMap = new Map<string, string[]>();
      for (const c of corridors) {
        if (!c.compareGroup) continue;
        const list = groupMap.get(c.compareGroup) ?? [];
        list.push(c.corridorKey);
        groupMap.set(c.compareGroup, list);
      }
      const compareGroups = [...groupMap.entries()].map(([id, keys]) => ({
        id,
        label:
          id === "polb-vegas"
            ? "POLB → Las Vegas (I-15 vs I-40)"
            : id === "pola-vegas"
              ? "POLA → Las Vegas (I-15 vs I-40)"
              : id === "energy-forward-ze"
                ? "Energy Forward ZE (Shafter + Tijuana)"
                : id,
        corridorKeys: keys,
      }));

      return {
        arcs,
        compareGroups,
        legend: {
          low: "Green — lower sampled 5-axle truck AADT along corridor",
          medium: "Yellow — medium sampled truck AADT",
          heavy: "Red — heavy sampled truck AADT",
        },
        note:
          "Road-traced corridors (Google Routes via waypoints) colored by CalTrans 5-axle truck AADT samples. Geometry is not truck-restriction-certified. Switches to the live route map after you build a route.",
      };
    }

    // Fallback: straight arcs until buildCorridors has been run.
    const arcs = PORT_ARCS.flatMap((arc) => {
      const port = byCode.get(arc.portCode);
      const dest = DESTINATIONS[arc.destKey];
      if (!port || !dest) return [];
      const tier = tierForIntensity(arc.intensity);
      const teuFactor = port.annualTEU
        ? Math.min(1.25, Math.max(0.55, port.annualTEU / 9_000_000))
        : 0.7;
      const dailyTruckIndex = Math.round(arc.intensity * teuFactor);
      return [
        {
          id: `${arc.portCode}-${arc.destKey}`,
          portCode: arc.portCode,
          portName: port.name,
          origin: { lat: port.location.lat, lng: port.location.lng },
          destination: {
            label: dest.label,
            lat: dest.lat,
            lng: dest.lng,
          },
          path: [
            { lat: port.location.lat, lng: port.location.lng },
            { lat: dest.lat, lng: dest.lng },
          ],
          intensity: arc.intensity,
          tier,
          color: colorForTier(tier),
          directionHint: arc.directionHint,
          dailyTruckIndex,
          roadTraced: false,
        },
      ];
    });

    return {
      arcs,
      compareGroups: [],
      legend: {
        low: "Green dotted — lower daily truck volume (intensity proxy)",
        medium: "Yellow dotted — medium daily truck volume",
        heavy: "Red dotted — heavy daily truck volume",
      },
      note:
        "Straight-arc fallback — run faf/buildCorridors:run for road-traced corridors with truck AADT. Switches to the live route map after you build a route.",
    };
  },
});
