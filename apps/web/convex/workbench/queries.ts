import { v } from "convex/values";
import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";

const MAX_ASSET_RESULTS = 8;
const DEFAULT_LAYER_LIMIT = 80;
const MAX_LAYER_LIMIT = 200;
const MAX_HIGHWAY_RESULTS = 120;
const MAX_GEO_REGION_RESULTS = 100;
const MAX_ROUTE_POINTS = 80;

type AssetKind = "port" | "charger" | "carrier" | "parking" | "poi" | "fleet-yard";

type AssetSuggestion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  kind: AssetKind;
  source: "fleetvolt";
  sourceTable: "ports" | "chargers" | "carriers" | "parking" | "pois" | "fleetParkingLots";
  description?: string;
  metadata?: Record<string, unknown>;
};

type WorkbenchMode = "driver_day_plan" | "fleet_contract_plan" | "caas_gap_map";

type WorkbenchLayerId =
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

type WorkbenchSelectionType =
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

type Bbox = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

type LayerAsset = {
  id: string;
  type: WorkbenchSelectionType;
  layerId: WorkbenchLayerId;
  label: string;
  latitude: number;
  longitude: number;
  subtitle?: string;
  metric?: string;
  source: {
    kind: "fleetvolt";
    table: string;
    idField: string;
  };
  provenance?: unknown;
  metadata?: Record<string, unknown>;
};

type MetadataCard = {
  id: string;
  type: WorkbenchSelectionType;
  title: string;
  summary: string;
  severity: "info" | "success" | "warning" | "critical";
  status: "available" | "unavailable" | "deferred";
  layerId?: WorkbenchLayerId;
  selection?: {
    id: string;
    type: WorkbenchSelectionType;
    label: string;
    layerId: WorkbenchLayerId;
    latitude?: number;
    longitude?: number;
    metadata?: Record<string, unknown>;
  };
  metrics?: Record<string, number | string | null>;
  source?: {
    kind: "fleetvolt" | "deferred";
    table?: string;
    function?: string;
    note?: string;
  };
  provenance?: unknown;
  details?: Record<string, unknown>;
  unavailable?: Array<{ field: string; reason: string }>;
};

type Class8GapPayload = {
  class8WithinCorridor: number;
  closestClass8DistanceM: number | null;
  class8Chargers: unknown[];
  fiveClosestAnyClass: unknown[];
};

type HotspotReportPayload = {
  location: { lat: number; lng: number };
  radiusM: number;
  carriers: unknown[];
  parking: { count: number; totalSpots: number; parking: unknown[] };
  pois: { total: number; byType: Record<string, number>; pois: unknown[] };
  chargers: {
    fiveClosest: unknown[];
    class8WithinRadius: number;
    closestClass8DistanceM: number | null;
    class8Chargers: unknown[];
  };
  score: {
    score: number;
    method: "modeled";
    inputs: string[];
    components: unknown;
    source: "persisted" | "inline";
    hotspotId: string | null;
    title: string | null;
  };
  freightContext: {
    origin: string;
    year: number;
    rowCount: number;
    totalKtons: number;
    totalValueUSD: number;
    truckKtons: number;
    truckValueUSD: number;
  };
  whatsMissing: {
    mobileEnergyOpportunity: boolean;
    opportunityThreshold: number;
    noClass8Charging: boolean;
    noParkingCapacity: boolean;
    noCarriersInRadius: boolean;
    deferredToPhase13: unknown;
  };
};

const workbenchModeValidator = v.union(
  v.literal("driver_day_plan"),
  v.literal("fleet_contract_plan"),
  v.literal("caas_gap_map"),
);

const workbenchLayerValidator = v.union(
  v.literal("route"),
  v.literal("chargers"),
  v.literal("parking"),
  v.literal("pois"),
  v.literal("fleet-yards"),
  v.literal("highways"),
  v.literal("geo-regions"),
  v.literal("class8-gaps"),
  v.literal("carriers"),
  v.literal("freight-flow"),
  v.literal("caas-zones"),
);

const assetTypeValidator = v.union(
  v.literal("route"),
  v.literal("charger"),
  v.literal("parking"),
  v.literal("poi"),
  v.literal("fleet-yard"),
  v.literal("highway"),
  v.literal("geo-region"),
  v.literal("class8-gap"),
  v.literal("carrier"),
  v.literal("freight-flow"),
  v.literal("caas-zone"),
  v.literal("port"),
);

const bboxValidator = v.object({
  minLat: v.number(),
  minLng: v.number(),
  maxLat: v.number(),
  maxLng: v.number(),
});

const pointValidator = v.object({ lat: v.number(), lng: v.number() });

const DEFAULT_LAYERS_BY_MODE: Record<WorkbenchMode, WorkbenchLayerId[]> = {
  driver_day_plan: ["route", "chargers", "parking", "pois"],
  fleet_contract_plan: ["route", "chargers", "fleet-yards", "pois", "highways"],
  caas_gap_map: [
    "geo-regions",
    "class8-gaps",
    "carriers",
    "parking",
    "freight-flow",
    "caas-zones",
  ],
};

const DEFERRED_ROUTE_FIELDS = [
  { field: "routeGeometry", reason: "Route geometry is produced by the workbench route provider/action, not this read query." },
  { field: "detourMeters", reason: "Detour distance is not computed by this aggregation query." },
  { field: "co2Kg", reason: "CO2 impact requires physics/emissions inputs and is not computed here." },
  { field: "demandTime", reason: "Demand-by-time requires a time-series demand model and is not present in this layer payload." },
];

function normalizeSearchTerm(value: string) {
  return value.trim().toLowerCase();
}

