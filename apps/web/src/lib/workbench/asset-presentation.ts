import type { WorkbenchMapAsset } from "@/components/workbench/map-workbench/layers/asset-marker-layer";
import type { WorkbenchSelection } from "@/components/workbench/map-workbench/types";

export type MarkerIcon = "bolt" | "fuel" | "text";

export type AssetMarkerPresentation = {
  fill: string;
  ring: string;
  label: string;
  icon: MarkerIcon;
  title: string;
};

type CardRow = { label: string; value: string };
type CardPillGroup = { label: string; values: string[] };

export type AssetCardViewModel = {
  eyebrow: string;
  rows: CardRow[];
  pillGroups: CardPillGroup[];
};

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return null;
}

function normalizedPoiType(metadata: Record<string, unknown> | undefined): string {
  return String(metadata?.kind ?? metadata?.type ?? "poi")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_");
}

function isVerifiedClass8(metadata: Record<string, unknown> | undefined): boolean {
  return (
    metadata?.isClass8Capable === true &&
    metadata?.trailerFriendly === true &&
    (metadata?.class8Verified === true || Boolean(metadata?.dateLastConfirmed))
  );
}

export function assetMarkerPresentation(
  asset: Pick<WorkbenchMapAsset, "type" | "metadata">,
): AssetMarkerPresentation {
  if (asset.type === "charger") {
    if (asset.metadata?.isClass8Capable !== true) {
      return {
        fill: "bg-red-700",
        ring: "ring-red-200",
        label: "",
        icon: "bolt",
        title: "Not Class 8 friendly",
      };
    }
    if (isVerifiedClass8(asset.metadata)) {
      return {
        fill: "bg-emerald-700",
        ring: "ring-emerald-200",
        label: "",
        icon: "bolt",
        title: "Verified Class 8 and trailer friendly",
      };
    }
    return {
      fill: "bg-amber-600",
      ring: "ring-amber-200",
      label: "",
      icon: "bolt",
      title: "Class 8 unverified or trailer access unknown",
    };
  }

  if (asset.type === "poi") {
    const kind = normalizedPoiType(asset.metadata);
    if (kind === "traffic_generator") {
      return { fill: "bg-sky-700", ring: "ring-sky-200", label: "TG", icon: "text", title: "Traffic generator" };
    }
    if (kind === "fast_food") {
      return { fill: "bg-orange-600", ring: "ring-orange-200", label: "FF", icon: "text", title: "Fast food" };
    }
    if (kind === "fuel" || kind === "gas_station") {
      return { fill: "bg-rose-700", ring: "ring-rose-200", label: "", icon: "fuel", title: "Fuel" };
    }
    if (kind === "rest_area") {
      return { fill: "bg-teal-700", ring: "ring-teal-200", label: "RA", icon: "text", title: "Rest area" };
    }
    if (kind === "truck_parking" || kind === "truck_stop") {
      return { fill: "bg-amber-700", ring: "ring-amber-200", label: "TP", icon: "text", title: "Truck parking" };
    }
    if (kind === "convenience") {
      return { fill: "bg-violet-700", ring: "ring-violet-200", label: "CV", icon: "text", title: "Convenience" };
    }
    return { fill: "bg-slate-700", ring: "ring-slate-200", label: "POI", icon: "text", title: "Point of interest" };
  }

  const defaults: Record<WorkbenchMapAsset["type"], AssetMarkerPresentation> = {
    route: { fill: "bg-slate-700", ring: "ring-slate-200", label: "RT", icon: "text", title: "Route" },
    charger: { fill: "bg-amber-600", ring: "ring-amber-200", label: "", icon: "bolt", title: "Charger" },
    parking: { fill: "bg-amber-700", ring: "ring-amber-200", label: "P", icon: "text", title: "Parking" },
    poi: { fill: "bg-sky-700", ring: "ring-sky-200", label: "POI", icon: "text", title: "Point of interest" },
    "fleet-yard": { fill: "bg-indigo-700", ring: "ring-indigo-200", label: "YD", icon: "text", title: "Fleet yard" },
    highway: { fill: "bg-zinc-700", ring: "ring-zinc-200", label: "HW", icon: "text", title: "Highway" },
    "geo-region": { fill: "bg-cyan-700", ring: "ring-cyan-200", label: "RG", icon: "text", title: "Geographic region" },
    "class8-gap": { fill: "bg-rose-700", ring: "ring-rose-200", label: "GAP", icon: "text", title: "Class 8 charging gap" },
    carrier: { fill: "bg-violet-700", ring: "ring-violet-200", label: "CAR", icon: "text", title: "Carrier" },
    "freight-flow": { fill: "bg-orange-700", ring: "ring-orange-200", label: "FL", icon: "text", title: "Freight flow" },
    "caas-zone": { fill: "bg-lime-700", ring: "ring-lime-200", label: "CaaS", icon: "text", title: "Charging-as-a-Service zone" },
  };
  return defaults[asset.type];
}

