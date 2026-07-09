/**
 * Static west-coast port freight movement arcs for CaaS overview map.
 * Built from port TEU / corridor intensity — not live-dynamic; used until
 * the user builds a route and the map switches to route analysis.
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
  las_vegas: { label: "Las Vegas / I-15", lat: 36.1699, lng: -115.1398 },
  sacramento: { label: "Sacramento / I-80", lat: 38.5816, lng: -121.4944 },
};

/** Curated OD arcs: port code → dest key → relative daily truck intensity 0–100. */
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
  { portCode: "POLB", destKey: "las_vegas", intensity: 58, directionHint: "I-15 north" },
];

function tierForIntensity(intensity: number): FreightTrafficTier {
  if (intensity >= 70) return "heavy";
  if (intensity >= 40) return "medium";
  return "low";
}

function colorForTier(tier: FreightTrafficTier): string {
  if (tier === "heavy") return "#c0392b";
  if (tier === "medium") return "#d4a017";
  return "#3f9b6b";
}

export const westCoastFreightFlows = query({
  args: {},
  returns: v.object({
    arcs: v.array(
      v.object({
        id: v.string(),
        portCode: v.string(),
        portName: v.string(),
        origin: v.object({ lat: v.number(), lng: v.number() }),
        destination: v.object({
          label: v.string(),
          lat: v.number(),
          lng: v.number(),
        }),
        intensity: v.number(),
        tier: v.union(
          v.literal("low"),
          v.literal("medium"),
          v.literal("heavy"),
        ),
        color: v.string(),
        directionHint: v.string(),
        dailyTruckIndex: v.number(),
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

    const arcs = PORT_ARCS.flatMap((arc) => {
      const port = byCode.get(arc.portCode);
      const dest = DESTINATIONS[arc.destKey];
      if (!port || !dest) return [];
      const tier = tierForIntensity(arc.intensity);
      // Weight intensity by port TEU when available (normalize ~9M TEU → 1.0).
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
          intensity: arc.intensity,
          tier,
          color: colorForTier(tier),
          directionHint: arc.directionHint,
          dailyTruckIndex,
        },
      ];
    });

    return {
      arcs,
      legend: {
        low: "Green dotted — lower daily truck volume",
        medium: "Yellow dotted — medium daily truck volume",
        heavy: "Red dotted — heavy daily truck volume",
      },
      note:
        "Static west-coast freight movement overview from port TEU + corridor intensity. Switches to the live route map after you build a route.",
    };
  },
});