function includesTerm(value: string | undefined | null, term: string) {
  return typeof value === "string" && value.toLowerCase().includes(term);
}

function scoreLabel(label: string, term: string) {
  const normalized = label.toLowerCase();
  if (normalized === term) return 0;
  if (normalized.startsWith(term)) return 1;
  if (normalized.includes(term)) return 2;
  return 3;
}

function sortAndCap(rows: AssetSuggestion[], term: string, limit: number) {
  return rows
    .sort((a, b) => {
      const scoreDelta = scoreLabel(a.label, term) - scoreLabel(b.label, term);
      if (scoreDelta !== 0) return scoreDelta;
      return a.label.localeCompare(b.label);
    })
    .slice(0, Math.max(1, Math.min(limit, MAX_ASSET_RESULTS)));
}

function capLimit(limit: number | undefined, fallback = DEFAULT_LAYER_LIMIT, max = MAX_LAYER_LIMIT) {
  return Math.max(1, Math.min(limit ?? fallback, max));
}

function normalizeBbox(bbox: Bbox): Bbox {
  return {
    minLat: Math.min(bbox.minLat, bbox.maxLat),
    minLng: Math.min(bbox.minLng, bbox.maxLng),
    maxLat: Math.max(bbox.minLat, bbox.maxLat),
    maxLng: Math.max(bbox.minLng, bbox.maxLng),
  };
}

function pointInBbox(location: { lat: number; lng: number } | undefined | null, bbox: Bbox) {
  if (!location) return false;
  return (
    location.lat >= bbox.minLat &&
    location.lat <= bbox.maxLat &&
    location.lng >= bbox.minLng &&
    location.lng <= bbox.maxLng
  );
}

function bboxOverlaps(rowBbox: Bbox | undefined | null, queryBbox: Bbox) {
  if (!rowBbox) return false;
  return !(
    rowBbox.maxLat < queryBbox.minLat ||
    rowBbox.minLat > queryBbox.maxLat ||
    rowBbox.maxLng < queryBbox.minLng ||
    rowBbox.minLng > queryBbox.maxLng
  );
}

function bboxCentroid(bbox: Bbox) {
  return {
    lat: (bbox.minLat + bbox.maxLat) / 2,
    lng: (bbox.minLng + bbox.maxLng) / 2,
  };
}

function bboxAsWestSouthEastNorth(bbox: Bbox): [number, number, number, number] {
  return [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat];
}

function layerSet(mode: WorkbenchMode, layers: WorkbenchLayerId[] | undefined) {
  return new Set(layers && layers.length > 0 ? layers : DEFAULT_LAYERS_BY_MODE[mode]);
}

function source(table: string, idField: string) {
  return { kind: "fleetvolt" as const, table, idField };
}

function unavailableCard(
  type: WorkbenchSelectionType,
  id: string,
  title: string,
  summary: string,
  unavailable: Array<{ field: string; reason: string }> = DEFERRED_ROUTE_FIELDS,
): MetadataCard {
  return {
    id,
    type,
    title,
    summary,
    severity: "info",
    status: "unavailable",
    source: { kind: "deferred", note: summary },
    unavailable,
  };
}

function selectionFromAsset(asset: LayerAsset) {
  return {
    id: asset.id,
    type: asset.type,
    label: asset.label,
    layerId: asset.layerId,
    latitude: asset.latitude,
    longitude: asset.longitude,
    metadata: {
      ...(asset.metadata ?? {}),
      source: asset.source,
      provenance: asset.provenance ?? null,
    },
  };
}

function cardFromAsset(asset: LayerAsset, summary: string, metrics?: Record<string, number | string | null>): MetadataCard {
  return {
    id: asset.id,
    type: asset.type,
    title: asset.label,
    summary,
    severity: "info",
    status: "available",
    layerId: asset.layerId,
    selection: selectionFromAsset(asset),
    metrics,
    source: asset.source,
    provenance: asset.provenance ?? null,
    details: asset.metadata,
    unavailable: DEFERRED_ROUTE_FIELDS,
  };
}

function chargerAsset(charger: {
  _id?: unknown;
  stationId: string;
  name?: string | null;
  location: { lat: number; lng: number };
  powerKw: number;
  operator?: string | null;
  connectorTypes: string[];
  accessCode?: string | null;
  statusCode?: string | null;
  maxVehicleClass?: "LD" | "MD" | "HD" | null;
  evDcFastNum?: number | null;
  isClass8Capable: boolean;
  isMcsCapable?: boolean | null;
  dateLastConfirmed?: string | null;
  connectors?: unknown;
  provenance?: unknown;
}): LayerAsset {
  const label = charger.name || charger.stationId;
  return {
    id: charger.stationId,
    type: "charger",
    layerId: "chargers",
    label,
    latitude: charger.location.lat,
    longitude: charger.location.lng,
    subtitle: `${charger.powerKw} kW${charger.isClass8Capable ? " · Class 8 capable" : ""}`,
    metric: `${charger.powerKw} kW`,
    source: source("chargers", "stationId"),
    provenance: charger.provenance ?? null,
    metadata: {
      stationId: charger.stationId,
      convexId: charger._id ? String(charger._id) : null,
      powerKw: charger.powerKw,
      operator: charger.operator ?? null,
      connectorTypes: charger.connectorTypes,
      accessCode: charger.accessCode ?? null,
      statusCode: charger.statusCode ?? null,
      maxVehicleClass: charger.maxVehicleClass ?? null,
      evDcFastNum: charger.evDcFastNum ?? null,
      isClass8Capable: charger.isClass8Capable,
      isMcsCapable: charger.isMcsCapable ?? null,
      dateLastConfirmed: charger.dateLastConfirmed ?? null,
      connectors: charger.connectors ?? null,
    },
  };
}

