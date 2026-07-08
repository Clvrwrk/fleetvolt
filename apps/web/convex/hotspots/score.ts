// MODELED hotspot dwell/demand score (P12-11 / P12-12) — PURE, no Convex imports.
//
// ── THE LOAD-BEARING HONESTY CONSTRAINT (P12-12) ──────────────────────────────
// This score is MODELED, never OBSERVED. FleetVolt holds NO dwell telematics
// (INRIX / StreetLight are paid feeds we do not license). computeHotspotScore
// therefore composes a 0–1 demand proxy from the four signals we DO hold and
// ALWAYS returns method:"modeled" plus the four proxy `inputs` it was derived
// from. Overclaiming "observed dwell" is prohibited — score.test.ts fails if the
// modeled label or the four inputs are ever dropped, and the persisted rows carry
// provenance{source:"ESTIMATE", method:"modeled", inputs:[...]}.
//
// ── THE FOUR PROXIES ──────────────────────────────────────────────────────────
//   1. parkingCapacity — NATD truck-stop numberOfSpots summed within radius
//      (12-07 parkingInRadius.totalSpotsWithinRadius). SPATIAL (per-location).
//   2. truckAADT       — CalTrans 5-axle truck AADT on nearby highway segments
//      (12-06 corridorCongestion / mostCongestedRoute). SPATIAL (per-location).
//   3. fafFlowKtons    — FAF zone-061 outbound flow magnitude (12-03
//      freightContext). ⚠️ ZONAL, NOT SPATIAL (see caveat below).
//   4. carrierCount    — geocoded POLB carriers within radius (12-05
//      carriersInRadius). SPATIAL (per-location).
//
// ── ⚠️ THE FAF ZONAL CAVEAT (document everywhere) ─────────────────────────────
// freightOD (12-03) is keyed by origin/dest FAF ZONES (dms_orig="061") and has
// NO segment geometry. For every candidate location on a single corridor that
// lives inside zone 061 the fafFlowKtons proxy is a CORRIDOR-WIDE CONSTANT — it
// legitimately scales the whole corridor's freight magnitude (a corridor-level
// term) but adds ZERO spatial discrimination between neighbouring candidate
// hotspots on that corridor. The three SPATIALLY-DISCRIMINATING proxies are
// parkingCapacity, truckAADT-on-nearby-segments, and carrierCount. If finer FAF
// spatial resolution is ever needed, map OD flow to segments via a crosswalk
// (future work — NOT this phase). Because it does not differentiate locations on
// a corridor, faf carries the LOWEST default weight.

/** The four proxy inputs — the immutable honesty label carried on every score. */
export const HOTSPOT_SCORE_INPUTS = [
  "NATD_parking_capacity",
  "Caltrans_5axle_truckAADT",
  "FAF_zone061_flow",
  "POLB_carrier_concentration",
] as const;

export interface HotspotScoreInputs {
  /** Summed NATD numberOfSpots within radius (12-07). */
  parkingCapacity: number;
  /** CalTrans 5-axle truck AADT on nearby segments (12-06). */
  truckAADT: number;
  /** FAF zone-061 outbound flow, thousand-tons — ZONAL, corridor-wide (12-03). */
  fafFlowKtons: number;
  /** Geocoded POLB carriers within radius (12-05). */
  carrierCount: number;
}

export interface HotspotScoreWeights {
  parking: number;
  truck: number;
  faf: number;
  carrier: number;
}

/**
 * DEFAULT WEIGHTS (tunable config, NOT magic constants — T-12-08e). They sum to
 * 1.0. The three spatially-discriminating proxies carry the bulk of the weight;
 * the ZONAL faf term is deliberately the smallest (it cannot differentiate
 * neighbouring corridor locations, only scale the whole corridor). Callers may
 * pass any weights object; the same inputs+weights always produce the same score
 * (pure + deterministic + auditable).
 */