function asPills(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
          if (Array.isArray(entry)) return entry.map((item) => `${key}: ${String(item)}`);
          return entry === false || entry == null ? [] : [`${key}: ${String(entry)}`];
        })
      : typeof value === "string"
        ? value.split(/[;,|]/)
        : [];
  return [...new Set(raw.map((item) => String(item).trim().replaceAll("_", " ").toUpperCase()).filter(Boolean))];
}

function connectorInventory(metadata: Record<string, unknown>): number | null {
  const connectors = metadata.connectors;
  if (Array.isArray(connectors)) {
    return connectors.reduce<number>((sum, connector) => {
      if (connector && typeof connector === "object") {
        const portCount = (connector as Record<string, unknown>).port_count;
        if (typeof portCount === "number" && Number.isFinite(portCount)) return sum + portCount;
      }
      return sum + 1;
    }, 0);
  }
  if (connectors && typeof connectors === "object") {
    const entries = Object.values(connectors as Record<string, unknown>);
    const total = entries.reduce<number>((sum, entry) => {
      if (Array.isArray(entry)) return sum + entry.length;
      if (typeof entry === "number" && Number.isFinite(entry)) return sum + entry;
      return sum + (entry == null || entry === false ? 0 : 1);
    }, 0);
    if (total > 0) return total;
  }
  return typeof metadata.evDcFastNum === "number" && Number.isFinite(metadata.evDcFastNum)
    ? metadata.evDcFastNum
    : null;
}

function connectorPills(value: unknown): string[] {
  if (!Array.isArray(value)) return asPills(value);
  const totals = new Map<string, number>();
  const fallback: string[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const nested = record.connectors;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      for (const [type, config] of Object.entries(nested as Record<string, unknown>)) {
        if (!config || typeof config !== "object") continue;
        const count = (config as Record<string, unknown>).port_count;
        if (typeof count === "number" && count > 0) totals.set(type, (totals.get(type) ?? 0) + count);
      }
    } else if (typeof record.type === "string") {
      fallback.push(humanizeTag(record.type));
    }
  }
  if (totals.size > 0) return [...totals].map(([type, count]) => `${humanizeTag(type)} ×${count}`);
  return [...new Set(fallback)];
}

function humanizeTag(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ").trim().toUpperCase();
}

function tagPills(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return asPills(value);
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    const keyLabel = humanizeTag(key);
    if (entry === true) return [keyLabel];
    const entryLabel = stringValue(entry);
    return entryLabel ? [humanizeTag(entryLabel)] : [];
  });
}