function carrierAsset(carrier: {
  _id?: unknown;
  carrierKey?: string | null;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  location?: { lat: number; lng: number } | null;
  corridorCity?: string | null;
  geocodeStatus?: string | null;
  provenance?: unknown;
}): LayerAsset | null {
  if (!carrier.location) return null;
  return {
    id: carrier.carrierKey ?? (carrier._id ? String(carrier._id) : carrier.name),
    type: "carrier",
    layerId: "carriers",
    label: carrier.name,
    latitude: carrier.location.lat,
    longitude: carrier.location.lng,
    subtitle: [carrier.city, carrier.state].filter(Boolean).join(", ") || carrier.address || "Located carrier",
    metric: "Carrier",
    source: source("carriers", carrier.carrierKey ? "carrierKey" : "_id"),
    provenance: carrier.provenance ?? null,
    metadata: {
      convexId: carrier._id ? String(carrier._id) : null,
      carrierKey: carrier.carrierKey ?? null,
      address: carrier.address ?? null,
      city: carrier.city ?? null,
      state: carrier.state ?? null,
      zip: carrier.zip ?? null,
      corridorCity: carrier.corridorCity ?? null,
      geocodeStatus: carrier.geocodeStatus ?? null,
    },
  };
}

function parkingAsset(lot: {
  _id?: unknown;
  parkingKey?: string | null;
  name?: string | null;
  location: { lat: number; lng: number };
  numberOfSpots?: number | null;
  hgv?: boolean | null;
  provenance?: unknown;
}): LayerAsset {
  const label = lot.name || lot.parkingKey || "Truck parking";
  return {
    id: lot.parkingKey ?? (lot._id ? String(lot._id) : label),
    type: "parking",
    layerId: "parking",
    label,
    latitude: lot.location.lat,
    longitude: lot.location.lng,
    subtitle: `${lot.numberOfSpots ?? "Unknown"} truck spots${lot.hgv ? " · HGV" : ""}`,
    metric: typeof lot.numberOfSpots === "number" ? `${lot.numberOfSpots} spots` : "Parking",
    source: source("parking", lot.parkingKey ? "parkingKey" : "_id"),
    provenance: lot.provenance ?? null,
    metadata: {
      convexId: lot._id ? String(lot._id) : null,
      parkingKey: lot.parkingKey ?? null,
      numberOfSpots: lot.numberOfSpots ?? null,
      hgv: lot.hgv ?? null,
    },
  };
}

function poiAsset(poi: {
  _id?: unknown;
  type: string;
  osmKey?: string | null;
  name?: string | null;
  location: { lat: number; lng: number };
  tags?: unknown;
  provenance?: unknown;
}): LayerAsset {
  const label = poi.name || poi.osmKey || poi.type.replaceAll("_", " ");
  return {
    id: poi.osmKey ?? (poi._id ? String(poi._id) : label),
    type: "poi",
    layerId: "pois",
    label,
    latitude: poi.location.lat,
    longitude: poi.location.lng,
    subtitle: poi.type.replaceAll("_", " "),
    metric: "POI",
    source: source("pois", poi.osmKey ? "osmKey" : "_id"),
    provenance: poi.provenance ?? null,
    metadata: {
      convexId: poi._id ? String(poi._id) : null,
      type: poi.type,
      osmKey: poi.osmKey ?? null,
      tags: poi.tags ?? null,
    },
  };
}

function fleetYardAsset(lot: {
  _id?: unknown;
  lotId: string;
  fleetId: string;
  name: string;
  address?: string | null;
  location: { lat: number; lng: number };
  amenities: string[];
  capacityTrucks: number;
  existingChargers?: number | null;
  chargerKw?: number | null;
  powerAvailable?: number | null;
  createdAt?: number;
}): LayerAsset {
  return {
    id: lot.lotId,
    type: "fleet-yard",
    layerId: "fleet-yards",
    label: lot.name,
    latitude: lot.location.lat,
    longitude: lot.location.lng,
    subtitle: lot.address ?? `${lot.capacityTrucks} truck capacity`,
    metric: `${lot.capacityTrucks} trucks`,
    source: source("fleetParkingLots", "lotId"),
    provenance: null,
    metadata: {
      convexId: lot._id ? String(lot._id) : null,
      lotId: lot.lotId,
      fleetId: lot.fleetId,
      address: lot.address ?? null,
      amenities: lot.amenities,
      capacityTrucks: lot.capacityTrucks,
      existingChargers: lot.existingChargers ?? null,
      chargerKw: lot.chargerKw ?? null,
      powerAvailable: lot.powerAvailable ?? null,
      createdAt: lot.createdAt ?? null,
    },
  };
}

