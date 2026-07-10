"use client";

import { useEffect, useMemo, useRef } from "react";
import { AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { WorkbenchSelection } from "../types";

export type GeneratorSpokesLayerProps = {
  visible?: boolean;
  onSelectGenerator?: (selection: WorkbenchSelection) => void;
};

type Spoke = {
  generatorId: string;
  name: string;
  city: string;
  county: string;
  zip: string;
  district: string;
  generator: { lat: number; lng: number };
  portCode: string;
  port: { lat: number; lng: number };
  tier: "low" | "medium" | "heavy";
  color: string;
  dailyTruckIndex: number;
};

function pulseStepForTier(tier: "low" | "medium" | "heavy"): number {
  if (tier === "heavy") return 0.6;
  if (tier === "medium") return 1.4;
  return 2.8;
}

/**
 * Statewide traffic generators with port spokes.
 * Color + dash speed match freight corridors (heavy=slow red, low=fast green).
 */
export function GeneratorSpokesLayer({
  visible = true,
  onSelectGenerator,
}: GeneratorSpokesLayerProps) {
  const map = useMap();
  const data = useQuery(api.generators.queries.listWithPortSpokes, {
    limit: 120,
  });
  const spokes = useMemo(
    () => (data?.spokes ?? []) as Spoke[],
    [data?.spokes],
  );
  const linesRef = useRef<google.maps.Polyline[]>([]);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !visible || !spokes.length) {
      for (const line of linesRef.current) line.setMap(null);
      linesRef.current = [];
      if (animRef.current != null) {
        window.clearInterval(animRef.current);
        animRef.current = null;
      }
      return;
    }

    for (const line of linesRef.current) line.setMap(null);
    const polylines: google.maps.Polyline[] = [];

    for (const spoke of spokes) {
      const path = [
        { lat: spoke.port.lat, lng: spoke.port.lng },
        { lat: spoke.generator.lat, lng: spoke.generator.lng },
      ];
      const line = new google.maps.Polyline({
        path,
        map,
        strokeColor: spoke.color,
        strokeOpacity: 0,
        strokeWeight: spoke.tier === "heavy" ? 3.5 : 2.5,
        clickable: true,
        zIndex: 18,
        icons: [
          {
            icon: {
              path: "M 0,-1 0,1",
              strokeOpacity: 0.85,
              strokeColor: spoke.color,
              scale: 2.5,
            },
            offset: "0%",
            repeat: "12px",
          },
        ],
      });
      line.set("spokeId", spoke.generatorId);
      line.set("spokeTier", spoke.tier);
      line.addListener("click", () => {
        onSelectGenerator?.({
          id: spoke.generatorId,
          type: "poi",
          label: spoke.name,
          layerId: "pois",
          latitude: spoke.generator.lat,
          longitude: spoke.generator.lng,
          metadata: {
            kind: "traffic-generator",
            city: spoke.city,
            county: spoke.county,
            zip: spoke.zip,
            district: spoke.district,
            portCode: spoke.portCode,
            tier: spoke.tier,
            dailyTruckIndex: spoke.dailyTruckIndex,
            carrierHref: `/caas?view=summary&carriers=1&zip=${encodeURIComponent(spoke.zip)}&city=${encodeURIComponent(spoke.city)}`,
          },
        });
      });
      polylines.push(line);
    }

    linesRef.current = polylines;
    const offsets = new Map<string, number>();
    animRef.current = window.setInterval(() => {
      for (const line of linesRef.current) {
        const id = String(line.get("spokeId") ?? "");
        const tier =
          (line.get("spokeTier") as "low" | "medium" | "heavy" | undefined) ??
          "medium";
        const next = ((offsets.get(id) ?? 0) + pulseStepForTier(tier)) % 100;
        offsets.set(id, next);
        const icons = line.get("icons") as google.maps.IconSequence[] | undefined;
        if (!icons?.[0]) continue;
        icons[0].offset = `${next}%`;
        line.set("icons", icons);
      }
    }, 80);

    return () => {
      if (animRef.current != null) {
        window.clearInterval(animRef.current);
        animRef.current = null;
      }
      for (const line of linesRef.current) line.setMap(null);
      linesRef.current = [];
    };
  }, [map, visible, spokes, onSelectGenerator]);

  if (!visible || !spokes.length) return null;

  return (
    <>
      {spokes.map((spoke) => (
        <AdvancedMarker
          key={spoke.generatorId}
          position={{ lat: spoke.generator.lat, lng: spoke.generator.lng }}
          title={spoke.name}
          onClick={() =>
            onSelectGenerator?.({
              id: spoke.generatorId,
              type: "poi",
              label: spoke.name,
              layerId: "pois",
              latitude: spoke.generator.lat,
              longitude: spoke.generator.lng,
              metadata: {
                kind: "traffic-generator",
                city: spoke.city,
                county: spoke.county,
                zip: spoke.zip,
                district: spoke.district,
                portCode: spoke.portCode,
                tier: spoke.tier,
                dailyTruckIndex: spoke.dailyTruckIndex,
                carrierHref: `/caas?view=summary&carriers=1&zip=${encodeURIComponent(spoke.zip)}&city=${encodeURIComponent(spoke.city)}`,
              },
            })
          }
        >
          <button
            type="button"
            data-testid="traffic-generator-spoke-marker"
            data-generator-id={spoke.generatorId}
            className="h-2.5 w-2.5 rounded-full border border-white shadow"
            style={{ backgroundColor: spoke.color }}
            aria-label={spoke.name}
          />
        </AdvancedMarker>
      ))}
    </>
  );
}
