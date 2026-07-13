"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";

export type FreightCompareFilter = "all" | "I-15" | "I-40";

export type FreightFlowLayerProps = {
  visible?: boolean;
  /** Filter dual corridors (I-15 vs I-40). Non-compare arcs always show. */
  viaFilter?: FreightCompareFilter;
  onSelectCorridor?: (corridorId: string) => void;
};

type FreightArc = {
  id: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  path: Array<{ lat: number; lng: number }>;
  tier: "low" | "medium" | "heavy";
  color: string;
  compareGroup?: string;
  viaRouteLabel?: string;
  roadTraced: boolean;
};

type CatalogRoute = {
  id: string;
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  geometry: {
    provider: string;
    coordinates: Array<{ latitude: number; longitude: number }>;
  };
  manifest?: { traffic?: string };
};

function catalogTrafficTier(value: string | undefined): "low" | "medium" | "heavy" {
  const match = value?.match(/([0-9.]+)K/i);
  const thousands = match ? Number(match[1]) : 0;
  if (thousands >= 10) return "heavy";
  if (thousands >= 5) return "medium";
  return "low";
}

function tierColor(tier: "low" | "medium" | "heavy") {
  return tier === "heavy" ? "#c0392b" : tier === "medium" ? "#d4a017" : "#3f9b6b";
}

/** Inverse pulse: heavy traffic = slow red; light = fast green. */
function pulseStepForTier(tier: "low" | "medium" | "heavy"): number {
  if (tier === "heavy") return 0.6;
  if (tier === "medium") return 1.4;
  return 2.8;
}

/**
 * Road-traced animated freight corridors.
 * Green / yellow / red from truck AADT tier; dash speed inverse to volume.
 */
export function FreightFlowLayer({
  visible = true,
  viaFilter = "all",
  onSelectCorridor,
}: FreightFlowLayerProps) {
  const map = useMap();
  const flows = useQuery(api.faf.westCoastFlows.westCoastFreightFlows, {});
  const catalog = useQuery(api.routes.catalog.list, {});
  const linesRef = useRef<google.maps.Polyline[]>([]);
  const tierRef = useRef<Map<string, "low" | "medium" | "heavy">>(new Map());
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !visible) {
      for (const line of linesRef.current) line.setMap(null);
      linesRef.current = [];
      tierRef.current = new Map();
      if (animRef.current != null) {
        window.clearInterval(animRef.current);
        animRef.current = null;
      }
      return;
    }

    for (const line of linesRef.current) line.setMap(null);
    linesRef.current = [];
    tierRef.current = new Map();

    const overviewArcs = ((flows?.arcs ?? []) as FreightArc[]).filter((arc) => {
      // Do not render crow-flies fallbacks as freight routes.
      if (!arc.roadTraced || !arc.path || arc.path.length < 8) return false;
      if (!arc.compareGroup || viaFilter === "all") return true;
      return arc.viaRouteLabel === viaFilter;
    });
    const generatorArcs: FreightArc[] = ((catalog?.preconfigured ?? []) as CatalogRoute[])
      .filter((route) => route.geometry.provider === "ptv" && route.geometry.coordinates.length >= 8)
      .map((route) => {
        const tier = catalogTrafficTier(route.manifest?.traffic);
        return {
          id: route.id,
          origin: { lat: route.origin.latitude, lng: route.origin.longitude },
          destination: { lat: route.destination.latitude, lng: route.destination.longitude },
          path: route.geometry.coordinates.map((point) => ({ lat: point.latitude, lng: point.longitude })),
          tier,
          color: tierColor(tier),
          roadTraced: true,
        };
      });
    const arcs = [...overviewArcs, ...generatorArcs];

    const polylines: google.maps.Polyline[] = [];

    for (const arc of arcs) {
      const path = arc.path.map((p: { lat: number; lng: number }) => ({
        lat: p.lat,
        lng: p.lng,
      }));

      const weight =
        arc.tier === "heavy" ? 5 : arc.tier === "medium" ? 4 : 3;
      const line = new google.maps.Polyline({
        path,
        map,
        strokeColor: arc.color,
        strokeOpacity: 0,
        strokeWeight: weight,
        clickable: true,
        zIndex: arc.tier === "heavy" ? 40 : arc.tier === "medium" ? 30 : 20,
        icons: [
          {
            icon: {
              path: "M 0,-1 0,1",
              strokeOpacity: 0.95,
              strokeColor: arc.color,
              scale: arc.tier === "heavy" ? 3.5 : 3,
            },
            offset: "0%",
            repeat: arc.roadTraced ? "14px" : "16px",
          },
        ],
      });
      line.set("freightId", arc.id);
      line.set("freightTier", arc.tier);
      tierRef.current.set(arc.id, arc.tier);
      line.addListener("click", () => {
        onSelectCorridor?.(arc.id);
        const mid = path[Math.floor(path.length / 2)]!;
        map.panTo(mid);
      });
      polylines.push(line);
    }

    linesRef.current = polylines;

    const offsets = new Map<string, number>();
    animRef.current = window.setInterval(() => {
      for (const line of linesRef.current) {
        const id = String(line.get("freightId") ?? "");
        const tier =
          (line.get("freightTier") as "low" | "medium" | "heavy" | undefined) ??
          "medium";
        const step = pulseStepForTier(tier);
        const next = ((offsets.get(id) ?? 0) + step) % 100;
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
  }, [catalog?.preconfigured, map, visible, flows?.arcs, viaFilter, onSelectCorridor]);

  return null;
}