function caasZoneAsset(zone: {
  _id?: unknown;
  zoneId: string;
  caasId: string;
  name: string;
  level: string;
  fips?: string | null;
  airDistrict?: string | null;
  zipCode?: string | null;
  centroid: { lat: number; lng: number };
  radiusM: number;
  modeledDwellScore?: number | null;
  freightFlowKtons?: number | null;
  carrierCount?: number | null;
  parkingCapacity?: number | null;
  existingChargers?: number | null;
  class8ChargerGap?: boolean | null;
  recommendedPowerKw?: number | null;
  priority?: "high" | "medium" | "low" | null;
  createdAt?: number;
}): LayerAsset {
  return {
    id: zone.zoneId,
    type: "caas-zone",
    layerId: "caas-zones",
    label: zone.name,
    latitude: zone.centroid.lat,
    longitude: zone.centroid.lng,
    subtitle: `${zone.level} deployment zone${zone.class8ChargerGap ? " · Class 8 gap" : ""}`,
    metric: zone.priority ? `${zone.priority} priority` : "CaaS zone",
    source: source("caasDeploymentZones", "zoneId"),
    provenance: null,
    metadata: {
      convexId: zone._id ? String(zone._id) : null,
      zoneId: zone.zoneId,
      caasId: zone.caasId,
      level: zone.level,
      fips: zone.fips ?? null,
      airDistrict: zone.airDistrict ?? null,
      zipCode: zone.zipCode ?? null,
      radiusM: zone.radiusM,
      modeledDwellScore: zone.modeledDwellScore ?? null,
      modeledLabel: zone.modeledDwellScore === undefined ? null : "modeled dwell score",
      freightFlowKtons: zone.freightFlowKtons ?? null,
      carrierCount: zone.carrierCount ?? null,
      parkingCapacity: zone.parkingCapacity ?? null,
      existingChargers: zone.existingChargers ?? null,
      class8ChargerGap: zone.class8ChargerGap ?? null,
      recommendedPowerKw: zone.recommendedPowerKw ?? null,
      priority: zone.priority ?? null,
      createdAt: zone.createdAt ?? null,
    },
  };
}

function geoRegionPayload(region: {
  _id?: unknown;
  fips: string;
  name: string;
  level: "nation" | "state" | "county";
  parentFips?: string | null;
  centroid?: { lat: number; lng: number } | null;
  bbox?: Bbox | null;
  aggregateScore?: number | null;
  airDistrict?: string | null;
  zipCodes?: string[] | null;
  provenance?: unknown;
}) {
  return {
    id: region.fips,
    name: region.name,
    level: region.level,
    centroid: region.centroid
      ? { latitude: region.centroid.lat, longitude: region.centroid.lng }
      : null,
    bbox: region.bbox ? bboxAsWestSouthEastNorth(region.bbox) : null,
    score: region.aggregateScore ?? null,
    source: source("geoRegions", "fips"),
    provenance: region.provenance ?? null,
    metadata: {
      convexId: region._id ? String(region._id) : null,
      fips: region.fips,
      parentFips: region.parentFips ?? null,
      aggregateScore: region.aggregateScore ?? null,
      modeledLabel: region.aggregateScore === undefined ? null : "modeled aggregate opportunity score",
      airDistrict: region.airDistrict ?? null,
      zipCodes: region.zipCodes ?? null,
    },
  };
}

function highwayAsset(segment: {
  segmentId: string;
  route: string;
  truckAADT?: number | null;
  aadt?: number | null;
  bbox: Bbox;
  path?: Array<{ lat: number; lng: number }>;
  provenance?: unknown;
}): LayerAsset {
  const centroid = segment.path && segment.path.length > 0
    ? segment.path[Math.floor(segment.path.length / 2)]!
    : bboxCentroid(segment.bbox);
  return {
    id: segment.segmentId,
    type: "highway",
    layerId: "highways",
    label: segment.route,
    latitude: centroid.lat,
    longitude: centroid.lng,
    subtitle: typeof segment.truckAADT === "number" ? `${segment.truckAADT} truck AADT` : "Truck AADT unavailable",
    metric: typeof segment.truckAADT === "number" ? `${segment.truckAADT}` : "AADT n/a",
    source: source("highwaySegments", "segmentId"),
    provenance: segment.provenance ?? null,
    metadata: {
      segmentId: segment.segmentId,
      route: segment.route,
      truckAADT: segment.truckAADT ?? null,
      aadt: segment.aadt ?? null,
      bbox: segment.bbox,
      path: segment.path ?? null,
    },
  };
}

