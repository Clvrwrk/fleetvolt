import { z } from "zod";
import type { components } from "@fleetvolt/shared-types";

type SimulateRequest = components["schemas"]["SimulateRequest"];

export const weatherPresetSchema = z.enum(["ideal", "hot", "cold", "headwind"]);

export const scenarioFormSchema = z.object({
  corridor_key: z.string().min(1),
  truck_slug: z.string().min(1),
  weather_preset: weatherPresetSchema,
  payload_lbs: z.number().min(20000).max(80000),
  port_drayage_enabled: z.boolean(),
  include_charging: z.literal(true).default(true),
});

export type ScenarioFormValues = z.infer<typeof scenarioFormSchema>;

/** Demo defaults — matches services/api/src/simulations.test.ts CORRIDOR_BODY */
export const DEFAULT_SCENARIO_FORM: ScenarioFormValues = {
  corridor_key: "polb_cajon_pass",
  truck_slug: "ecascadia_438",
  weather_preset: "ideal",
  payload_lbs: 34000,
  port_drayage_enabled: false,
  include_charging: true,
};

export const TRUCK_SLUG_BY_NAME: Record<string, string> = {
  "Freightliner eCascadia 438 kWh": "ecascadia_438",
  "Kenworth T680E 375 kWh": "t680e_375",
};

export function slugFromTruckName(name: string): string {
  return TRUCK_SLUG_BY_NAME[name] ?? name.toLowerCase().replace(/\s+/g, "_");
}

export function toSimulateRequest(values: ScenarioFormValues): SimulateRequest {
  return {
    route: { corridor_key: values.corridor_key },
    truck: { slug: values.truck_slug },
    conditions: {
      weather_preset: values.weather_preset,
      payload_lbs: values.payload_lbs,
      port_drayage_enabled: values.port_drayage_enabled,
    },
    overrides: { reset_to_oem: false },
    options: { include_charging: values.include_charging },
  };
}
