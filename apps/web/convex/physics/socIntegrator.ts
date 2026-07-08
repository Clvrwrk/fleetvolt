// Sequential SoC forward integration with regen caps — port of soc_integrator.py (PHYS-05).
// SEQUENTIAL loop (not vectorizable — SOC[i] depends on SOC[i-1]).

import { MPS_PER_MPH } from "./constants";
import type { TruckParams } from "./types";

export interface IntegrateSocOptions {
  initialSocPct?: number;
}

export interface IntegrateSocResult {
  socPct: number[];
  energyKwh: number[];
  regenKwh: number[];
}

/**
 * Integrate SoC segment-by-segment with SOC-dependent regen limits.
 * Port of integrate_soc from soc_integrator.py — EXACT loop semantics.
 */
export function integrateSoc(
  pTractionW: number[],
  pAuxW: number[],
  distM: number[],
  speedMph: number[],
  truck: TruckParams,
  opts: IntegrateSocOptions = {},
): IntegrateSocResult {
  const n = distM.length;
  const socPct: number[] = new Array(n).fill(0);
  const energyKwh: number[] = new Array(n).fill(0);
  const regenKwh: number[] = new Array(n).fill(0);

  let soc = opts.initialSocPct ?? 100.0;
  const regenCapW = truck.regen_power_cap_kw * 1000.0;

  for (let i = 0; i < n; i++) {
    const v = speedMph[i] * MPS_PER_MPH;
    const dtS = v > 0 ? distM[i] / v : 0.0;

    let netKwh = 0.0;
    let regenSegment = 0.0;

    if (pTractionW[i] >= 0) {
      const motorW = pTractionW[i] / truck.drivetrain_efficiency;
      netKwh = ((motorW + pAuxW[i]) * dtS) / 3_600_000;
    } else {
      const auxKwh = (pAuxW[i] * dtS) / 3_600_000;
      if (soc <= truck.regen_soc_cutoff) {
        const regenW = Math.min(Math.abs(pTractionW[i]), regenCapW) * truck.regen_efficiency;
        regenSegment = (regenW * dtS) / 3_600_000;
        netKwh = auxKwh - regenSegment;
      } else {
        netKwh = auxKwh;
      }
    }

    soc -= (netKwh / truck.usable_kwh) * 100.0;
    socPct[i] = soc;
    energyKwh[i] = netKwh;
    regenKwh[i] = regenSegment;
  }

  return { socPct, energyKwh, regenKwh };
}