export const searchPlaceAssets = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    fleetId: v.optional(v.string()),
  },
  handler: async (ctx, { query: rawQuery, limit, fleetId }) => {
    const term = normalizeSearchTerm(rawQuery);
    if (term.length < 2) return [];

    const [ports, chargers, carriers, parking, pois, fleetLots] = await Promise.all([
      ctx.db.query("ports").collect(),
      ctx.db.query("chargers").collect(),
      ctx.db.query("carriers").collect(),
      ctx.db.query("parking").collect(),
      ctx.db.query("pois").collect(),
      fleetId
        ? ctx.db
            .query("fleetParkingLots")
            .withIndex("by_fleetId", (q) => q.eq("fleetId", fleetId))
            .collect()
        : ctx.db.query("fleetParkingLots").collect(),
    ]);

    const rows: AssetSuggestion[] = [];

    for (const port of ports) {
      if (!includesTerm(port.name, term) && !includesTerm(port.code, term)) continue;
      rows.push({
        id: String(port._id),
        label: `${port.name} (${port.code})`,
        latitude: port.location.lat,
        longitude: port.location.lng,
        kind: "port",
        source: "fleetvolt",
        sourceTable: "ports",
        description: "FleetVolt port anchor",
        metadata: { code: port.code, annualTEU: port.annualTEU ?? null },
      });
    }

    for (const charger of chargers) {
      const label = charger.name || charger.stationId;
      if (
        !includesTerm(label, term) &&
        !includesTerm(charger.stationId, term) &&
        !includesTerm(charger.operator, term)
      ) {
        continue;
      }
      rows.push({
        id: charger.stationId,
        label,
        latitude: charger.location.lat,
        longitude: charger.location.lng,
        kind: "charger",
        source: "fleetvolt",
        sourceTable: "chargers",
        description: `${charger.powerKw} kW${charger.isClass8Capable ? " · Class 8 capable" : ""}`,
        metadata: {
          stationId: charger.stationId,
          powerKw: charger.powerKw,
          operator: charger.operator ?? null,
          isClass8Capable: charger.isClass8Capable,
          connectorTypes: charger.connectorTypes,
        },
      });
    }

    for (const carrier of carriers) {
      if (!carrier.location) continue;
      if (
        !includesTerm(carrier.name, term) &&
        !includesTerm(carrier.address, term) &&
        !includesTerm(carrier.city, term) &&
        !includesTerm(carrier.corridorCity, term)
      ) {
        continue;
      }
      rows.push({
        id: carrier.carrierKey ?? String(carrier._id),
        label: carrier.name,
        latitude: carrier.location.lat,
        longitude: carrier.location.lng,
        kind: "carrier",
        source: "fleetvolt",
        sourceTable: "carriers",
        description: [carrier.city, carrier.state].filter(Boolean).join(", ") || carrier.address,
        metadata: {
          carrierKey: carrier.carrierKey ?? null,
          address: carrier.address ?? null,
          city: carrier.city ?? null,
          corridorCity: carrier.corridorCity ?? null,
        },
      });
    }

    for (const lot of parking) {
      const label = lot.name || lot.parkingKey || "Truck parking";
      if (!includesTerm(label, term)) continue;
      rows.push({
        id: lot.parkingKey ?? String(lot._id),
        label,
        latitude: lot.location.lat,
        longitude: lot.location.lng,
        kind: "parking",
        source: "fleetvolt",
        sourceTable: "parking",
        description: `${lot.numberOfSpots ?? "Unknown"} truck spots${lot.hgv ? " · HGV" : ""}`,
        metadata: {
          parkingKey: lot.parkingKey ?? null,
          numberOfSpots: lot.numberOfSpots ?? null,
          hgv: lot.hgv ?? null,
        },
      });
    }

    for (const poi of pois) {
      const label = poi.name || poi.osmKey || poi.type.replaceAll("_", " ");
      if (!includesTerm(label, term) && !includesTerm(poi.type, term)) continue;
      rows.push({
        id: poi.osmKey ?? String(poi._id),
        label,
        latitude: poi.location.lat,
        longitude: poi.location.lng,
        kind: "poi",
        source: "fleetvolt",
        sourceTable: "pois",
        description: poi.type.replaceAll("_", " "),
        metadata: { type: poi.type, osmKey: poi.osmKey ?? null },
      });
    }

    for (const lot of fleetLots) {
      if (!includesTerm(lot.name, term) && !includesTerm(lot.address, term)) continue;
      rows.push({
        id: lot.lotId,
        label: lot.name,
        latitude: lot.location.lat,
        longitude: lot.location.lng,
        kind: "fleet-yard",
        source: "fleetvolt",
        sourceTable: "fleetParkingLots",
        description: lot.address ?? `${lot.capacityTrucks} truck capacity`,
        metadata: {
          lotId: lot.lotId,
          fleetId: lot.fleetId,
          amenities: lot.amenities,
          capacityTrucks: lot.capacityTrucks,
          existingChargers: lot.existingChargers ?? null,
        },
      });
    }

    return sortAndCap(rows, term, limit ?? MAX_ASSET_RESULTS);
  },
});

