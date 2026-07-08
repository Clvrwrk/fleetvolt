export type WorkbenchMode =
  | "driver_day_plan"
  | "fleet_contract_plan"
  | "caas_gap_map";

export type WorkbenchPlaceKind =
  | "address"
  | "port"
  | "charger"
  | "parking"
  | "fleet-yard"
  | "carrier"
  | "poi"
  | "geo-region"
  | "manual";

export type WorkbenchPlaceSource = "fleetvolt" | "google" | "manual";

export type WorkbenchPlace = {
  id?: string;
  label: string;
  latitude: number;
  longitude: number;
  kind: WorkbenchPlaceKind;
  source: WorkbenchPlaceSource;
  address?: string;
  metadata?: Record<string, unknown>;
};

export type WorkbenchLayerId =
  | "route"
  | "chargers"
  | "parking"
  | "pois"
  | "fleet-yards"
  | "highways"
  | "geo-regions"
  | "class8-gaps"
  | "carriers"
  | "freight-flow"
  | "caas-zones";

export type WorkbenchSelectionType =
  | "route"
  | "charger"
  | "parking"
  | "poi"
  | "fleet-yard"
  | "highway"
  | "geo-region"
  | "class8-gap"
  | "carrier"
  | "freight-flow"
  | "caas-zone";

export type WorkbenchSelection = {
  id: string;
  type: WorkbenchSelectionType;
  label: string;
  layerId: WorkbenchLayerId;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
};

export type WorkbenchPlanDraft = {
  origin?: WorkbenchPlace | null;
  destination?: WorkbenchPlace | null;
  waypoints?: WorkbenchPlace[];
  vehicleClass?: string;
  carrierId?: string;
  contractId?: string;
  timeWindow?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type WorkbenchResultCard = {
  id: string;
  title: string;
  summary: string;
  mode?: WorkbenchMode;
  severity?: "info" | "success" | "warning" | "critical";
  layerId?: WorkbenchLayerId;
  selection?: WorkbenchSelection;
  metrics?: Record<string, number | string | null>;
  actions?: Array<{
    id: string;
    label: string;
    kind: "primary" | "secondary";
  }>;
};

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type RouteGeometryResult = {
  provider: "google" | "ptv" | "valhalla" | "mock";
  coordinates: RouteCoordinate[];
  distanceMeters?: number;
  durationSeconds?: number;
  encodedPolyline?: string;
  warnings: string[];
  metadata?: Record<string, unknown>;
};

export type WorkbenchAiResult = {
  id: string;
  mode: WorkbenchMode;
  response: string;
  draftPatch?: Partial<WorkbenchPlanDraft>;
  routeGeometry?: RouteGeometryResult;
  resultCards?: WorkbenchResultCard[];
  activeLayers?: WorkbenchLayerId[];
  providerWarnings?: string[];
};
