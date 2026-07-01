import type { components } from "@fleetvolt/shared-types";

type Segment = components["schemas"]["SegmentResult"];

export type MapboxExpression = unknown[];

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

  if (totalDistM <= 0) {
    return stops;
  }

  for (const segment of segments) {
    const progress = Math.min(1, segment.dist_m / totalDistM);
    stops.push(progress, socColor(segment.soc_pct));
  }

  return stops;
}
