import { along, length, lineSlice, lineString } from "@turf/turf";
import type { components } from "@fleetvolt/shared-types";

type Segment = components["schemas"]["SegmentResult"];
type RouteResponse = components["schemas"]["RouteResponse"];
type CorridorCatalogEntry = components["schemas"]["CorridorCatalogEntry"];

export type RouteCoordinates = [number, number][];

export type MergedRoute = {
  routeCoords: RouteCoordinates;
  totalDistM: number;
  routeDistanceM: number;
};

export async function fetchRouteGeometry(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  signal?: AbortSignal,
): Promise<{ coordinates: RouteCoordinates; distance_m: number }> {
  const params = new URLSearchParams({
    origin_lat: String(originLat),
    origin_lon: String(originLon),
    dest_lat: String(destLat),
    dest_lon: String(destLon),
    shape_format: "geojson",
  });

  const res = await fetch(`/api/v1/routing/route?${params}`, { signal });
  if (!res.ok) {
    throw new Error(`Route fetch failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as RouteResponse;
  const coordinates = (data.coordinates ?? [])
    .filter((pair) => pair.length >= 2)
    .map((pair) => [pair[0]!, pair[1]!] as [number, number]);

  return { coordinates, distance_m: data.distance_m };
}

export function resolveCorridorEndpoints(
  corridorKey: string,
  corridors: CorridorCatalogEntry[],
): {
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
} | null {
  const entry = corridors.find((item) => item.corridor_key === corridorKey);
  if (!entry?.origin || entry.origin.length < 2 || !entry.dest || entry.dest.length < 2) {
    return null;
  }

  return {
    originLat: entry.origin[0]!,
    originLon: entry.origin[1]!,
    destLat: entry.dest[0]!,
    destLon: entry.dest[1]!,
  };
}

export function computeTotalDistM(segments: Segment[]): number {
  return segments.reduce((sum, segment) => sum + segment.dist_m, 0);
}

export function mergeRouteWithSegments(
  routeCoords: RouteCoordinates,
  segments: Segment[],
  routeDistanceM = 0,
): MergedRoute {
  const totalDistM = computeTotalDistM(segments);

  if (
    routeDistanceM > 0 &&
    totalDistM > 0 &&
    process.env.NODE_ENV === "development"
  ) {
    const mismatch = Math.abs(routeDistanceM - totalDistM) / totalDistM;
    if (mismatch > 0.05) {
      console.warn(
        `[route-geometry] Valhalla distance (${routeDistanceM.toFixed(0)} m) ` +
          `differs from simulation segments (${totalDistM.toFixed(0)} m) by ${(mismatch * 100).toFixed(1)}%`,
      );
    }
  }

  return {
    routeCoords,
    totalDistM,
    routeDistanceM,
  };
}

export function sliceRouteByDistanceM(
  routeCoords: RouteCoordinates,
  startM: number,
  endM: number,
  totalDistM: number,
): RouteCoordinates {
  if (routeCoords.length < 2 || totalDistM <= 0 || endM <= startM) {
    return [];
  }

  const line = lineString(routeCoords);
  const lineLenM = length(line, { units: "meters" });
  if (lineLenM <= 0) {
    return [];
  }

  const startAlong = Math.max(0, (startM / totalDistM) * lineLenM);
  const endAlong = Math.min(lineLenM, (endM / totalDistM) * lineLenM);
  if (endAlong <= startAlong) {
    return [];
  }

  const startPt = along(line, startAlong, { units: "meters" });
  const endPt = along(line, endAlong, { units: "meters" });
  const sliced = lineSlice(startPt, endPt, line);
  return sliced.geometry.coordinates as RouteCoordinates;
}

export function segmentDistanceBoundsM(
  segments: Segment[],
  index: number,
): { startM: number; endM: number } {
  if (index < 0 || index >= segments.length) {
    return { startM: 0, endM: 0 };
  }

  let startM = 0;
  for (let i = 0; i < index; i += 1) {
    startM += segments[i]!.dist_m;
  }

  return {
    startM,
    endM: startM + segments[index]!.dist_m,
  };
}
