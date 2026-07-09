import type { AnnualEmissions } from "./types.js";
import { DEFAULT_MILES_PER_YEAR } from "./energy.js";

/** Placeholder planning factors — replace with Phase 5 WTW tables. */
export const PLANNING_FACTORS = {
  dieselMpg: 6.5,
  dieselKgCo2ePerGallon: 10.21, // approx WTW-ish planning constant
  dieselNoxGPerMi: 3.0,
  dieselPm25GPerMi: 0.04,
  caGridKgCo2ePerKwh: 0.24,
} as const;

export function annualEmissionsVsDiesel(args: {
  kwhPerMi: number;
  milesPerYear?: number;
}): AnnualEmissions {
  const miles = args.milesPerYear ?? DEFAULT_MILES_PER_YEAR;
  const gallons = miles / PLANNING_FACTORS.dieselMpg;
  const dieselCo2eT =
    (gallons * PLANNING_FACTORS.dieselKgCo2ePerGallon) / 1000;
  const dieselNoxKg = (PLANNING_FACTORS.dieselNoxGPerMi * miles) / 1000;
  const dieselPm25Kg = (PLANNING_FACTORS.dieselPm25GPerMi * miles) / 1000;

  const bevCo2eT =
    (args.kwhPerMi * miles * PLANNING_FACTORS.caGridKgCo2ePerKwh) / 1000;
  const bevNoxKg = 0;
  const bevPm25Kg = 0;

  const avoidedCo2eT = dieselCo2eT - bevCo2eT;
  return {
    milesPerYear: miles,
    diesel: {
      co2eT: round1(dieselCo2eT),
      noxKg: round1(dieselNoxKg),
      pm25Kg: round2(dieselPm25Kg),
    },
    bev: {
      co2eT: round1(bevCo2eT),
      noxKg: bevNoxKg,
      pm25Kg: bevPm25Kg,
    },
    avoided: {
      co2eT: round1(avoidedCo2eT),
      noxKg: round1(dieselNoxKg - bevNoxKg),
      pm25Kg: round2(dieselPm25Kg - bevPm25Kg),
      pctCo2e: dieselCo2eT > 0 ? avoidedCo2eT / dieselCo2eT : 0,
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
