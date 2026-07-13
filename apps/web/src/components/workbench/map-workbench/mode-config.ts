import type {
  WorkbenchLayerId,
  WorkbenchMode,
  WorkbenchPlanDraft,
} from "./types";
import { ROLE_LAYER_IDS } from "./role-layers";

export type { WorkbenchMode };

export type WorkbenchModeConfig = {
  mode: WorkbenchMode;
  title: string;
  description: string;
  primaryCta: string;
  /** Layers on by default — must be a subset of ROLE_LAYER_IDS[mode]. */
  defaultLayers: WorkbenchLayerId[];
  defaultDraft: WorkbenchPlanDraft;
};

export const DEFAULT_WORKBENCH_MODE: WorkbenchMode = "driver_day_plan";

export const WORKBENCH_MODE_CONFIG: Record<WorkbenchMode, WorkbenchModeConfig> = {
  driver_day_plan: {
    mode: "driver_day_plan",
    title: "Driver Day Plan",
    description:
      "A→B with Class 8 BET: where to charge, how far off route, dwell, amenities.",
    primaryCta: "Start Day Plan",
    defaultLayers: [...ROLE_LAYER_IDS.driver_day_plan],
    defaultDraft: {
      vehicleClass: "Class 8 drayage",
    },
  },
  fleet_contract_plan: {
    mode: "fleet_contract_plan",
    title: "Fleet Contract Plan",
    description:
      "Contract corridor sizing with yards, chargers, highways, and parking.",
    primaryCta: "Plan Contract",
    defaultLayers: [...ROLE_LAYER_IDS.fleet_contract_plan],
    defaultDraft: {
      vehicleClass: "Class 8 fleet",
    },
  },
  caas_gap_map: {
    mode: "caas_gap_map",
    title: "CaaS Gap Map",
    description:
      "West-coast freight overview, then gated Class-8 gap analysis on a built route.",
    primaryCta: "Find Charger Gaps",
    defaultLayers: [
      "ports",
      "freight-flow",
      "chargers",
      "parking",
      "class8-gaps",
      "carriers",
      "geo-regions",
      "highways",
    ],
    defaultDraft: {
      vehicleClass: "Class 8 corridor",
      metadata: {
        truckSlug: "ecascadia_438",
        driverProfile: "regional_drayage",
      },
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
