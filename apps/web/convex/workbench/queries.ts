import { v } from "convex/values";
import { query } from "../_generated/server";

const MAX_ASSET_RESULTS = 8;

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
