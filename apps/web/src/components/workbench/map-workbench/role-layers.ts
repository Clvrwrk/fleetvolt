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

export type LayerFilterId =
  | "class8_only"
  | "trailer_friendly"
  | "cold_storage_reefer"
  | "port_origin";

export type LayerFilterDef = {
  id: LayerFilterId;
  label: string;
  hint: string;
  /** Which layers this filter is most relevant to. */
  layers: WorkbenchLayerId[];
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
    label: "Heat map / CaaS zones",
    hint: "High truck traffic + Class-8 gap overlap",
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
    "caas-zones",
    "route",
    "pois",
    "fleet-yards",
  ],
};

/** Dataset filters — CaaS gets the full filter strip; others get none for MVP. */
export const ROLE_LAYER_FILTERS: Record<WorkbenchMode, LayerFilterDef[]> = {
  driver_day_plan: [
    {
      id: "class8_only",
      label: "Class 8 capable",
      hint: "Hide light-duty chargers",
      layers: ["chargers"],
    },
    {
      id: "trailer_friendly",
      label: "Trailer friendly",
      hint: "Sites that fit Class 8 + trailer",
      layers: ["chargers", "parking"],
    },
  ],
  fleet_contract_plan: [
    {
      id: "class8_only",
      label: "Class 8 capable",
      hint: "Hide light-duty chargers",
      layers: ["chargers"],
    },
    {
      id: "port_origin",
      label: "Port-linked",
      hint: "Emphasize port / gate context",
      layers: ["route", "fleet-yards"],
    },
  ],
  caas_gap_map: [
    {
      id: "class8_only",
      label: "Class 8 capable",
      hint: "HD / MCS-capable chargers",
      layers: ["chargers", "class8-gaps"],
    },
    {
      id: "cold_storage_reefer",
      label: "Cold storage / reefer",
      hint: "Higher aux load · fruit / perishables",
      layers: ["freight-flow", "carriers", "parking"],
    },
    {
      id: "port_origin",
      label: "Port origin",
      hint: "Filter freight leaving a port",
      layers: ["freight-flow", "geo-regions"],
    },
    {
      id: "trailer_friendly",
      label: "Trailer friendly",
      hint: "Staging that fits Class 8",
      layers: ["parking", "chargers", "caas-zones"],
    },
  ],
};

export function layersForMode(mode: WorkbenchMode): LayerToolbarItem[] {
  return ROLE_LAYER_IDS[mode].map((id) => LAYER_CATALOG[id]);
}

export function filtersForMode(mode: WorkbenchMode): LayerFilterDef[] {
  return ROLE_LAYER_FILTERS[mode];
}

export function isLayerAllowedForMode(
  mode: WorkbenchMode,
  layerId: WorkbenchLayerId,
): boolean {
  return ROLE_LAYER_IDS[mode].includes(layerId);
}
