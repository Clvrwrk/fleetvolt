"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";

export type FreightFlowLayerProps = {
  visible?: boolean;
};

/**
 * Static animated dotted freight arcs from west-coast ports.
 * Green = low, yellow = medium, red = heavy daily truck traffic.
 */
export function FreightFlowLayer({ visible = true }: FreightFlowLayerProps) {
  const map = useMap();
  const flows = useQuery(api["faf/westCoastFlows"].westCoastFreightFlows, {});
  const linesRef = useRef<google.maps.Polyline[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !visible || !flows?.arcs?.length) {
      for (const line of linesRef.current) line.setMap(null);
      for (const marker of markersRef.current) marker.setMap(null);
      linesRef.current = [];
      markersRef.current = [];
      if (animRef.current != null) {
        window.clearInterval(animRef.current);
        animRef.current = null;
      }
      return;
    }

    for (const line of linesRef.current) line.setMap(null);
    for (const marker of markersRef.current) marker.setMap(null);
    linesRef.current = [];
    markersRef.current = [];

    const polylines: google.maps.Polyline[] = [];

    for (const arc of flows.arcs) {
      const path = [
        { lat: arc.origin.lat, lng: arc.origin.lng },
        { lat: arc.destination.lat, lng: arc.destination.lng },
      ];
      const line = new google.maps.Polyline({
        path,
        map,
        strokeColor: arc.color,
        strokeOpacity: 0,
        strokeWeight: arc.tier === "heavy" ? 5 : arc.tier === "medium" ? 4 : 3,
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
            repeat: "16px",
          },
        ],
      });
      line.set("freightId", arc.id);
      line.addListener("click", () => {
        map.panTo({ lat: arc.origin.lat, lng: arc.origin.lng });
      });
      polylines.push(line);

      const midLat = (arc.origin.lat + arc.destination.lat) / 2;
      const midLng = (arc.origin.lng + arc.destination.lng) / 2;
      const marker = new google.maps.Marker({
        map,
        position: { lat: midLat, lng: midLng },
        clickable: false,
        opacity: 0,
        title: `${arc.portCode} → ${arc.destination.label} (${arc.tier})`,
      });
      markersRef.current.push(marker);
    }

    linesRef.current = polylines;

    // Animate dash offset along the largest-direction arcs.
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
      for (const marker of markersRef.current) marker.setMap(null);
      linesRef.current = [];
      markersRef.current = [];
    };
  }, [map, visible, flows]);

  return null;
}
