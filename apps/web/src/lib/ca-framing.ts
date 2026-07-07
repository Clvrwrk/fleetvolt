// California-coast map framing helpers (FLOW-01).
//
// Derives the West-Coast bounds the Google vector <Map> loads framed on. Bounds
// math is delegated to @turf/turf (bbox + lineString/points) per "Don't
// Hand-Roll" — we never compute min/max by hand.
import { bbox, points as turfPoints } from "@turf/turf";

/** Google Maps LatLngBounds-literal shape ({north,south,east,west}). */
export type CaBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

/** A simple {lat,lng} point (matches the Convex ports.location shape). */
export type LatLng = { lat: number; lng: number };

/**
 * Default CA-coast framing when no points are supplied. Covers San Diego →
 * Oakland/SF and the POLB drayage arteries (I-710 / I-110 / I-5 / US-101).
 * Padded beyond the six ports so anchors sit comfortably inside the viewport.
 */
export const DEFAULT_CA_BOUNDS: CaBounds = {
  south: 32.5,
  west: -122.7,
  north: 38.0,
  east: -116.5,
};

/** The six seeded ports' coordinates (POLA/POLB/HUE/OAK/SF/SD). */
export const CA_PORT_COORDS: readonly LatLng[] = [
  { lat: 33.74, lng: -118.26 }, // POLA
  { lat: 33.75, lng: -118.2 }, // POLB
  { lat: 34.15, lng: -119.21 }, // HUE
  { lat: 37.8, lng: -122.32 }, // OAK
  { lat: 37.8, lng: -122.42 }, // SF
  { lat: 32.69, lng: -117.18 }, // SD
] as const;

/**
 * Convert a turf bbox tuple [west, south, east, north] to a Google bounds
 * object. Turf emits [minX(=lng/west), minY(=lat/south), maxX(=lng/east),
 * maxY(=lat/north)]; Google wants {north,south,east,west}.
 */
export function bboxTupleToBounds(
  tuple: [number, number, number, number],
): CaBounds {
  const [west, south, east, north] = tuple;
  return { north, south, east, west };
}

/**
 * Compute CA-coast bounds. With no points, returns the padded default framing.
 * With points, derives a tight bounding box around them via turf.bbox — used to
 * fit/reframe onto a selected port cluster.
 */
export function computeCaCoastBounds(pointsIn?: readonly LatLng[]): CaBounds {
  if (!pointsIn || pointsIn.length === 0) {
    return { ...DEFAULT_CA_BOUNDS };
  }

  // turf points want [lng, lat] pairs.
  const fc = turfPoints(pointsIn.map((p) => [p.lng, p.lat]));
  const tuple = bbox(fc) as [number, number, number, number];
  return bboxTupleToBounds(tuple);
}
