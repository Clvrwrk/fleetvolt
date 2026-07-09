import {
  annualEnergyCostUsd,
  DEFAULT_CA_INDUSTRIAL_USD_PER_KWH,
  deriveDutyPair,
} from "./energy.js";
import { annualEmissionsVsDiesel } from "./emissions.js";
import { catalogSlug } from "./slug.js";
import type { CatalogVehicle } from "./types.js";

export type HvipCsvRow = {
  Model: string;
  Category: string;
  OEM: string;
  "Technology Type": string;
  "Vehicle Incentive": string;
  "Vehicle Size": string;
  Dealers: string;
  "New or Conversion": string;
  Battery: string;
  "Model Year": string;
  GVWR: string;
  "Vehicle Type": string;
  URL: string;
};

export type PhysicsTruckLink = {
  slug: string;
  name: string;
  oem: string;
  modelHints: string[];
  packKwh: number;
  streetEfficiencyKwhPerMi: { min: number; max: number; typical: number };
};

export type BuildCatalogVehicleOptions = {
  physicsTrucks: PhysicsTruckLink[];
  peerKwhPerMiMin: number | null;
  peerKwhPerMiMax: number | null;
};

export function simpleAssumptionsHash(parts: string[]): string {
  let h = 0;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `a${Math.abs(h).toString(16)}`;
}

export function parseIncentiveUsd(value: string): number | null {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  if (!Number.isFinite(amount)) return null;
  return amount;
}

export function parsePrimaryPackKwh(battery: string): number | null {
  const match = battery.match(/([\d.]+)\s*kWh/i);
  if (!match) return null;
  return Math.round(Number(match[1]));
}

export function classLabelFromGvwr(gvwr: string, category: string): string {
  const classMatch = gvwr.match(/Class\s*(\d+)/i);
  if (classMatch) return `Class ${classMatch[1]}`;
  if (/tractor/i.test(category)) return "Class 8";
  const trimmed = gvwr.trim();
  if (trimmed) return trimmed;
  return "HVIP eligible";
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function oemMatches(rowOem: string, truckOem: string): boolean {
  const a = normalizeToken(rowOem);
  const b = normalizeToken(truckOem);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function modelMatchesHints(model: string, hints: string[]): boolean {
  const normalizedModel = normalizeToken(model);
  return hints.some((hint) => {
    const normalizedHint = normalizeToken(hint);
    return normalizedHint.length > 0 && normalizedModel.includes(normalizedHint);
  });
}

function findPhysicsTruckLink(
  row: HvipCsvRow,
  packKwh: number | null,
  physicsTrucks: PhysicsTruckLink[],
): PhysicsTruckLink | null {
  if (packKwh == null) return null;

  for (const truck of physicsTrucks) {
    if (Math.abs(truck.packKwh - packKwh) > 1) continue;
    if (!oemMatches(row.OEM, truck.oem)) continue;
    if (!modelMatchesHints(row.Model, truck.modelHints)) continue;
    return truck;
  }

  return null;
}

export function buildCatalogVehicleFromHvipRow(
  row: HvipCsvRow,
  opts: BuildCatalogVehicleOptions,
): CatalogVehicle {
  const oem = row.OEM.trim();
  const model = row.Model.trim();
  const category = row.Category.trim();
  const technology = row["Technology Type"].trim();

  const packKwh = parsePrimaryPackKwh(row.Battery);
  const hvipIncentiveUsd = parseIncentiveUsd(row["Vehicle Incentive"]);
  const physicsTruck = findPhysicsTruckLink(
    { ...row, OEM: oem, Model: model },
    packKwh,
    opts.physicsTrucks,
  );

  const slug = catalogSlug(oem, model, packKwh);
  const displayName =
    packKwh != null
      ? `${oem} ${model} ${packKwh} kWh`
      : `${oem} ${model}`;

  let kwhPerMiCombined: number | null = null;
  let kwhPerMiFullyLaden: number | null = null;
  let kwhPerMiDrayage: number | null = null;
  let annualEnergyCost: number | null = null;
  let emissionsAnnual: CatalogVehicle["emissionsAnnual"] = null;
  const energyEstimatePending = physicsTruck == null;

  if (physicsTruck) {
    const duty = deriveDutyPair(physicsTruck.streetEfficiencyKwhPerMi);
    kwhPerMiCombined = duty.combined;
    kwhPerMiFullyLaden = duty.fullyLaden;
    kwhPerMiDrayage = duty.drayage;
    annualEnergyCost = annualEnergyCostUsd(
      duty.combined,
      DEFAULT_CA_INDUSTRIAL_USD_PER_KWH,
    );
    emissionsAnnual = annualEmissionsVsDiesel({ kwhPerMi: duty.combined });
  }

  const hvipVehicleUrl = row.URL.trim() || null;

  return {
    slug,
    oem,
    model,
    displayName,
    vehicleClassLabel: classLabelFromGvwr(row.GVWR, category),
    category,
    technology,
    packKwh,
    hvipIncentiveUsd,
    hvipVehicleUrl,
    imageUrl: null,
    kwhPerMiCombined,
    kwhPerMiFullyLaden,
    kwhPerMiDrayage,
    peerKwhPerMiMin: opts.peerKwhPerMiMin,
    peerKwhPerMiMax: opts.peerKwhPerMiMax,
    annualEnergyCostUsd: annualEnergyCost,
    emissionsAnnual,
    physicsTruckSlug: physicsTruck?.slug ?? null,
    physicsTruckName: physicsTruck?.name ?? null,
    energyEstimatePending,
    assumptionsHash: simpleAssumptionsHash([
      slug,
      String(hvipIncentiveUsd ?? ""),
      String(packKwh ?? ""),
      physicsTruck?.slug ?? "",
      String(kwhPerMiCombined ?? ""),
      String(opts.peerKwhPerMiMin ?? ""),
      String(opts.peerKwhPerMiMax ?? ""),
    ]),
  };
}
