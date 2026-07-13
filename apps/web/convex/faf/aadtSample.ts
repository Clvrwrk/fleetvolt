/**
 * Sample CalTrans truck AADT postmiles along a road-traced corridor path.
 */
import { haversineMeters } from "../lib/haversine";

export type LatLng = { lat: number; lng: number };

export type AadtSamplePoint = {
  location: LatLng;
  truckAADT: number;
  route: string;
};

export type TruckAadtStats = {
  min: number;
  max: number;
  mean: number;
  p90: number;
  sampleCount: number;
};

export type FreightTrafficTier = "low" | "medium" | "heavy";

/** Evenly sample path vertices for nearest-postmile lookup. */
export function samplePathVertices(
  path: LatLng[],
  maxSamples = 24,
): LatLng[] {
  if (path.length === 0) return [];
  if (path.length <= maxSamples) return path;
  const last = path.length - 1;
  const out: LatLng[] = [];
  for (let i = 0; i < maxSamples; i += 1) {
    const idx = Math.round((i / (maxSamples - 1)) * last);
    const p = path[idx]!;
    const prev = out[out.length - 1];
    if (!prev || prev.lat !== p.lat || prev.lng !== p.lng) out.push(p);
  }
  return out;
}

export function nearestTruckAadt(
  point: LatLng,
  candidates: AadtSamplePoint[],
  maxDistanceM = 5000,
): number | null {
  let best: number | null = null;
  let bestD = maxDistanceM;
  for (const c of candidates) {
    const d = haversineMeters(point, c.location);
    if (d <= bestD) {
      bestD = d;
      best = c.truckAADT;
    }
  }
  return best;
}

export function aggregateTruckAadt(values: number[]): TruckAadtStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  const p90Index = Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * 0.9),
  );
  return {
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    mean: Math.round(sum / sorted.length),
    p90: sorted[p90Index]!,
    sampleCount: sorted.length,
  };
}

/** Absolute tier from mean 5-axle truck AADT (fallback when cohort is tiny). */
export function tierFromTruckAadtMean(mean: number): FreightTrafficTier {
  // Absolute cutoffs — used only when percentile cohort has <3 scored corridors.
  if (mean >= 5000) return "heavy";
  if (mean >= 1500) return "medium";
  return "low";
}

/**
 * Percentile tiers across a corridor cohort so the freight map always shows
 * a red / yellow / green mix when AADT values cluster high.
 * Top third → heavy, middle → medium, bottom → low.
 */
export function tierFromAadtPercentile(
  mean: number | null | undefined,
  sortedMeans: number[],
): FreightTrafficTier {
  if (typeof mean !== "number") return "low";
  if (sortedMeans.length < 3) return tierFromTruckAadtMean(mean);
  const rank =
    sortedMeans.filter((s) => s <= mean).length / sortedMeans.length;
  if (rank >= 2 / 3) return "heavy";
  if (rank >= 1 / 3) return "medium";
  return "low";
}

export function colorForTier(tier: FreightTrafficTier): string {
  if (tier === "heavy") return "#c0392b";
  if (tier === "medium") return "#d4a017";
  return "#3f9b6b";
}

export function bboxFromPath(path: LatLng[]): {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
} {
  let minLat = path[0]!.lat;
  let maxLat = path[0]!.lat;
  let minLng = path[0]!.lng;
  let maxLng = path[0]!.lng;
  for (const p of path) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, minLng, maxLat, maxLng };
}

export function sampleAadtAlongPath(
  path: LatLng[],
  candidates: AadtSamplePoint[],
): TruckAadtStats | null {
  const vertices = samplePathVertices(path, 24);
  const values: number[] = [];
  for (const v of vertices) {
    const aadt = nearestTruckAadt(v, candidates, 5000);
    if (aadt != null) values.push(aadt);
  }
  return aggregateTruckAadt(values);
}
