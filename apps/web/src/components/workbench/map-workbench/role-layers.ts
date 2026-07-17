import type { WorkbenchLayerId, WorkbenchMode } from "./types";

/**
 * Role-scoped map layers for the shared workbench shell.
 *
 * Same shell, different job:
 * - Driver: A→B + charge / park / amenities — no carriers, census, or freight OD
 * - Fleet: corridor ops — yards, highways, chargers, parking
 * - CaaS: full suite — gaps, carriers, freight flow, geo regions, deployment zones
 */

export type LayerToolbarItem = {
  id: WorkbenchLayerId;
  label: string;
  /** Short hint under the toggle when expanded. */
  hint: string;
};

const LAYER_CATALOG: Record<WorkbenchLayerId, LayerToolbarItem> = {
  route: {
    id: "route",
    label: "Route",
    hint: "A→B road geometry",
  },
  chargers: {
    id: "chargers",
    label: "Chargers",
    hint: "On/near-route charging",
  },
  parking: {
    id: "parking",
    label: "Parking",
    hint: "Truck parking / staging",
  },
  pois: {
    id: "pois",
    label: "Amenities",
    hint: "Food, rest, services",
  },
  "fleet-yards": {
    id: "fleet-yards",
    label: "Fleet yards",
    hint: "Yard return / depot",
  },
  highways: {
    id: "highways",
    label: "Truck traffic",
    hint: "NHFN / AADT corridors",
  },
  "geo-regions": {
    id: "geo-regions",
    label: "Census / regions",
    hint: "State · county · district (ACS)",
  },
  "class8-gaps": {
    id: "class8-gaps",
    label: "Class 8 GAP",
    hint: "Explainable mobile-charge siting candidates",
  },
  carriers: {
    id: "carriers",
    label: "Carriers",
    hint: "Carrier clusters / HQ",
  },
  ports: {
    id: "ports",
    label: "Ports",
    hint: "West-coast port anchors (POLA/POLB/OAK…)",
  },
  "freight-flow": {
    id: "freight-flow",
    label: "Freight volume out of port",
    hint: "Animated OD arcs · green/yellow/red by volume",
  },
  "caas-zones": {
    id: "caas-zones",
    label: "CaaS opportunity surface",
    hint: "Reserved for a future multi-zone scored surface",
  },
};

/** Layers each workbench mode may toggle. Order = toolbar order. */
export const ROLE_LAYER_IDS: Record<WorkbenchMode, WorkbenchLayerId[]> = {
  driver_day_plan: ["route", "chargers", "parking", "pois"],
  fleet_contract_plan: [
    "route",
    "chargers",
    "parking",
    "fleet-yards",
    "pois",
    "highways",
  ],
  caas_gap_map: [
    "ports",
    "freight-flow",
    "chargers",
    "parking",
    "highways",
    "geo-regions",
    "class8-gaps",
    "carriers",
    "route",
    "pois",
    "fleet-yards",
  ],
};

export function layersForMode(mode: WorkbenchMode): LayerToolbarItem[] {
  return ROLE_LAYER_IDS[mode].map((id) => LAYER_CATALOG[id]);
}

export function isLayerAllowedForMode(
  mode: WorkbenchMode,
  layerId: WorkbenchLayerId,
): boolean {
  return ROLE_LAYER_IDS[mode].includes(layerId);
}
