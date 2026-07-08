// Geo-fenced port drayage penalties for POLB/Long Beach harbor — port of port_drayage.py (D-10).
// The polygon is baked into the module (Convex actions can't read files at runtime).

export const PORT_SPEED_CAP_MPH = 25.0;
export const PORT_AUX_KW = 18.0;

// POLB/LB harbor polygon from data/geo/port_polb_lb.geojson (baked in — no runtime file read).
// [lon, lat] pairs forming a closed ring.
const PORT_POLYGON: number[][] = [
  [-118.285, 33.732],
  [-118.17, 33.732],
  [-118.17, 33.768],
  [-118.285, 33.768],
  [-118.285, 33.732], // closing point
];

/** Ray-casting point-in-polygon test (matches shapely Point.within for convex polygons). */
export function segmentInPort(lon: number, lat: number): boolean {
  const poly = PORT_POLYGON;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0],
      yi = poly[i][1];
    const xj = poly[j][0],
      yj = poly[j][1];
    if ((yi > lat) !== (yj > lat)) {
      const xCross = ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (lon < xCross) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/** Export the polygon for testing/debugging. */
export function getPortPolygon(): number[][] {
  return PORT_POLYGON;
}

export interface PortDrayageResult {
  speedMph: number[];
  auxKw: number[];
}

/** Apply stop-go aux bump and speed cap only to in-port segment midpoints. */
export function applyPortDrayage(
  segments: Array<{ mid_lon: number; mid_lat: number }>,
  speedMph: number[],
  auxKw: number[],
  enabled: boolean,
): PortDrayageResult {
  const speedOut = [...speedMph];
  const auxOut = [...auxKw];

  if (!enabled) {
    return { speedMph: speedOut, auxKw: auxOut };
  }

  for (let i = 0; i < segments.length; i++) {
    if (segmentInPort(segments[i].mid_lon, segments[i].mid_lat)) {
      speedOut[i] = Math.min(speedOut[i], PORT_SPEED_CAP_MPH);
      auxOut[i] = Math.max(auxOut[i], PORT_AUX_KW);
    }
  }

  return { speedMph: speedOut, auxKw: auxOut };
}
