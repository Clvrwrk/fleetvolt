// Simulation KPI aggregation from segment arrays — port of kpi_aggregator.py.

import { MPS_PER_MPH, US_MILE_M } from "./constants";
import type { KpiResult } from "./types";

export function aggregateKpis(
  energyKwh: number[],
  regenKwh: number[],
  distM: number[],
  speedMph: number[],
): KpiResult {
  const n = energyKwh.length;
  let totalKwh = 0.0;
  let totalRegenKwh = 0.0;
  let totalDistM = 0.0;
  let totalTimeS = 0.0;

  for (let i = 0; i < n; i++) {
    totalKwh += energyKwh[i];
    totalRegenKwh += regenKwh[i];
    totalDistM += distM[i];
    const vMps = speedMph[i] * MPS_PER_MPH;
    totalTimeS += vMps > 0 ? distM[i] / vMps : 0.0;
  }

  const totalMiles = totalDistM > 0 ? totalDistM / US_MILE_M : 0.0;
  const whPerMi = totalMiles > 0 ? (totalKwh / totalMiles) * 1000.0 : 0.0;

  return {
    total_kwh: totalKwh,
    wh_per_mi: whPerMi,
    regen_kwh: totalRegenKwh,
    total_time_s: totalTimeS,
  };
}
