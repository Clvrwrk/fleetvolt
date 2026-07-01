import type { components } from "@fleetvolt/shared-types";
import type { RouteCoordinates } from "./route-geometry.js";

type Segment = components["schemas"]["SegmentResult"];

export type MapboxExpression = unknown[];

export type RouteGeoJsonFeature = {
  type: "Feature";
  properties: Record<string, never>;
  geometry: {
    type: "LineString";
    coordinates: RouteCoordinates;
  };
};

export function socColor(soc: number): string {
  if (soc > 40) return "#16A34A";
  if (soc >= 20) return "#D97706";
  return "#DC2626";
}

export function buildSocGradientExpression(
  segments: Segment[],
  totalDistM: number,
): MapboxExpression {
  const initialSoc = segments[0]?.soc_pct ?? 100;
  const stops: MapboxExpression = [
    "step",
    ["line-progress"],
    socColor(initialSoc),
  ];

  if (totalDistM <= 0 || segments.length === 0) {
    return stops;
  }

  let cumulativeDistM = 0;
  for (const segment of segments) {
    cumulativeDistM += segment.dist_m;
    const progress = Math.min(1, cumulativeDistM / totalDistM);
    stops.push(progress, socColor(segment.soc_pct));
  }

  return stops;
}

export function buildRouteGeoJsonSource(
  routeCoords: RouteCoordinates,
): RouteGeoJsonFeature {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: routeCoords,
    },
  };
}
