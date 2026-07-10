"use client";

import { useEffect, useMemo, useRef } from "react";
import { AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { WorkbenchSelection } from "../types";
import { cn } from "@/lib/utils";

export type CaasGeoLevel = "air-district" | "county" | "zip";

type ChoroplethRegion = {
  id: string;
  name: string;
  level: CaasGeoLevel;
  fips?: string;
  airDistrict?: string;
  centroid?: { lat: number; lng: number };
  bbox?: {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
  };
  ring?: Array<{ lat: number; lng: number }>;
  score?: number;
  tier: "low" | "medium" | "heavy";
  color: string;
  fillOpacity: number;
  countyCount?: number;
  zipCodes?: string[];
};

export type CaasChoroplethLayerProps = {
  level: CaasGeoLevel;
  visible?: boolean;
  selectedAsset?: WorkbenchSelection | null;
  onSelectRegion?: (selection: WorkbenchSelection) => void;
};

function bboxToBounds(bbox: {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}): google.maps.LatLngBoundsLiteral {
  return {
    north: bbox.maxLat,
    south: bbox.minLat,
    east: bbox.maxLng,
    west: bbox.minLng,
  };
}

/** Cap fill at 50% so basemap always shows through. */
function cappedOpacity(fillOpacity: number): number {
  return Math.min(0.5, Math.max(0.12, fillOpacity));
}

function selectionPayload(region: ChoroplethRegion): WorkbenchSelection {
  return {
    id: region.id,
    type: "geo-region",
    label: region.name,
    layerId: "geo-regions",
    latitude: region.centroid?.lat,
    longitude: region.centroid?.lng,
    metadata: {
      level: region.level,
      score: region.score ?? null,
      tier: region.tier,
      color: region.color,
      airDistrict: region.airDistrict ?? null,
      fips: region.fips ?? null,
      countyCount: region.countyCount ?? null,
      zipCodes: region.zipCodes ?? null,
      carrierHref: `/caas?view=summary&carriers=1${
        region.level === "zip" && region.zipCodes?.[0]
          ? `&zip=${region.zipCodes[0]}`
          : region.level === "air-district" && region.airDistrict
            ? `&airDistrict=${encodeURIComponent(region.airDistrict)}`
            : region.fips
              ? `&fips=${region.fips}`
              : ""
      }`,
    },
  };
}

export function CaasChoroplethLayer({
  level,
  visible = true,
  selectedAsset,
  onSelectRegion,
}: CaasChoroplethLayerProps) {
  const map = useMap();
  const data = useQuery(api.geo.choropleth.listCaasChoropleth, { level });
  const shapesRef = useRef<Array<google.maps.Polygon | google.maps.Rectangle>>(
    [],
  );

  const regions = useMemo(
    () => (data?.regions ?? []) as ChoroplethRegion[],
    [data?.regions],
  );

  const shapeInputs = useMemo(
    () =>
      regions
        .filter(
          (r: ChoroplethRegion) =>
            (r.ring && r.ring.length >= 3) || r.bbox,
        )
        .map((r: ChoroplethRegion) => ({
          region: r,
          ring: r.ring && r.ring.length >= 3 ? r.ring : null,
          bounds: r.bbox ? bboxToBounds(r.bbox) : null,
        })),
    [regions],
  );

  useEffect(() => {
    if (!map || !visible) {
      for (const s of shapesRef.current) s.setMap(null);
      shapesRef.current = [];
      return;
    }

    for (const s of shapesRef.current) s.setMap(null);
    const shapes: Array<google.maps.Polygon | google.maps.Rectangle> = [];

    for (const { region, ring, bounds } of shapeInputs) {
      const opacity = cappedOpacity(region.fillOpacity);
      const zIndex =
        level === "air-district" ? 4 : level === "county" ? 5 : 6;
      let shape: google.maps.Polygon | google.maps.Rectangle;
      if (ring) {
        shape = new google.maps.Polygon({
          map,
          paths: ring,
          clickable: true,
          strokeColor: region.color,
          strokeOpacity: 0.8,
          strokeWeight: level === "zip" ? 0.8 : 1.2,
          fillColor: region.color,
          fillOpacity: opacity,
          zIndex,
        });
      } else if (bounds) {
        shape = new google.maps.Rectangle({
          map,
          bounds,
          clickable: true,
          strokeColor: region.color,
          strokeOpacity: 0.75,
          strokeWeight: level === "air-district" ? 1.5 : 1,
          fillColor: region.color,
          fillOpacity: opacity,
          zIndex,
        });
      } else {
        continue;
      }
      shape.addListener("click", () => {
        onSelectRegion?.(selectionPayload(region));
      });
      shapes.push(shape);
    }

    shapesRef.current = shapes;
    return () => {
      for (const s of shapesRef.current) s.setMap(null);
      shapesRef.current = [];
    };
  }, [map, visible, shapeInputs, level, onSelectRegion]);

  if (!visible) return null;

  // Labels at centroids — denser mark for ZIP (skip if thousands unless selected band)
  const labelRegions =
    level === "zip"
      ? regions.filter((r) => {
          const selected =
            selectedAsset?.type === "geo-region" &&
            selectedAsset.id === r.id;
          // Keep map readable: label approximately every Nth ZIP + selection.
          if (selected) return true;
          const n = Number(r.id.replace(/^zip-/, "")) || 0;
          return n % 40 === 0;
        })
      : regions;

  return (
    <>
      {labelRegions.map((region) => {
        if (!region.centroid) return null;
        const isSelected =
          selectedAsset?.type === "geo-region" &&
          selectedAsset.id === region.id;
        const label =
          level === "zip"
            ? region.name.replace("ZIP ", "")
            : typeof region.score === "number"
              ? `${Math.round(region.score * 100)}%`
              : region.level === "air-district"
                ? "AD"
                : "CO";
        return (
          <AdvancedMarker
            key={region.id}
            position={{
              lat: region.centroid.lat,
              lng: region.centroid.lng,
            }}
            title={region.name}
            onClick={() => onSelectRegion?.(selectionPayload(region))}
          >
            <button
              type="button"
              data-testid={
                level === "zip" ? "caas-zip-marker" : "caas-choropleth-marker"
              }
              data-region-id={region.id}
              className={cn(
                "rounded-full border border-white px-1.5 py-0.5 text-[9px] font-black text-white shadow",
                isSelected ? "scale-105 ring-2 ring-white/80" : "",
              )}
              style={{ backgroundColor: region.color }}
            >
              {label}
            </button>
          </AdvancedMarker>
        );
      })}
    </>
  );
}
