export const DEFAULT_CA_INDUSTRIAL_USD_PER_KWH = 0.18;
export const DEFAULT_MILES_PER_YEAR = 60_000;

export function kwhPer100Miles(kwhPerMi: number): number {
  return Math.round(kwhPerMi * 100 * 10) / 10;
}

export function annualEnergyCostUsd(
  kwhPerMi: number,
  usdPerKwh: number = DEFAULT_CA_INDUSTRIAL_USD_PER_KWH,
  milesPerYear: number = DEFAULT_MILES_PER_YEAR,
): number {
  return Math.round(kwhPerMi * milesPerYear * usdPerKwh);
}

export function deriveDutyPair(street: {
  min: number;
  max: number;
  typical: number;
}): { combined: number; fullyLaden: number; drayage: number } {
  // Street band is fully laden port/drayage GCW — use max for both duty slots
  // until separate drayage cycle factors exist (Phase 5).
  return {
    combined: street.typical,
    fullyLaden: street.max,
    drayage: street.max,
  };
}
