// Override merge and assumptions audit trail — port of overrides.py (D-14).

import type { AssumptionEntry, OverridesSpec, TruckParams } from "./types";

export const OVERRIDE_FIELDS = [
  "C_rr",
  "drag_coefficient",
  "usable_kwh",
  "aux_kw_base",
  "regen_efficiency",
] as const;

export const BOUNDS_TOLERANCE = 0.20;

export class OverrideBoundsError extends Error {
  constructor(
    public field: string,
    public value: number,
    public oemDefault: number,
  ) {
    const low = oemDefault * (1.0 - BOUNDS_TOLERANCE);
    const high = oemDefault * (1.0 + BOUNDS_TOLERANCE);
    super(
      `Override ${field}=${value} outside ±20% OEM bounds [${low.toPrecision(6)}, ${high.toPrecision(6)}] (oem_default=${oemDefault})`,
    );
    this.name = "OverrideBoundsError";
  }
}

function oemValue(
  oem: Record<string, unknown>,
  field: string,
  filePayload: Record<string, unknown>,
): number {
  return Number(oem[field] ?? filePayload[field] ?? 0);
}

/** Reject override values outside ±20% of OEM default. */
export function validateOverrideBounds(
  field: string,
  value: number,
  oemDefault: number,
): void {
  const low = oemDefault * (1.0 - BOUNDS_TOLERANCE);
  const high = oemDefault * (1.0 + BOUNDS_TOLERANCE);
  if (value < low || value > high) {
    throw new OverrideBoundsError(field, value, oemDefault);
  }
}

export interface ApplyOverridesResult {
  truck: TruckParams;
  assumptions: AssumptionEntry[];
}

/** Merge inline overrides onto truck params and build assumptions audit trail. */
export function applyTruckOverrides(
  truck: TruckParams,
  overrides: OverridesSpec,
  oem: Record<string, unknown>,
  filePayload: Record<string, unknown>,
): ApplyOverridesResult {
  const assumptions: AssumptionEntry[] = [];
  const merged: Record<string, number> = {
    usable_kwh: truck.usable_kwh,
    curb_weight_lbs: truck.curb_weight_lbs,
    payload_lbs: truck.payload_lbs,
    C_rr: truck.C_rr,
    drag_coefficient: truck.drag_coefficient,
    frontal_area_m2: truck.frontal_area_m2,
    regen_efficiency: truck.regen_efficiency,
    regen_power_cap_kw: truck.regen_power_cap_kw,
    regen_soc_cutoff: truck.regen_soc_cutoff,
    aux_kw_base: truck.aux_kw_base,
    drivetrain_efficiency: truck.drivetrain_efficiency,
  };

  for (const field of OVERRIDE_FIELDS) {
    const oemDefault = oemValue(oem, field, filePayload);
    const overrideValue = overrides[field as keyof OverridesSpec] as
      | number
      | null
      | undefined;

    let applied: number;
    let source: string;

    if (overrides.reset_to_oem) {
      applied = oemDefault;
      source = "oem_default";
    } else if (overrideValue != null) {
      validateOverrideBounds(field, overrideValue, oemDefault);
      applied = overrideValue;
      source = "user_override";
    } else {
      applied = merged[field];
      source = "oem_default";
    }

    merged[field] = applied;
    assumptions.push({
      field,
      value: applied,
      source,
      oem_default: oemDefault,
    });
  }

  const updatedTruck: TruckParams = {
    usable_kwh: merged.usable_kwh,
    curb_weight_lbs: merged.curb_weight_lbs,
    payload_lbs: merged.payload_lbs,
    C_rr: merged.C_rr,
    drag_coefficient: merged.drag_coefficient,
    frontal_area_m2: merged.frontal_area_m2,
    regen_efficiency: merged.regen_efficiency,
    regen_power_cap_kw: merged.regen_power_cap_kw,
    regen_soc_cutoff: merged.regen_soc_cutoff,
    aux_kw_base: merged.aux_kw_base,
    drivetrain_efficiency: merged.drivetrain_efficiency,
  };

  return { truck: updatedTruck, assumptions };
}
