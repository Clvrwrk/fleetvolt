import type { WorkbenchPlace } from "@/components/workbench/map-workbench/types";

export type CoreCorridor = {
  id: string;
  label: string;
  meta: string;
  origin: WorkbenchPlace;
  destination: WorkbenchPlace;
};

/** First-use corridors — stable per-user rotation (not per-refresh). */
export const CORE_CORRIDORS: CoreCorridor[] = [
  {
    id: "polb-barstow",
    label: "POLB → Barstow",
    meta: "128 mi · I-710 / I-15",
    origin: {
      id: "polb",
      label: "Port of Long Beach",
      latitude: 33.7542,
      longitude: -118.2165,
      kind: "port",
      source: "fleetvolt",
    },
    destination: {
      label: "Barstow",
      latitude: 34.8958,
      longitude: -117.0173,
      kind: "manual",
      source: "manual",
    },
  },
  {
    id: "oakland-tracy",
    label: "Oakland → Tracy",
    meta: "63 mi · I-580",
    origin: {
      label: "Port of Oakland",
      latitude: 37.7955,
      longitude: -122.2793,
      kind: "port",
      source: "fleetvolt",
    },
    destination: {
      label: "Tracy",
      latitude: 37.7397,
      longitude: -121.4252,
      kind: "manual",
      source: "manual",
    },
  },
  {
    id: "fontana-la",
    label: "Fontana → LA Basin",
    meta: "54 mi · I-10",
    origin: {
      label: "Fontana",
      latitude: 34.0922,
      longitude: -117.435,
      kind: "manual",
      source: "manual",
    },
    destination: {
      label: "Los Angeles Basin",
      latitude: 34.0522,
      longitude: -118.2437,
      kind: "manual",
      source: "manual",
    },
  },
  {
    id: "polb-shafter-ze",
    label: "LB → Shafter (ZE)",
    meta: "Energy Forward · 60-truck interim",
    origin: {
      id: "polb",
      label: "Port of Long Beach",
      latitude: 33.7542,
      longitude: -118.2165,
      kind: "port",
      source: "fleetvolt",
    },
    destination: {
      label: "Shafter, CA",
      latitude: 35.5005,
      longitude: -119.2718,
      kind: "manual",
      source: "manual",
    },
  },
  {
    id: "polb-tijuana-ze",
    label: "LB → Otay / Tijuana (ZE)",
    meta: "Energy Forward · US + MX border",
    origin: {
      id: "polb",
      label: "Port of Long Beach",
      latitude: 33.7542,
      longitude: -118.2165,
      kind: "port",
      source: "fleetvolt",
    },
    destination: {
      label: "Otay Mesa / Tijuana border",
      latitude: 32.555,
      longitude: -116.938,
      kind: "manual",
      source: "manual",
    },
  },
];

/** Deterministic pick so the same user always sees the same first-use corridor. */
export function pickCoreCorridor(userKey: string): CoreCorridor {
  let hash = 0;
  for (let i = 0; i < userKey.length; i += 1) {
    hash = (hash * 31 + userKey.charCodeAt(i)) >>> 0;
  }
  const index = hash % CORE_CORRIDORS.length;
  return CORE_CORRIDORS[index] ?? CORE_CORRIDORS[0]!;
}

export function endpointGeometry(
  origin: WorkbenchPlace,
  destination: WorkbenchPlace,
) {
  return {
    provider: "ptv" as const,
    // RouteCoordinate uses latitude/longitude — not Google's {lat,lng}.
    coordinates: [
      { latitude: origin.latitude, longitude: origin.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
    ],
    distanceMeters: undefined,
    durationSeconds: undefined,
    warnings: ["Core corridor preview — run Calculate for physics + Class 8 stops."],
  };
}

/** Normalize mixed {lat,lng} / {latitude,longitude} payloads from Convex or providers. */
export function normalizeRouteCoordinates(
  raw: unknown,
): Array<{ latitude: number; longitude: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ latitude: number; longitude: number }> = [];
  for (const point of raw) {
    if (!point || typeof point !== "object") continue;
    const record = point as Record<string, unknown>;
    const latitude =
      typeof record.latitude === "number"
        ? record.latitude
        : typeof record.lat === "number"
          ? record.lat
          : NaN;
    const longitude =
      typeof record.longitude === "number"
        ? record.longitude
        : typeof record.lng === "number"
          ? record.lng
          : typeof record.lon === "number"
            ? record.lon
            : NaN;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    out.push({ latitude, longitude });
  }
  return out;
}
