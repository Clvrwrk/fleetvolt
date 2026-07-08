// Vectorized segment force and power calculations — port of physics_engine.py (PHYS-02).
// All formulas are EXACT ports from the Python source.

import { G, MPS_PER_MPH, RHO_SEA_LEVEL, LBS_TO_KG } from "./constants";
import type { TruckParams } from "./types";
import { massKg } from "./types";

/** ISA-style air density (kg/m³) for weather preset hooks. */
export function airDensity(tempC: number = 20.0): number {
  return RHO_SEA_LEVEL * (288.15 / (tempC + 273.15));
}

export interface ForceComponents {
  fRoll: number[];
  fAero: number[];
  fGrade: number[];
}

/** Return rolling, aero, and grade force components (N) per segment. */
export function forceComponents(
  gradePct: number[],
  speedMph: number[],
  massKgVal: number,
  cRr: number,
  cd: number,
  frontalAreaM2: number,
  rho: number,
): ForceComponents {
  const n = gradePct.length;
  const fRoll: number[] = new Array(n);
  const fAero: number[] = new Array(n);
  const fGrade: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const theta = Math.atan(gradePct[i] / 100.0);
    const v = speedMph[i] * MPS_PER_MPH;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    fRoll[i] = cRr * massKgVal * G * cosT;
    fAero[i] = 0.5 * rho * cd * frontalAreaM2 * v ** 2;
    fGrade[i] = massKgVal * G * sinT;
  }

  return { fRoll, fAero, fGrade };
}

export interface SegmentForcesOptions {
  tempC?: number;
  rho?: number | null;
  headwindMph?: number;
  thermalFactor?: number;
  auxKw?: number | number[] | null;
}

export interface SegmentForcesResult {
  pTraction: number[];
  auxW: number[];
}

/** Compute traction and auxiliary power (W) for batch segments. */
export function segmentForces(
  distM: number[],
  gradePct: number[],
  speedMph: number[],
  truck: TruckParams,
  opts: SegmentForcesOptions = {},
): SegmentForcesResult {
  const n = gradePct.length;
  const rhoVal = opts.rho != null ? opts.rho : airDensity(opts.tempC ?? 20.0);
  const headwindMph = opts.headwindMph ?? 0.0;
  const thermalFactor = opts.thermalFactor ?? 1.0;

  const mass = massKg(truck);
  const { fRoll, fGrade } = forceComponents(
    gradePct,
    speedMph,
    mass,
    truck.C_rr,
    truck.drag_coefficient,
    truck.frontal_area_m2,
    rhoVal,
  );

  // fAero uses v_eff = (speed + headwind) * MPS_PER_MPH
  const fAeroEff: number[] = new Array(n);
  const pTraction: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const vEff = (speedMph[i] + headwindMph) * MPS_PER_MPH;
    fAeroEff[i] = 0.5 * rhoVal * truck.drag_coefficient * truck.frontal_area_m2 * vEff ** 2;
    const fTraction = fRoll[i] + fAeroEff[i] + fGrade[i];
    const v = speedMph[i] * MPS_PER_MPH;
    pTraction[i] = fTraction * v;
  }

  // Thermal factor divides discharge segments (pTraction > 0)
  if (thermalFactor > 0 && thermalFactor !== 1.0) {
    for (let i = 0; i < n; i++) {
      if (pTraction[i] > 0) {
        pTraction[i] = pTraction[i] / thermalFactor;
      }
    }
  }

  // Aux power
  const auxW: number[] = new Array(n);
  if (opts.auxKw == null) {
    const baseW = truck.aux_kw_base * 1000.0;
    for (let i = 0; i < n; i++) auxW[i] = baseW;
  } else if (Array.isArray(opts.auxKw)) {
    for (let i = 0; i < n; i++) auxW[i] = opts.auxKw[i] * 1000.0;
  } else {
    const baseW = opts.auxKw * 1000.0;
    for (let i = 0; i < n; i++) auxW[i] = baseW;
  }

  return { pTraction, auxW };
}

// Re-export LBS_TO_KG for consumers that need it
export { LBS_TO_KG };
