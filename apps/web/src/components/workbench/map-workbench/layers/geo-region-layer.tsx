"use client";

import { useEffect, useMemo, useRef } from "react";
import { AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import type { WorkbenchSelection } from "../types";
import { cn } from "@/lib/utils";

export type WorkbenchGeoRegion = {
  id: string;
  name: string;
  level: "nation" | "state" | "county" | "air-district" | "zip" | "city" | "custom";
  centroid?: { latitude: number; longitude: number } | null;
  bbox?: google.maps.LatLngBoundsLiteral | [number, number, number, number] | null;
  score?: number | null;
  metadata?: Record<string, unknown>;
};

export type GeoRegionLayerProps = {
  regions: WorkbenchGeoRegion[];
  visible?: boolean;
  selectedAsset?: WorkbenchSelection | null;
  onSelectRegion?: (selection: WorkbenchSelection) => void;
};

function bboxToBounds(
  bbox: WorkbenchGeoRegion["bbox"],
): google.maps.LatLngBoundsLiteral | null {
  if (!bbox) {
    return null;
  }

  if (Array.isArray(bbox)) {
    const [west, south, east, north] = bbox;
    return { north, south, east, west };
  }

  return bbox;
}

function scoreTone(score: number | null | undefined) {
  if (typeof score !== "number") {
    return { fill: "bg-slate-600", stroke: "#64748b", tint: "rgba(100,116,139,0.12)" };
  }
  if (score >= 0.75) {
    return { fill: "bg-rose-600", stroke: "#e11d48", tint: "rgba(225,29,72,0.16)" };
  }
  if (score >= 0.45) {
    return { fill: "bg-amber-600", stroke: "#d97706", tint: "rgba(217,119,6,0.14)" };
  }
  return { fill: "bg-emerald-600", stroke: "#059669", tint: "rgba(5,150,105,0.12)" };
}

function regionToSelection(region: WorkbenchGeoRegion): WorkbenchSelection {
  return {
    id: region.id,
    type: "geo-region",
    label: region.name,
    layerId: "geo-regions",
    latitude: region.centroid?.latitude,
    longitude: region.centroid?.longitude,
    metadata: {
      ...region.metadata,
      level: region.level,
      score: region.score,
    },
  };
}

function RegionRectangles({ regions, visible }: { regions: WorkbenchGeoRegion[]; visible: boolean }) {
  const map = useMap();
  const rectanglesRef = useRef<google.maps.Rectangle[]>([]);
  const rectangleInputs = useMemo(
    () => regions.map((region) => ({ region, bounds: bboxToBounds(region.bbox) })).filter((item) => item.bounds !== null),
    [regions],
  );

  useEffect(() => {
    if (!map || !visible) {
      return;
    }

    const rectangles = rectangleInputs.map(({ region, bounds }) => {
      const tone = scoreTone(region.score);
      return new google.maps.Rectangle({
        map,
        bounds: bounds!,
        clickable: false,
        strokeColor: tone.stroke,
        strokeOpacity: 0.55,
        strokeWeight: 1,
        fillColor: tone.tint,
        fillOpacity: 1,
        zIndex: 5,
      });
    });

    rectanglesRef.current = rectangles;

    return () => {
      for (const rectangle of rectanglesRef.current) {
        rectangle.setMap(null);
      }
      rectanglesRef.current = [];
    };
  }, [map, rectangleInputs, visible]);

  return null;
}

export function GeoRegionLayer({
  regions,
  visible = true,
  selectedAsset,
  onSelectRegion,
}: GeoRegionLayerProps) {
  if (!visible) {
    return null;
  }

  return (
    <>
      <RegionRectangles regions={regions} visible={visible} />
      {regions.map((region) => {
        if (!region.centroid) {
          return null;
        }

        const tone = scoreTone(region.score);
        const isSelected = selectedAsset?.type === "geo-region" && selectedAsset.id === region.id;
        const scoreLabel = typeof region.score === "number" ? `${Math.round(region.score * 100)}%` : region.level;

        return (
          <AdvancedMarker
            key={region.id}
            position={{ lat: region.centroid.latitude, lng: region.centroid.longitude }}
            title={`${region.name} — ${region.level}${typeof region.score === "number" ? ` score ${region.score.toFixed(2)} (modeled)` : ""}`}
            onClick={() => onSelectRegion?.(regionToSelection(region))}
          >
            <button
              type="button"
              data-testid="workbench-geo-region-marker"
              data-region-id={region.id}
              data-region-level={region.level}
              data-selected={isSelected ? "true" : "false"}
              className={cn(
                "rounded-full border-2 border-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-lg transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]",
                tone.fill,
                isSelected ? "scale-105 ring-4 ring-white/70" : "",
              )}
              aria-label={`Select region ${region.name}`}
            >
              {scoreLabel}
            </button>
          </AdvancedMarker>
        );
      })}
    </>
  );
}
