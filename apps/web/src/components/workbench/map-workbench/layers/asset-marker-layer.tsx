"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";
import type {
  WorkbenchLayerId,
  WorkbenchSelection,
  WorkbenchSelectionType,
} from "../types";
import { cn } from "@/lib/utils";

export type WorkbenchMapAsset = {
  id: string;
  type: WorkbenchSelectionType;
  layerId: WorkbenchLayerId;
  label: string;
  latitude: number;
  longitude: number;
  subtitle?: string;
  metric?: string;
  metadata?: Record<string, unknown>;
};

export type AssetMarkerLayerProps = {
  assets: WorkbenchMapAsset[];
  visible?: boolean;
  selectedAsset?: WorkbenchSelection | null;
  onSelectAsset?: (selection: WorkbenchSelection) => void;
};

const ASSET_STYLE: Record<
  WorkbenchSelectionType,
  { fill: string; ring: string; shortLabel: string }
> = {
  route: { fill: "bg-slate-700", ring: "ring-slate-200", shortLabel: "RT" },
  charger: { fill: "bg-emerald-600", ring: "ring-emerald-200", shortLabel: "E" },
  parking: { fill: "bg-amber-600", ring: "ring-amber-200", shortLabel: "P" },
  poi: { fill: "bg-sky-600", ring: "ring-sky-200", shortLabel: "POI" },
  "fleet-yard": { fill: "bg-indigo-700", ring: "ring-indigo-200", shortLabel: "YD" },
  highway: { fill: "bg-zinc-700", ring: "ring-zinc-200", shortLabel: "HW" },
  "geo-region": { fill: "bg-cyan-700", ring: "ring-cyan-200", shortLabel: "RG" },
  "class8-gap": { fill: "bg-rose-600", ring: "ring-rose-200", shortLabel: "GAP" },
  carrier: { fill: "bg-violet-700", ring: "ring-violet-200", shortLabel: "CAR" },
  "freight-flow": { fill: "bg-orange-700", ring: "ring-orange-200", shortLabel: "FL" },
  "caas-zone": { fill: "bg-lime-700", ring: "ring-lime-200", shortLabel: "CaaS" },
};

function markerTone(asset: WorkbenchMapAsset) {
  if (asset.type === "class8-gap" && asset.metadata?.classification === "detour-solvable") {
    return { fill: "bg-amber-600", ring: "ring-amber-200", shortLabel: "DTR" };
  }
  if (asset.type === "caas-zone" && asset.metadata?.priority === "high") {
    return { fill: "bg-rose-700", ring: "ring-rose-200", shortLabel: "MOB" };
  }
  return ASSET_STYLE[asset.type];
}

function assetToSelection(asset: WorkbenchMapAsset): WorkbenchSelection {
  return {
    id: asset.id,
    type: asset.type,
    label: asset.label,
    layerId: asset.layerId,
    latitude: asset.latitude,
    longitude: asset.longitude,
    metadata: {
      ...asset.metadata,
      subtitle: asset.subtitle,
      metric: asset.metric,
    },
  };
}

function hasValidPosition(asset: WorkbenchMapAsset): boolean {
  return (
    typeof asset.latitude === "number" &&
    typeof asset.longitude === "number" &&
    Number.isFinite(asset.latitude) &&
    Number.isFinite(asset.longitude) &&
    Math.abs(asset.latitude) <= 90 &&
    Math.abs(asset.longitude) <= 180
  );
}

export function AssetMarkerLayer({
  assets,
  visible = true,
  selectedAsset,
  onSelectAsset,
}: AssetMarkerLayerProps) {
  if (!visible) {
    return null;
  }

  return (
    <>
      {assets.filter(hasValidPosition).map((asset) => {
        const style = markerTone(asset);
        const isSelected = selectedAsset?.id === asset.id && selectedAsset.type === asset.type;

        return (
          <AdvancedMarker
            key={`${asset.type}-${asset.id}`}
            position={{ lat: asset.latitude, lng: asset.longitude }}
            title={asset.label}
            onClick={() => onSelectAsset?.(assetToSelection(asset))}
            zIndex={isSelected ? 40 : 20}
          >
            <span className="relative flex h-10 w-10 items-center justify-center">
              {isSelected ? (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 animate-ping rounded-full opacity-40",
                      style.fill,
                    )}
                  />
                  <span
                    aria-hidden
                    className="absolute inset-[-3px] animate-pulse rounded-full border-2 border-[var(--fv-blueprint-blue)]/80"
                  />
                </>
              ) : null}
              <button
                type="button"
                data-testid="workbench-asset-marker"
                data-asset-id={asset.id}
                data-asset-type={asset.type}
                data-layer-id={asset.layerId}
                data-selected={isSelected ? "true" : "false"}
                className={cn(
                  "relative z-10 flex min-h-8 min-w-8 items-center justify-center rounded-full border-2 border-white px-2 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-lg transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]",
                  style.fill,
                  isSelected ? `ring-4 ${style.ring} scale-110` : "ring-0",
                )}
                aria-label={isSelected ? `Deselect ${asset.label}` : `Select ${asset.label}`}
                aria-pressed={isSelected}
              >
                <span>{style.shortLabel}</span>
                {asset.metric ? (
                  <span className="pointer-events-none absolute left-1/2 top-full mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-white px-2 py-1 text-[10px] font-bold normal-case tracking-normal text-[var(--fv-graphite)] shadow-md group-hover:block">
                    {asset.metric}
                  </span>
                ) : null}
              </button>
            </span>
          </AdvancedMarker>
        );
      })}
    </>
  );
}