export const DEFAULT_WEIGHTS: HotspotScoreWeights = {
  parking: 0.35,
  truck: 0.3,
  carrier: 0.2,
  faf: 0.15,
};

/**
 * DOCUMENTED REFERENCE MAXIMA — the corridor-scale denominators each proxy is
 * normalized against. Chosen from the live SoCal drayage-corridor distributions
 * (12-05/06/07 ingests): NATD sites cap in the low-hundreds of spots; CalTrans
 * 5-axle truck AADT peaks ~32k on I-5; FAF zone-061 outbound totals ~600k ktons;
 * corridor carrier clusters reach ~130. Heavy-tailed proxies (truckAADT, faf)
 * use a LOG scale so a single mega-value does not saturate the term; parking and
 * carriers use linear min-max. All terms clamp to [0,1].
 */
export const REFERENCE_MAXIMA = {
  parkingCapacity: 500, // linear
  truckAADT: 35_000, // log
  fafFlowKtons: 600_000, // log
  carrierCount: 130, // linear
} as const;

function clamp01(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  return x >= 1 ? 1 : x;
}

/** Linear min-max against a reference max, clamped to [0,1]. */
function normLinear(value: number, refMax: number): number {
  return clamp01(value / refMax);
}

/**
 * Log-scale normalization for heavy-tailed proxies: log1p(value)/log1p(refMax),
 * clamped to [0,1]. Compresses the long tail so one extreme segment/zone does
 * not dominate the composite.
 */
function normLog(value: number, refMax: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return clamp01(Math.log1p(value) / Math.log1p(refMax));
}

export interface HotspotScoreResult {
  /** Composite demand score in [0,1]. */
  score: number;
  /** ALWAYS "modeled" — the honesty label (P12-12). */
  method: "modeled";
  /** ALWAYS the four proxy inputs — the honesty label (P12-12). */
  inputs: string[];
  /** Per-proxy normalized components (0–1) for audit (T-12-08e). */
  components: {
    parking: number;
    truck: number;
    faf: number;
    carrier: number;
  };
  /** The weights actually applied (echoed for audit). */
  weights: HotspotScoreWeights;
}

/**
 * Compute the MODELED hotspot demand score from the four proxies.
 *
 * PURE + DETERMINISTIC: no Convex ctx, no clock, no randomness. Same
 * inputs+weights ⇒ same score. Each proxy is normalized to [0,1] (linear for
 * parking/carriers, log for the heavy-tailed truckAADT/faf), combined by the
 * weighted sum, and clamped to [0,1]. The return ALWAYS carries method:"modeled"
 * and the four `inputs` — the label that keeps a modeled score from ever
 * masquerading as observed dwell.
 */
export function computeHotspotScore(
  inputs: HotspotScoreInputs,
  weights: HotspotScoreWeights = DEFAULT_WEIGHTS,
): HotspotScoreResult {
  const components = {
    parking: normLinear(inputs.parkingCapacity, REFERENCE_MAXIMA.parkingCapacity),
    truck: normLog(inputs.truckAADT, REFERENCE_MAXIMA.truckAADT),
    faf: normLog(inputs.fafFlowKtons, REFERENCE_MAXIMA.fafFlowKtons),
    carrier: normLinear(inputs.carrierCount, REFERENCE_MAXIMA.carrierCount),
  };

  const weightSum =
    weights.parking + weights.truck + weights.faf + weights.carrier;
  // Normalize by the weight sum so arbitrary (non-unit) weights still yield a
  // score in [0,1]; defaults already sum to 1 so this is a no-op for them.
  const denom = weightSum > 0 ? weightSum : 1;

  const raw =
    components.parking * weights.parking +
    components.truck * weights.truck +
    components.faf * weights.faf +
    components.carrier * weights.carrier;

  return {
    score: clamp01(raw / denom),
    method: "modeled",
    inputs: [...HOTSPOT_SCORE_INPUTS],
    components,
    weights,
  };
}
