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

/**
 * Road-traced (or fallback straight) animated freight corridors.
 * Green / yellow / red from truck AADT tier (or intensity proxy).
 */
export function FreightFlowLayer({
  visible = true,
  viaFilter = "all",
  onSelectCorridor,
}: FreightFlowLayerProps) {
  const map = useMap();
  const flows = useQuery(api["faf/westCoastFlows"].westCoastFreightFlows, {});
  const linesRef = useRef<google.maps.Polyline[]>([]);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !visible || !flows?.arcs?.length) {
      for (const line of linesRef.current) line.setMap(null);
      linesRef.current = [];
      if (animRef.current != null) {
        window.clearInterval(animRef.current);
        animRef.current = null;
      }
      return;
    }

    for (const line of linesRef.current) line.setMap(null);
    linesRef.current = [];

    const arcs = flows.arcs.filter((arc) => {
      if (!arc.compareGroup || viaFilter === "all") return true;
      return arc.viaRouteLabel === viaFilter;
    });

    const polylines: google.maps.Polyline[] = [];

    for (const arc of arcs) {
      const path =
        arc.path?.length >= 2
          ? arc.path.map((p) => ({ lat: p.lat, lng: p.lng }))
          : [
              { lat: arc.origin.lat, lng: arc.origin.lng },
              { lat: arc.destination.lat, lng: arc.destination.lng },
            ];

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
      line.addListener("click", () => {
        onSelectCorridor?.(arc.id);
        const mid = path[Math.floor(path.length / 2)]!;
        map.panTo(mid);
      });
      polylines.push(line);
    }

    linesRef.current = polylines;

    let offset = 0;
    animRef.current = window.setInterval(() => {
      offset = (offset + 2) % 100;
      for (const line of linesRef.current) {
        const icons = line.get("icons") as google.maps.IconSequence[] | undefined;
        if (!icons?.[0]) continue;
        icons[0].offset = `${offset}%`;
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
  }, [map, visible, flows, viaFilter, onSelectCorridor]);

  return null;
}
