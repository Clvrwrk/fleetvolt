import type { WorkbenchSelection } from "@/components/workbench/map-workbench/types";

export type TrafficGeneratorPoint = {
  generatorId: string;
  name: string;
  assoc?: string;
  address?: string;
  city: string;
  county: string;
  zip: string;
  district: string;
  location: { lat: number; lng: number };
  portCode?: string;
  distanceMiles?: number;
  tier?: "low" | "medium" | "heavy";
  dailyTruckIndex?: number;
};

/** One selection contract for statewide and port-focused generator markers. */
export function trafficGeneratorSelection(
  generator: TrafficGeneratorPoint,
): WorkbenchSelection {
  return {
    id: generator.generatorId,
    type: "poi",
    label: generator.name,
    layerId: "pois",
    latitude: generator.location.lat,
    longitude: generator.location.lng,
    metadata: {
      kind: "traffic-generator",
      ...(generator.assoc ? { association: generator.assoc } : {}),
      ...(generator.address ? { address: generator.address } : {}),
      city: generator.city,
      county: generator.county,
      zip: generator.zip,
      district: generator.district,
      ...(generator.portCode ? { portCode: generator.portCode } : {}),
      ...(typeof generator.distanceMiles === "number"
        ? { distanceMiles: generator.distanceMiles }
        : {}),
      ...(generator.tier ? { tier: generator.tier } : {}),
      ...(typeof generator.dailyTruckIndex === "number"
        ? { dailyTruckIndex: generator.dailyTruckIndex }
        : {}),
      carrierHref: `/caas?view=summary&carriers=1&zip=${encodeURIComponent(generator.zip)}&city=${encodeURIComponent(generator.city)}`,
    },
  };
}
