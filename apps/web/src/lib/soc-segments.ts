// SoC gradient -> segmented solid-color Google Polylines (P11-03, MAP-01).
//
// Google Maps has NO per-vertex line-gradient (unlike Mapbox's line-gradient
// expression). So the shipped Phase-4 SoC gradient is reproduced as N
// contiguous solid-color google.maps.Polyline descriptors, one per simulation
// segment, each colored from the SAME SoC ramp Mapbox used — socColor() in
// @/lib/segment-geojson (>40 green #16A34A, 20-40 amber #D97706, <20 red
// #DC2626). A monotonic SoC descent therefore transitions green->amber->red at
// the exact legend thresholds (Pitfall #3).
//
// The active-segment white "casing" (rendered UNDER the active stretch on
// hover) is derived the same way the Mapbox casing was: slice the route by the
// active segment's cumulative-distance bounds.
import type { components } from "@fleetvolt/shared-types";
import { socColor } from "@/lib/segment-geojson";
import {
  segmentDistanceBoundsM,
  sliceRouteByDistanceM,
  type RouteCoordinates,
} from "@/lib/route-geometry";

type Segment = components["schemas"]["SegmentResult"];

/** A single {lat,lng} vertex (google.maps.LatLngLiteral shape). */
export type LatLngLiteral = { lat: number; lng: number };

/** A solid-color polyline descriptor for one route stretch. */
export type SocPolyline = {
  path: LatLngLiteral[];
  strokeColor: string;
};

/** Convert a turf/GeoJSON [lon, lat] pair to a Google {lat, lng} object. */
function toLatLng(coord: [number, number]): LatLngLiteral {
  return { lat: coord[1], lng: coord[0] };
}

/**
 * Split the merged route into one solid-color polyline per segment, colored by
 * that segment's SoC via socColor(). Endpoint continuity is enforced: each
 * polyline's last vertex is made identical to the next polyline's first vertex
 * so the rendered route has no visible gaps at segment boundaries.
 *
 * Returns [] for empty/degenerate input (no throw).
 */
export function buildSocPolylines(
  routeCoords: RouteCoordinates,
  segments: Segment[],
  totalDistM: number,
): SocPolyline[] {
  if (routeCoords.length < 2 || segments.length === 0 || totalDistM <= 0) {
    return [];
  }

  const polylines: SocPolyline[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    const { startM, endM } = segmentDistanceBoundsM(segments, index);
    const sliced = sliceRouteByDistanceM(
      routeCoords,
      startM,
      endM,
      totalDistM,
    );

    // A well-formed slice already spans this segment's stretch; if turf drops
    // it to <2 points (very short segment), synthesize a 2-point stub from the
    // route endpoints closest to the bounds so the segment count is preserved.
    let path: LatLngLiteral[];
    if (sliced.length >= 2) {
      path = sliced.map(toLatLng);
    } else {
      const startFrac = Math.min(1, Math.max(0, startM / totalDistM));
      const endFrac = Math.min(1, Math.max(0, endM / totalDistM));
      const startIdx = Math.min(
        routeCoords.length - 1,
        Math.round(startFrac * (routeCoords.length - 1)),
      );
      const endIdx = Math.min(
        routeCoords.length - 1,
        Math.max(startIdx + 1, Math.round(endFrac * (routeCoords.length - 1))),
      );
      path = [toLatLng(routeCoords[startIdx]!), toLatLng(routeCoords[endIdx]!)];
    }

    polylines.push({ path, strokeColor: socColor(segment.soc_pct) });
  }

  // Enforce shared boundary vertices: stitch each polyline's first point to the
  // previous polyline's last point (endpoint continuity — no gaps).
  for (let index = 1; index < polylines.length; index += 1) {
    const prev = polylines[index - 1]!;
    const curr = polylines[index]!;
    curr.path[0] = prev.path[prev.path.length - 1]!;
  }

  return polylines;
}

/**
 * Derive the white active-segment casing path: the route stretch under the
 * currently-hovered segment. Returns [] when the index is out of range or the
 * derived path has <2 points (degenerate) — no throw.
 */
export function buildActiveCasingPath(
  routeCoords: RouteCoordinates,
  segments: Segment[],
  activeSegmentIndex: number,
  totalDistM: number,
): LatLngLiteral[] {
  if (
    activeSegmentIndex < 0 ||
    activeSegmentIndex >= segments.length ||
    routeCoords.length < 2 ||
    totalDistM <= 0
  ) {
    return [];
  }

  const { startM, endM } = segmentDistanceBoundsM(segments, activeSegmentIndex);
  const sliced = sliceRouteByDistanceM(routeCoords, startM, endM, totalDistM);
  if (sliced.length < 2) {
    return [];
  }

  return sliced.map(toLatLng);
}
