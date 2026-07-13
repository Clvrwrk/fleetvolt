"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";
import type {
  WorkbenchLayerId,
  WorkbenchSelection,
  WorkbenchSelectionType,
} from "../types";
import { Fuel, Zap } from "lucide-react";
import { assetMarkerPresentation } from "@/lib/workbench/asset-presentation";
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
  onSelectAsset?: (selection: WorkbenchSelection | null) => void;
};

function markerTone(asset: WorkbenchMapAsset) {
  if (asset.type === "class8-gap" && asset.metadata?.classification === "detour-solvable") {
    return { ...assetMarkerPresentation(asset), fill: "bg-amber-600", ring: "ring-amber-200", label: "DTR" };
  }
  if (asset.type === "caas-zone" && asset.metadata?.priority === "high") {
    return { ...assetMarkerPresentation(asset), fill: "bg-rose-700", ring: "ring-rose-200", label: "MOB" };
  }
  return assetMarkerPresentation(asset);
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
            title={`${asset.label} · ${style.title}`}
            onClick={() => onSelectAsset?.(assetToSelection(asset))}
            zIndex={isSelected ? 40 : 20}
          >
            <span className="relative flex h-11 w-11 items-center justify-center">
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
                  "relative z-10 flex h-11 min-w-11 items-center justify-center rounded-full border-2 border-white px-2 text-base font-black uppercase tracking-[0.04em] text-white shadow-lg transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]",
                  style.fill,
                  isSelected ? `ring-4 ${style.ring} scale-110` : "ring-0",
                )}
                aria-label={isSelected ? `Deselect ${asset.label}` : `Select ${asset.label}`}
                aria-pressed={isSelected}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  onSelectAsset?.(null);
                }}
              >
                {style.icon === "bolt" ? <Zap size={23} strokeWidth={3} aria-hidden /> : null}
                {style.icon === "fuel" ? <Fuel size={22} strokeWidth={2.5} aria-hidden /> : null}
                {style.icon === "text" ? <span>{style.label}</span> : null}
                {asset.metric ? (
                  <span className="pointer-events-none absolute left-1/2 top-full mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-white px-2 py-1 text-base font-bold normal-case tracking-normal text-[var(--fv-graphite)] shadow-md group-hover:block">
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
