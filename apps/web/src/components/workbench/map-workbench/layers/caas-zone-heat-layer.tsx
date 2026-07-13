"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import type { WorkbenchMapAsset } from "./asset-marker-layer";
import type { WorkbenchSelection } from "../types";

type Props = {
  assets: WorkbenchMapAsset[];
  visible: boolean;
  onSelectAsset?: (selection: WorkbenchSelection) => void;
};

function heatColor(asset: WorkbenchMapAsset): string {
  if (asset.metadata?.priority === "high") return "#c62828";
  if (asset.metadata?.priority === "medium") return "#f59e0b";
  return "#16a34a";
}

/** Radius-backed opportunity surface; GAP pins remain a separate discrete layer. */
export function CaasZoneHeatLayer({ assets, visible, onSelectAsset }: Props) {
  const map = useMap();
  const circlesRef = useRef<google.maps.Circle[]>([]);

  useEffect(() => {
    for (const circle of circlesRef.current) circle.setMap(null);
    circlesRef.current = [];
    if (!map || !visible) return;

    const circles = assets.map((asset) => {
      const color = heatColor(asset);
      const radius = typeof asset.metadata?.radiusM === "number"
        ? Math.max(4_000, asset.metadata.radiusM)
        : 16_093;
      const circle = new google.maps.Circle({
        map,
        center: { lat: asset.latitude, lng: asset.longitude },
        radius,
        clickable: true,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.28,
        zIndex: 8,
      });
      circle.addListener("click", () => {
        onSelectAsset?.({
          id: asset.id,
          type: asset.type,
          label: asset.label,
          layerId: asset.layerId,
          latitude: asset.latitude,
          longitude: asset.longitude,
          metadata: asset.metadata,
        });
      });
      return circle;
    });
    circlesRef.current = circles;
    return () => {
      for (const circle of circles) circle.setMap(null);
    };
  }, [assets, map, onSelectAsset, visible]);

  return null;
}
