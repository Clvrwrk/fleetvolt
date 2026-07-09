import { z } from "zod";

export const streetEfficiencySchema = z.object({
  min: z.number(),
  max: z.number(),
  typical: z.number(),
});

export const annualEmissionsSchema = z.object({
  milesPerYear: z.number(),
  diesel: z.object({
    co2eT: z.number(),
    noxKg: z.number(),
    pm25Kg: z.number(),
  }),
  bev: z.object({
    co2eT: z.number(),
    noxKg: z.number(),
    pm25Kg: z.number(),
  }),
  avoided: z.object({
    co2eT: z.number(),
    noxKg: z.number(),
    pm25Kg: z.number(),
    pctCo2e: z.number(),
  }),
});

export const catalogVehicleSchema = z.object({
  slug: z.string().min(1),
  oem: z.string(),
  model: z.string(),
  displayName: z.string(),
  vehicleClassLabel: z.string(),
  category: z.string(),
  technology: z.string(),
  packKwh: z.number().nullable(),
  hvipIncentiveUsd: z.number().nullable(),
  hvipVehicleUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  kwhPerMiCombined: z.number().nullable(),
  kwhPerMiFullyLaden: z.number().nullable(),
  kwhPerMiDrayage: z.number().nullable(),
  peerKwhPerMiMin: z.number().nullable(),
  peerKwhPerMiMax: z.number().nullable(),
  annualEnergyCostUsd: z.number().nullable(),
  emissionsAnnual: annualEmissionsSchema.nullable(),
  physicsTruckSlug: z.string().nullable(),
  physicsTruckName: z.string().nullable(),
  energyEstimatePending: z.boolean(),
  assumptionsHash: z.string(),
});

export type CatalogVehicle = z.infer<typeof catalogVehicleSchema>;
export type AnnualEmissions = z.infer<typeof annualEmissionsSchema>;
