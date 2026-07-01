import type { components } from "@fleetvolt/shared-types";

type Segment = components["schemas"]["SegmentResult"];

export function findSegmentIndexByDistanceM(
  segments: Segment[],
  distanceM: number,
): number {
  if (segments.length === 0) {
    return -1;
  }

  let nearestIndex = 0;
  let nearestDelta = Math.abs(segments[0]!.dist_m - distanceM);

  for (let index = 1; index < segments.length; index += 1) {
    const delta = Math.abs(segments[index]!.dist_m - distanceM);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearestIndex = index;
    }
  }

  return nearestIndex;
}

export function distMToMiles(distM: number): number {
  return distM / 1609.34;
}