export function assetCardViewModel(selection: WorkbenchSelection): AssetCardViewModel {
  const metadata = selection.metadata ?? {};

  if (selection.type === "route") {
    return {
      eyebrow: "Verified road route",
      rows: [
        ...(stringValue(metadata.provider) ? [{ label: "Routing provider", value: stringValue(metadata.provider)! }] : []),
        ...(stringValue(metadata.road) ? [{ label: "Road distance", value: stringValue(metadata.road)! }] : []),
        ...(stringValue(metadata.traffic) ? [{ label: "Truck traffic", value: stringValue(metadata.traffic)! }] : []),
        ...(stringValue(metadata.charging) ? [{ label: "Class 8 charging", value: stringValue(metadata.charging)! }] : []),
        ...(stringValue(metadata.freshness) ? [{ label: "Route freshness", value: stringValue(metadata.freshness)! }] : []),
      ],
      pillGroups: [],
    };
  }

  if (selection.type === "charger") {
    const marker = assetMarkerPresentation({ type: "charger", metadata });
    const inventory = connectorInventory(metadata);
    const rows: CardRow[] = [
      { label: "Class 8 access", value: marker.title },
      ...(stringValue(metadata.powerKw) ? [{ label: "Power", value: `${stringValue(metadata.powerKw)} kW` }] : []),
      ...(inventory !== null ? [{ label: "Available plugs", value: String(inventory) }] : []),
      ...(stringValue(metadata.operator) ? [{ label: "Operator", value: stringValue(metadata.operator)! }] : []),
      ...(stringValue(metadata.statusCode) ? [{ label: "Status", value: stringValue(metadata.statusCode)! }] : []),
      ...(stringValue(metadata.accessCode) ? [{ label: "Access", value: stringValue(metadata.accessCode)! }] : []),
      ...(stringValue(metadata.dateLastConfirmed) ? [{ label: "Last verified", value: stringValue(metadata.dateLastConfirmed)! }] : []),
    ];
    return {
      eyebrow: "Charger",
      rows,
      pillGroups: [
        { label: "Connector types", values: asPills(metadata.connectorTypes) },
        { label: "Connectors", values: connectorPills(metadata.connectors) },
      ].filter((group) => group.values.length > 0),
    };
  }

  if (selection.type === "parking") {
    return {
      eyebrow: "Truck parking",
      rows: [
        ...(stringValue(metadata.numberOfSpots) ? [{ label: "Truck spaces", value: stringValue(metadata.numberOfSpots)! }] : []),
        ...(metadata.hgv === true ? [{ label: "Heavy truck access", value: "Yes" }] : []),
      ],
      pillGroups: [{ label: "Amenities", values: asPills(metadata.amenities ?? metadata.tags) }].filter((group) => group.values.length > 0),
    };
  }

  if (selection.type === "poi") {
    const kind = normalizedPoiType(metadata);
    return {
      eyebrow: kind === "traffic_generator" ? "Traffic generator" : "Point of interest",
      rows: [
        { label: "Type", value: humanizeTag(kind) },
        ...(stringValue(metadata.city) ? [{ label: "City", value: stringValue(metadata.city)! }] : []),
        ...(stringValue(metadata.county) ? [{ label: "County", value: stringValue(metadata.county)! }] : []),
        ...(stringValue(metadata.zip) ? [{ label: "ZIP", value: stringValue(metadata.zip)! }] : []),
        ...(stringValue(metadata.district) ? [{ label: "Air district", value: stringValue(metadata.district)! }] : []),
        ...(stringValue(metadata.portCode) ? [{ label: "Port", value: stringValue(metadata.portCode)! }] : []),
        ...(stringValue(metadata.osmKey) ? [{ label: "OSM source", value: stringValue(metadata.osmKey)! }] : []),
      ],
      pillGroups: [{ label: "Attributes", values: tagPills(metadata.tags) }].filter((group) => group.values.length > 0),
    };
  }

  if (selection.type === "carrier") {
    const address = [
      stringValue(metadata.address),
      [stringValue(metadata.city), stringValue(metadata.state), stringValue(metadata.zip)]
        .filter(Boolean)
        .join(" "),
    ].filter(Boolean).join(", ");
    return {
      eyebrow: "Carrier",
      rows: [
        ...(address ? [{ label: "Address", value: address }] : []),
        ...(stringValue(metadata.contactName) ? [{ label: "Contact", value: stringValue(metadata.contactName)! }] : []),
        ...(stringValue(metadata.phone) ? [{ label: "Phone", value: stringValue(metadata.phone)! }] : []),
        ...(stringValue(metadata.email) ? [{ label: "Email", value: stringValue(metadata.email)! }] : []),
        ...(stringValue(metadata.tractorCount ?? metadata.powerUnits)
          ? [{ label: "Tractors / power units", value: stringValue(metadata.tractorCount ?? metadata.powerUnits)! }]
          : []),
      ],
      pillGroups: [],
    };
  }

  const excluded = new Set(["convexId", "parkingKey", "carrierKey", "requestHash", "routeRequestHash", "source", "provenance", "subtitle", "metric", "carrierHref"]);
  const rows = Object.entries(metadata)
    .filter(([key, value]) => !excluded.has(key) && stringValue(value) !== null)
    .slice(0, 6)
    .map(([key, value]) => ({ label: humanizeTag(key), value: stringValue(value)! }));
  return { eyebrow: selection.type.replaceAll("-", " "), rows, pillGroups: [] };
}
