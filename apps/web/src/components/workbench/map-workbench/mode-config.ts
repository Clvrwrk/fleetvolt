import type {
  WorkbenchLayerId,
  WorkbenchMode,
  WorkbenchPlanDraft,
} from "./types";

export type { WorkbenchMode };

export type WorkbenchModeConfig = {
  mode: WorkbenchMode;
  title: string;
  description: string;
  primaryCta: string;
  defaultLayers: WorkbenchLayerId[];
  defaultDraft: WorkbenchPlanDraft;
};

export const DEFAULT_WORKBENCH_MODE: WorkbenchMode = "driver_day_plan";

export const WORKBENCH_MODE_CONFIG: Record<WorkbenchMode, WorkbenchModeConfig> = {
  driver_day_plan: {
    mode: "driver_day_plan",
    title: "Driver Day Plan",
    description: "Plan one driver's route with charging, parking, and POI context.",
    primaryCta: "Start Day Plan",
    defaultLayers: ["route", "chargers", "parking", "pois"],
    defaultDraft: {
      vehicleClass: "Class 8 drayage",
    },
  },
  fleet_contract_plan: {
    mode: "fleet_contract_plan",
    title: "Fleet Contract Plan",
    description: "Evaluate contract routes against chargers, yards, POIs, and highways.",
    primaryCta: "Plan Contract",
    defaultLayers: ["route", "chargers", "fleet-yards", "pois", "highways"],
    defaultDraft: {
      vehicleClass: "Class 8 fleet",
    },
  },
  caas_gap_map: {
    mode: "caas_gap_map",
    title: "CaaS Gap Map",
    description: "Find charging-as-a-service gaps across regions, carriers, parking, and freight flows.",
    primaryCta: "Find Charger Gaps",
    defaultLayers: [
      "geo-regions",
      "class8-gaps",
      "carriers",
      "parking",
      "freight-flow",
      "caas-zones",
    ],
    defaultDraft: {
      vehicleClass: "Class 8 corridor",
    },
  },
};

export function getWorkbenchModeConfig(
  mode: WorkbenchMode = DEFAULT_WORKBENCH_MODE,
): WorkbenchModeConfig {
  return WORKBENCH_MODE_CONFIG[mode];
}

export function isWorkbenchMode(value: string | null | undefined): value is WorkbenchMode {
  return value === "driver_day_plan" || value === "fleet_contract_plan" || value === "caas_gap_map";
}

export function resolveWorkbenchMode(value: string | null | undefined): WorkbenchMode {
  return isWorkbenchMode(value) ? value : DEFAULT_WORKBENCH_MODE;
}
