import type { WorkbenchMapAsset } from "@/components/workbench/map-workbench/layers/asset-marker-layer";
import type { WorkbenchLayerId } from "@/components/workbench/map-workbench/types";

export type CaasVisiblePointLayer =
  | "chargers"
  | "parking"
  | "carriers"
  | "pois"
  | "fleet-yards"
  | "class8-gaps";

const CAAS_VISIBLE_POINT_LAYERS: readonly CaasVisiblePointLayer[] = [
  "chargers",
  "parking",
  "carriers",
  "pois",
  "fleet-yards",
  "class8-gaps",
];

type CaasVisibleAssetPayload = Partial<
  Record<
    "chargers" | "parking" | "carriers" | "pois" | "fleetYards" | "class8Gaps",
    WorkbenchMapAsset[]
  >
>;

/** Point-layer ids accepted by the CaaS bbox query. */
export function caasVisiblePointLayers(
  activeLayers: WorkbenchLayerId[],
): CaasVisiblePointLayer[] {
  return CAAS_VISIBLE_POINT_LAYERS.filter((layer) =>
    activeLayers.includes(layer),
  );
}

/** Flatten the matching Convex asset families into the shared marker contract. */
export function caasVisibleAssets(
  assets: CaasVisibleAssetPayload | undefined,
): WorkbenchMapAsset[] {
  if (!assets) return [];
  return [
    ...(assets.chargers ?? []),
    ...(assets.parking ?? []),
    ...(assets.carriers ?? []),
    ...(assets.pois ?? []),
    ...(assets.fleetYards ?? []),
    ...(assets.class8Gaps ?? []),
  ];
}
