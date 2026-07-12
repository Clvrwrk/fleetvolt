export type ChoroplethPoint = { lat: number; lng: number };

/**
 * Return verified drawable geometry for a choropleth region.
 *
 * Bounding boxes are deliberately excluded: they are useful for queries and
 * camera framing, but drawing them as region boundaries misrepresents the
 * underlying geography.
 */
export function getChoroplethRing(
  ring?: ChoroplethPoint[] | null,
): ChoroplethPoint[] | null {
  if (!ring || ring.length < 3) return null;
  if (
    ring.some(
      (point) =>
        !Number.isFinite(point.lat) ||
        !Number.isFinite(point.lng) ||
        point.lat < -90 ||
        point.lat > 90 ||
        point.lng < -180 ||
        point.lng > 180,
    )
  ) {
    return null;
  }
  return ring;
}
