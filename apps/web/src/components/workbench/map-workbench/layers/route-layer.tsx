"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import type { RouteCoordinate } from "../types";

export type RouteLayerProps = {
  coordinates: RouteCoordinate[];
  visible?: boolean;
  strokeColor?: string;
  casingColor?: string;
  strokeOpacity?: number;
  zIndex?: number;
};

function toLatLngPath(coordinates: RouteCoordinate[]): google.maps.LatLngLiteral[] {
  return coordinates
    .map((coordinate) => {
      const lat =
        typeof coordinate.latitude === "number"
          ? coordinate.latitude
          : typeof (coordinate as { lat?: number }).lat === "number"
            ? (coordinate as { lat: number }).lat
            : NaN;
      const lng =
        typeof coordinate.longitude === "number"
          ? coordinate.longitude
          : typeof (coordinate as { lng?: number }).lng === "number"
            ? (coordinate as { lng: number }).lng
            : NaN;
      return { lat, lng };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

/**
 * Imperative Google route renderer. This component must live inside <Map> so
 * useMap() resolves the stable mounted vector map instance. It creates native
 * google.maps.Polyline objects only from this map child and cleans them up on
 * prop changes/unmount.
 */
export function RouteLayer({
  coordinates,
  visible = true,
  strokeColor = "#276fbf",
  casingColor = "#ffffff",
  strokeOpacity = 0.95,
  zIndex = 20,
}: RouteLayerProps) {
  const map = useMap();
  const linesRef = useRef<google.maps.Polyline[]>([]);
  const path = useMemo(() => toLatLngPath(coordinates), [coordinates]);

  useEffect(() => {
    if (!map || !visible || path.length < 2) {
      return;
    }

    const casing = new google.maps.Polyline({
      path,
      map,
      strokeColor: casingColor,
      strokeOpacity: 0.9,
      strokeWeight: 9,
      clickable: false,
      zIndex: zIndex - 1,
    });

    const routeLine = new google.maps.Polyline({
      path,
      map,
      strokeColor,
      strokeOpacity,
      strokeWeight: 5,
      clickable: false,
      zIndex,
    });

    linesRef.current = [casing, routeLine];

    return () => {
      for (const line of linesRef.current) {
        line.setMap(null);
      }
      linesRef.current = [];
    };
  }, [casingColor, map, path, strokeColor, strokeOpacity, visible, zIndex]);

  return null;
}
