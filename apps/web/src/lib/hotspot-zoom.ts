// P15-01: Zoom-level logic + score-to-visual mapping for the Hotspot Explorer.
//
// Three zoom levels drive which data layer renders on the map:
//   nation (zoom ≤5)  → state-level geoRegions with aggregateScore
//   state   (zoom 6–8) → county-level geoRegions with aggregateScore
//   county  (zoom ≥9)  → individual modeledDwell hotspot pins sized/colored by score
//
// scoreToColor maps 0→1 onto a gray→amber→orange→red gradient.
// scoreToRadiusPx maps 0→1 onto 6→18px linearly.
// All functions are PURE — testable without React/Convex.

export type ZoomLevel = "nation" | "state" | "county";

export const ZOOM_THRESHOLDS = {
  nation: 5, // zoom ≤ 5
  state: 8, // zoom 6–8
} as const;

/**
 * Map a Google Maps zoom number to one of three data layers.
 * - zoom ≤ 5  → 'nation' (state aggregate pins)
 * - zoom 6–8  → 'state' (county aggregate pins)
 * - zoom ≥ 9  → 'county' (individual modeledDwell hotspot pins)
 */
export function zoomLevelForZoom(zoom: number): ZoomLevel {
  if (zoom <= ZOOM_THRESHOLDS.nation) return "nation";
  if (zoom <= ZOOM_THRESHOLDS.state) return "state";
  return "county";
}

interface ColorStop {
  stop: number;
  hex: string;
}

// Gray → amber → orange → red gradient for score 0→1.
const COLOR_STOPS: ColorStop[] = [
  { stop: 0.0, hex: "#6B7280" }, // gray (no/low score)
  { stop: 0.3, hex: "#FBBF24" }, // amber
  { stop: 0.6, hex: "#F97316" }, // orange
  { stop: 0.8, hex: "#EF4444" }, // red
  { stop: 1.0, hex: "#DC2626" }, // dark red
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Linear interpolation between color stops for a score in [0,1].
 * Clamps to [0,1] first. Returns a hex color string.
 */
export function scoreToColor(score: number): string {
  const s = Math.max(0, Math.min(1, score));

  // Find the bracketing stops.
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const a = COLOR_STOPS[i];
    const b = COLOR_STOPS[i + 1];
    if (s >= a.stop && s <= b.stop) {
      const t = (s - a.stop) / (b.stop - a.stop);
      const [ar, ag, ab] = hexToRgb(a.hex);
      const [br, bg, bb] = hexToRgb(b.hex);
      return rgbToHex(
        ar + (br - ar) * t,
        ag + (bg - ag) * t,
        ab + (bb - ab) * t,
      );
    }
  }

  // Above the last stop — clamp to the last color.
  return COLOR_STOPS[COLOR_STOPS.length - 1].hex;
}

/**
 * Linear map of score [0,1] → radius in pixels [6,18].
 * Larger pin = higher score. Clamps to [0,1].
 */
export function scoreToRadiusPx(score: number): number {
  const s = Math.max(0, Math.min(1, score));
  return 6 + s * (18 - 6);
}
