// Piecewise OEM charge-curve dwell integration — port of charge_curve.py (CHRG-03, D-14).

import type { ChargeBreakpoint } from "./types";

function sortedCurve(curve: ChargeBreakpoint[]): ChargeBreakpoint[] {
  return [...curve].sort((a, b) => a.soc_pct - b.soc_pct);
}

function maxKwAtSoc(curve: ChargeBreakpoint[], socPct: number): number {
  const sorted = sortedCurve(curve);
  let maxKw = sorted[0].max_kw;
  for (const bp of sorted) {
    if (socPct >= bp.soc_pct) {
      maxKw = bp.max_kw;
    } else {
      break;
    }
  }
  return maxKw;
}

export interface ChargeCurveResult {
  dwellS: number;
  energyKwh: number;
  departureSoc: number;
}

/** Integrate dwell seconds along SOC-dependent max_kw bands. */
export function integrateChargeCurve(
  curve: ChargeBreakpoint[],
  arrivalSoc: number,
  targetSoc: number,
  stationKw: number,
  usableKwh: number,
): ChargeCurveResult {
  if (targetSoc <= arrivalSoc) {
    return { dwellS: 0.0, energyKwh: 0.0, departureSoc: arrivalSoc };
  }

  const sorted = sortedCurve(curve);
  const socBreaks = sorted.map((bp) => bp.soc_pct);
  socBreaks.push(100.0);

  let dwellS = 0.0;
  let energyKwh = 0.0;
  let currentSoc = arrivalSoc;

  for (let i = 0; i < sorted.length; i++) {
    const bandLo = sorted[i].soc_pct;
    const bandHi = i + 1 < socBreaks.length ? socBreaks[i + 1] : 100.0;

    if (currentSoc >= targetSoc) break;
    if (targetSoc <= bandLo) continue;
    if (currentSoc >= bandHi) continue;

    const segStart = Math.max(currentSoc, bandLo);
    const segEnd = Math.min(targetSoc, bandHi);
    if (segEnd <= segStart) continue;

    const segEnergyKwh = ((segEnd - segStart) / 100.0) * usableKwh;
    const bandMaxKw = sorted[i].max_kw;
    const effectiveKw = Math.min(bandMaxKw, stationKw);
    if (effectiveKw <= 0) {
      throw new Error(`Non-positive charge power at SOC band ${bandLo}%`);
    }

    dwellS += (segEnergyKwh / effectiveKw) * 3600.0;
    energyKwh += segEnergyKwh;
    currentSoc = segEnd;
  }

  const departureSoc = arrivalSoc + (energyKwh / usableKwh) * 100.0;
  return { dwellS, energyKwh, departureSoc };
}