export const visibleLayers = query({
  args: {
    bbox: bboxValidator,
    mode: workbenchModeValidator,
    layers: v.optional(v.array(workbenchLayerValidator)),
    limit: v.optional(v.number()),
    fleetId: v.optional(v.string()),
  },
  handler: async (ctx, { bbox: rawBbox, mode, layers, limit, fleetId }) => {
    const bbox = normalizeBbox(rawBbox);
    const requested = layerSet(mode, layers as WorkbenchLayerId[] | undefined);
    const pointLimit = capLimit(limit);

    const [chargers, carriers, parking, pois, fleetLots, geoRegions, caasZones, highwayRows] = await Promise.all([
      requested.has("chargers") ? ctx.db.query("chargers").collect() : Promise.resolve([]),
      requested.has("carriers") ? ctx.db.query("carriers").collect() : Promise.resolve([]),
      requested.has("parking") ? ctx.db.query("parking").collect() : Promise.resolve([]),
      requested.has("pois") ? ctx.db.query("pois").collect() : Promise.resolve([]),
      requested.has("fleet-yards")
        ? fleetId
          ? ctx.db.query("fleetParkingLots").withIndex("by_fleetId", (q) => q.eq("fleetId", fleetId)).collect()
          : ctx.db.query("fleetParkingLots").collect()
        : Promise.resolve([]),
      requested.has("geo-regions") ? ctx.db.query("geoRegions").collect() : Promise.resolve([]),
      requested.has("caas-zones") ? ctx.db.query("caasDeploymentZones").collect() : Promise.resolve([]),
      requested.has("highways") || requested.has("freight-flow")
        ? ctx.runQuery(api.highways.queries.segmentsInBbox, bbox)
        : Promise.resolve([]),
    ]);

    const chargerDocs = chargers as Doc<"chargers">[];
    const carrierDocs = carriers as Doc<"carriers">[];
    const parkingDocs = parking as Doc<"parking">[];
    const poiDocs = pois as Doc<"pois">[];
    const fleetLotDocs = fleetLots as Doc<"fleetParkingLots">[];
    const geoRegionDocs = geoRegions as Doc<"geoRegions">[];
    const caasZoneDocs = caasZones as Doc<"caasDeploymentZones">[];
    const highwaySegments = highwayRows as Array<{
      segmentId: string;
      route: string;
      truckAADT?: number | null;
      aadt?: number | null;
      bbox?: Bbox;
    }>;

    const chargerAssets = chargerDocs
      .filter((doc) => pointInBbox(doc.location, bbox))
      .slice(0, pointLimit)
      .map(chargerAsset);

    const carrierAssets = carrierDocs
      .filter((doc) => pointInBbox(doc.location, bbox))
      .map(carrierAsset)
      .filter((doc): doc is LayerAsset => doc !== null)
      .slice(0, pointLimit);

    const parkingAssets = parkingDocs
      .filter((doc) => pointInBbox(doc.location, bbox))
      .slice(0, pointLimit)
      .map(parkingAsset);

    const poiAssets = poiDocs
      .filter((doc) => pointInBbox(doc.location, bbox))
      .slice(0, pointLimit)
      .map(poiAsset);

    const fleetYardAssets = fleetLotDocs
      .filter((doc) => pointInBbox(doc.location, bbox))
      .slice(0, pointLimit)
      .map(fleetYardAsset);

    const geoRegionPayloads = geoRegionDocs
      .filter((doc) => bboxOverlaps(doc.bbox ?? null, bbox) || pointInBbox(doc.centroid ?? null, bbox))
      .slice(0, capLimit(limit, MAX_GEO_REGION_RESULTS, MAX_GEO_REGION_RESULTS))
      .map(geoRegionPayload);

    const caasZoneAssets = caasZoneDocs
      .filter((doc) => pointInBbox(doc.centroid, bbox))
      .slice(0, pointLimit)
      .map(caasZoneAsset);
    const highwayAssets = highwaySegments
      .slice(0, capLimit(limit, MAX_HIGHWAY_RESULTS, MAX_HIGHWAY_RESULTS))
      .map((segment) => highwayAsset({ ...segment, bbox }));

    const unavailable: MetadataCard[] = [];
    if (requested.has("class8-gaps")) {
      unavailable.push(
        unavailableCard(
          "class8-gap",
          "class8-gaps-route-required",
          "Class 8 gap analysis needs route points",
          "Provide corridor points to analyzeClass8GapAlongRoute; this bbox layer does not fabricate a route.",
          [
            { field: "corridorPoints", reason: "Missing route/corridor geometry." },
            { field: "detourMeters", reason: "Detour distance is not computed without a route provider result." },
            { field: "co2Kg", reason: "CO2 impact requires physics/emissions inputs." },
            { field: "demandTime", reason: "No demand time-series is attached to bbox-only gap markers." },
          ],
        ),
      );
    }
    if (requested.has("freight-flow")) {
      unavailable.push(
        unavailableCard(
          "freight-flow",
          "freight-flow-time-unavailable",
          "Freight flow time series unavailable",
          "Highway truck AADT can be shown, but demand-by-time is not present in this aggregation payload.",
          [{ field: "demandTime", reason: "FAF/Caltrans layers here are aggregate/model inputs, not live time-series demand." }],
        ),
      );
    }

    return {
      mode,
      bbox,
      requestedLayers: [...requested],
      caps: {
        points: pointLimit,
        highways: capLimit(limit, MAX_HIGHWAY_RESULTS, MAX_HIGHWAY_RESULTS),
        geoRegions: capLimit(limit, MAX_GEO_REGION_RESULTS, MAX_GEO_REGION_RESULTS),
      },
      assets: {
        chargers: chargerAssets,
        carriers: carrierAssets,
        parking: parkingAssets,
        pois: poiAssets,
        fleetYards: fleetYardAssets,
        caasZones: caasZoneAssets,
        highways: highwayAssets,
      },
      geoRegions: geoRegionPayloads,
      unavailable,
      source: {
        kind: "fleetvolt",
        query: "workbench/queries:visibleLayers",
        wrappedSurfaces: [
          "chargers",
          "carriers",
          "parking",
          "pois",
          "fleetParkingLots",
          "geoRegions",
          "caasDeploymentZones",
          "highways/queries:segmentsInBbox",
        ],
      },
    };
  },
});

export const getAssetMetadataCard = query({
  args: {
    type: assetTypeValidator,
    id: v.string(),
  },
  handler: async (ctx, { type, id }): Promise<MetadataCard> => {
    if (type === "charger") {
      const doc = await ctx.db.query("chargers").withIndex("by_stationId", (q) => q.eq("stationId", id)).first();
      if (!doc) return unavailableCard("charger", id, "Charger unavailable", "No charger was found for this station id.", [{ field: "charger", reason: "Not found in chargers by stationId." }]);
      const asset = chargerAsset(doc);
      return cardFromAsset(asset, `${asset.subtitle}. Source and connector metadata are from FleetVolt charger data.`, {
        powerKw: doc.powerKw,
        class8Capable: doc.isClass8Capable ? "yes" : "no",
        evDcFastNum: doc.evDcFastNum ?? null,
      });
    }

    if (type === "carrier") {
      const byKey = await ctx.db.query("carriers").withIndex("by_carrierKey", (q) => q.eq("carrierKey", id)).first();
      const doc = byKey ?? (await ctx.db.query("carriers").collect()).find((row) => String(row._id) === id) ?? null;
      if (!doc) return unavailableCard("carrier", id, "Carrier unavailable", "No carrier was found for this id.", [{ field: "carrier", reason: "Not found in carriers by carrierKey/_id." }]);
      const asset = carrierAsset(doc);
      if (!asset) return unavailableCard("carrier", id, doc.name, "Carrier exists but has no geocoded location yet.", [{ field: "location", reason: "Carrier geocoding unavailable/deferred." }]);
      return cardFromAsset(asset, asset.subtitle ?? "Located carrier from FleetVolt carrier registry.", {
        geocoded: doc.location ? "yes" : "no",
      });
    }

    if (type === "parking") {
      const byKey = await ctx.db.query("parking").withIndex("by_parkingKey", (q) => q.eq("parkingKey", id)).first();
      const doc = byKey ?? (await ctx.db.query("parking").collect()).find((row) => String(row._id) === id) ?? null;
      if (!doc) return unavailableCard("parking", id, "Parking unavailable", "No parking site was found for this id.", [{ field: "parking", reason: "Not found in parking by parkingKey/_id." }]);
      const asset = parkingAsset(doc);
      return cardFromAsset(asset, asset.subtitle ?? "Truck parking site from FleetVolt parking data.", {
        numberOfSpots: doc.numberOfSpots ?? null,
        hgv: doc.hgv === undefined ? null : doc.hgv ? "yes" : "no",
      });
    }

    if (type === "poi") {
      const byKey = await ctx.db.query("pois").withIndex("by_osmKey", (q) => q.eq("osmKey", id)).first();
      const doc = byKey ?? (await ctx.db.query("pois").collect()).find((row) => String(row._id) === id) ?? null;
      if (!doc) return unavailableCard("poi", id, "POI unavailable", "No POI was found for this id.", [{ field: "poi", reason: "Not found in pois by osmKey/_id." }]);
      const asset = poiAsset(doc);
      return cardFromAsset(asset, asset.subtitle ?? "FleetVolt OSM amenity point.", { type: doc.type });
    }

    if (type === "fleet-yard") {
      const doc = await ctx.db.query("fleetParkingLots").withIndex("by_lotId", (q) => q.eq("lotId", id)).first();
      if (!doc) return unavailableCard("fleet-yard", id, "Fleet yard unavailable", "No fleet yard was found for this lot id.", [{ field: "fleet-yard", reason: "Not found in fleetParkingLots by lotId." }]);
      const asset = fleetYardAsset(doc);
      return cardFromAsset(asset, asset.subtitle ?? "Fleet yard from FleetVolt fleet data.", {
        capacityTrucks: doc.capacityTrucks,
        existingChargers: doc.existingChargers ?? null,
        chargerKw: doc.chargerKw ?? null,
      });
    }

    if (type === "geo-region") {
      const doc = await ctx.db.query("geoRegions").withIndex("by_fips", (q) => q.eq("fips", id)).first();
      if (!doc) return unavailableCard("geo-region", id, "Geo region unavailable", "No geo region was found for this FIPS id.", [{ field: "geo-region", reason: "Not found in geoRegions by fips." }]);
      return {
        id: doc.fips,
        type: "geo-region",
        title: doc.name,
        summary: doc.aggregateScore === undefined
          ? "Geographic region; modeled aggregate score is unavailable."
          : "Geographic region with modeled aggregate opportunity score.",
        severity: "info",
        status: "available",
        layerId: "geo-regions",
        selection: {
          id: doc.fips,
          type: "geo-region",
          label: doc.name,
          layerId: "geo-regions",
          latitude: doc.centroid?.lat,
          longitude: doc.centroid?.lng,
          metadata: geoRegionPayload(doc).metadata,
        },
        metrics: { aggregateScore: doc.aggregateScore ?? null },
        source: source("geoRegions", "fips"),
        provenance: doc.provenance ?? null,
        details: geoRegionPayload(doc),
        unavailable: DEFERRED_ROUTE_FIELDS,
      };
    }

    if (type === "highway") {
      const doc = await ctx.db.query("highwaySegments").withIndex("by_segmentId", (q) => q.eq("segmentId", id)).first();
      if (!doc) return unavailableCard("highway", id, "Highway segment unavailable", "No highway segment was found for this segment id.", [{ field: "highway", reason: "Not found in highwaySegments by segmentId." }]);
      const asset = highwayAsset(doc);
      return cardFromAsset(asset, asset.subtitle ?? "Freight highway segment from FleetVolt highway data.", {
        truckAADT: doc.truckAADT ?? null,
        aadt: doc.aadt ?? null,
      });
    }

    if (type === "caas-zone") {
      const doc = await ctx.db.query("caasDeploymentZones").withIndex("by_zoneId", (q) => q.eq("zoneId", id)).first();
      if (!doc) return unavailableCard("caas-zone", id, "CaaS zone unavailable", "No CaaS deployment zone was found for this zone id.", [{ field: "caas-zone", reason: "Not found in caasDeploymentZones by zoneId." }]);
      const asset = caasZoneAsset(doc);
      return cardFromAsset(asset, asset.subtitle ?? "CaaS deployment opportunity zone.", {
        modeledDwellScore: doc.modeledDwellScore ?? null,
        carrierCount: doc.carrierCount ?? null,
        class8ChargerGap: doc.class8ChargerGap === undefined ? null : doc.class8ChargerGap ? "yes" : "no",
        recommendedPowerKw: doc.recommendedPowerKw ?? null,
      });
    }

    if (type === "port") {
      const doc = (await ctx.db.query("ports").collect()).find((row) => String(row._id) === id || row.code === id) ?? null;
      if (!doc) return unavailableCard("route", id, "Port unavailable", "No port was found for this id/code.", [{ field: "port", reason: "Not found in ports by _id/code." }]);
      const asset: LayerAsset = {
        id: String(doc._id),
        type: "route",
        layerId: "route",
        label: `${doc.name} (${doc.code})`,
        latitude: doc.location.lat,
        longitude: doc.location.lng,
        subtitle: "FleetVolt port anchor",
        metric: doc.annualTEU ? `${doc.annualTEU} TEU` : "Port",
        source: source("ports", "_id/code"),
        provenance: doc.provenance ?? null,
        metadata: { code: doc.code, annualTEU: doc.annualTEU ?? null, metrics: doc.metrics ?? null },
      };
      return cardFromAsset(asset, "FleetVolt port anchor; route and detour metrics are not computed by metadata cards.", { annualTEU: doc.annualTEU ?? null });
    }

    return unavailableCard(
      type === "class8-gap" || type === "freight-flow" || type === "route" ? type : "route",
      id,
      "Metadata card unavailable",
      "This selection type is derived from route/workbench state and has no persisted row to fetch directly.",
    );
  },
});

export const analyzeClass8GapAlongRoute = query({
  args: {
    corridorPoints: v.array(pointValidator),
    radiusM: v.number(),
  },
  handler: async (ctx, { corridorPoints, radiusM }) => {
    if (corridorPoints.length === 0) {
      return {
        status: "unavailable" as const,
        summary: "Class 8 gap analysis requires at least one corridor point.",
        gap: null,
        cards: [
          unavailableCard(
            "class8-gap",
            "class8-gap-route-required",
            "Route required for Class 8 gap analysis",
            "No route/corridor geometry was provided; the workbench will not fabricate a gap marker.",
            [{ field: "corridorPoints", reason: "Missing corridor points." }, ...DEFERRED_ROUTE_FIELDS],
          ),
        ],
      };
    }

    const sampled = corridorPoints.slice(0, MAX_ROUTE_POINTS);
    const gap = (await ctx.runQuery(api.chargers.queries.class8Gap, {
      corridorPoints: sampled,
      radiusM,
    })) as Class8GapPayload;

    const hasGap = gap.class8WithinCorridor === 0;
    const cards: MetadataCard[] = [
      {
        id: "class8-gap-summary",
        type: "class8-gap",
        title: hasGap ? "True Class 8 charging gap" : "Class 8 chargers found on corridor",
        summary: hasGap
          ? "No Class 8-capable chargers were found within the requested radius of the supplied corridor points."
          : `${gap.class8WithinCorridor} Class 8-capable charger(s) were found within the requested corridor radius.`,
        severity: hasGap ? "warning" : "success",
        status: "available",
        layerId: "class8-gaps",
        metrics: {
          class8WithinCorridor: gap.class8WithinCorridor,
          closestClass8DistanceM: gap.closestClass8DistanceM ?? null,
          radiusM,
          sampledPoints: sampled.length,
        },
        source: { kind: "fleetvolt", function: "chargers/queries:class8Gap" },
        details: {
          class8Chargers: gap.class8Chargers,
          fiveClosestAnyClass: gap.fiveClosestAnyClass,
        },
        unavailable: [
          { field: "detourMeters", reason: "Detour distance is not computed by class8Gap." },
          { field: "co2Kg", reason: "CO2 impact requires physics/emissions inputs." },
          { field: "demandTime", reason: "Demand-by-time is not provided by charger-gap analysis." },
        ],
      },
    ];

    return {
      status: "available" as const,
      radiusM,
      sampledPoints: sampled.length,
      source: { kind: "fleetvolt", function: "chargers/queries:class8Gap" },
      gap,
      cards,
      deferred: {
        routeGeometry: sampled.length < corridorPoints.length ? "corridor was capped for query payload size" : null,
        detourMeters: "deferred — requires route provider detour computation",
        co2Kg: "deferred — requires physics/emissions computation",
        demandTime: "deferred — no time-series demand model in this query",
      },
    };
  },
});

export const hotspotReport = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
    hotspotId: v.optional(v.id("hotspots")),
    fafYear: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const report = (await ctx.runQuery(api.report.hotspotReport, args)) as HotspotReportPayload;
    return {
      status: "available" as const,
      source: { kind: "fleetvolt", function: "report:hotspotReport" },
      report,
      cards: [
        {
          id: "hotspot-report-summary",
          type: "class8-gap" as const,
          title: report.whatsMissing.mobileEnergyOpportunity
            ? "Mobile energy opportunity"
            : "Hotspot report",
          summary: report.whatsMissing.mobileEnergyOpportunity
            ? "Modeled demand is above threshold and no in-radius Class 8 charging was found."
            : "CaaS hotspot report generated from carriers, parking, POIs, chargers, score, and freight context.",
          severity: report.whatsMissing.mobileEnergyOpportunity ? "warning" as const : "info" as const,
          status: "available" as const,
          layerId: "class8-gaps" as const,
          metrics: {
            score: report.score.score,
            class8WithinRadius: report.chargers.class8WithinRadius,
            closestClass8DistanceM: report.chargers.closestClass8DistanceM ?? null,
            carrierCount: report.carriers.length,
            parkingSpots: report.parking.totalSpots,
            truckKtons: report.freightContext.truckKtons,
          },
          source: { kind: "fleetvolt" as const, function: "report:hotspotReport" },
          provenance: {
            scoreMethod: report.score.method,
            scoreSource: report.score.source,
            scoreInputs: report.score.inputs,
          },
          details: {
            location: report.location,
            radiusM: report.radiusM,
            whatsMissing: report.whatsMissing,
            freightContext: report.freightContext,
          },
          unavailable: [
            { field: "detourMeters", reason: "hotspotReport explicitly defers detour cost to routing/physics." },
            { field: "co2Kg", reason: "hotspotReport explicitly defers environmental benefit to physics/emissions." },
            { field: "demandTime", reason: "hotspotReport returns modeled demand proxies, not demand-by-time." },
          ],
        },
      ],
    };
  },
});
