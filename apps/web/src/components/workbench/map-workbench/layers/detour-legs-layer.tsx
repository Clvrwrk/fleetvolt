"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { useMap } from "@vis.gl/react-google-maps";
import { api } from "../../../../../convex/_generated/api";
import {
  nearestPointOnPolyline,
  ON_ROUTE_MAX_M,
  type LatLng,
} from "@/lib/maps/route-proximity";
import type { RouteCoordinate, WorkbenchSelection } from "../types";

export type DetourLegsLayerProps = {
  routeCoordinates: RouteCoordinate[];
  selectedAsset: WorkbenchSelection | null;
  /** Blueprint blue dashed spur — exit corridor → asset → rejoin. */
  strokeColor?: string;
  visible?: boolean;
};

type DetourPaths = {
  /** Road-snapped spur: leave corridor → asset (same roads rejoin the other way). */
  spur: google.maps.LatLngLiteral[];
  junction: LatLng;
};

function toPath(coords: Array<{ latitude: number; longitude: number }>): google.maps.LatLngLiteral[] {
  return coords
    .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
    .map((c) => ({ lat: c.latitude, lng: c.longitude }));
}

function dashedPolyline(
  map: google.maps.Map,
  path: google.maps.LatLngLiteral[],
  strokeColor: string,
  zIndex: number,
): google.maps.Polyline {
  return new google.maps.Polyline({
    path,
    map,
    strokeColor,
    strokeOpacity: 0,
    strokeWeight: 4,
    clickable: false,
    zIndex,
    icons: [
      {
        icon: {
          path: "M 0,-1 0,1",
          strokeOpacity: 0.95,
          strokeColor,
          scale: 3,
        },
        offset: "0",
        repeat: "14px",
      },
    ],
  });
}

/**
 * When the driver selects a charger/parking off the main A→B line, draw dotted
 * blue Google-routed legs: corridor → asset (exit) and asset → corridor (rejoin).
 */
export function DetourLegsLayer({
  routeCoordinates,
  selectedAsset,
  strokeColor = "#4c8fb8",
  visible = true,
}: DetourLegsLayerProps) {
  const map = useMap();
  const fetchRouteGeometry = useAction(api["workbench/actions"].routeGeometry);
  const linesRef = useRef<google.maps.Polyline[]>([]);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [paths, setPaths] = useState<DetourPaths | null>(null);
  const requestKey = useRef<string | null>(null);

  useEffect(() => {
    if (
      !visible ||
      !selectedAsset ||
      typeof selectedAsset.latitude !== "number" ||
      typeof selectedAsset.longitude !== "number" ||
      !Number.isFinite(selectedAsset.latitude) ||
      !Number.isFinite(selectedAsset.longitude) ||
      routeCoordinates.length < 2
    ) {
      setPaths(null);
      requestKey.current = null;
      return;
    }

    const corridor: LatLng[] = routeCoordinates.map((c) => ({
      lat: c.latitude,
      lng: c.longitude,
    }));
    const asset: LatLng = {
      lat: selectedAsset.latitude,
      lng: selectedAsset.longitude,
    };
    const nearest = nearestPointOnPolyline(asset, corridor);
    if (!nearest) {
      setPaths(null);
      return;
    }

    // On-route assets don't need a spur.
    if (nearest.distanceM <= ON_ROUTE_MAX_M) {
      setPaths(null);
      requestKey.current = null;
      return;
    }

    const key = `${selectedAsset.id}:${asset.lat.toFixed(5)},${asset.lng.toFixed(5)}:${nearest.point.lat.toFixed(5)},${nearest.point.lng.toFixed(5)}`;
    if (requestKey.current === key) return;
    requestKey.current = key;

    let cancelled = false;

    void (async () => {
      try {
        const spur = await fetchRouteGeometry({
          origin: {
            latitude: nearest.point.lat,
            longitude: nearest.point.lng,
          },
          destination: {
            latitude: asset.lat,
            longitude: asset.lng,
          },
          provider: "google",
        });

        if (cancelled) return;

        const spurPath = toPath(spur.coordinates ?? []);
        if (spurPath.length < 2) {
          // Fallback: straight spur so the driver still sees the exit intent.
          setPaths({
            spur: [
              { lat: nearest.point.lat, lng: nearest.point.lng },
              { lat: asset.lat, lng: asset.lng },
            ],
            junction: nearest.point,
          });
          return;
        }

        setPaths({
          spur: spurPath,
          junction: nearest.point,
        });
      } catch (error) {
        if (cancelled) return;
        console.warn("[workbench] detour spur failed", error);
        setPaths({
          spur: [
            { lat: nearest.point.lat, lng: nearest.point.lng },
            { lat: asset.lat, lng: asset.lng },
          ],
          junction: nearest.point,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchRouteGeometry, routeCoordinates, selectedAsset, visible]);

  useEffect(() => {
    if (!map) return;

    for (const line of linesRef.current) {
      line.setMap(null);
    }
    linesRef.current = [];
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }

    if (!paths || !visible) return;

    // Leave main route → asset (rejoin is the same roads the other way)
    linesRef.current.push(dashedPolyline(map, paths.spur, strokeColor, 28));

    // Junction marker where the driver leaves / rejoins the main route
    markerRef.current = new google.maps.Marker({
      map,
      position: { lat: paths.junction.lat, lng: paths.junction.lng },
      clickable: false,
      zIndex: 30,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 5,
        fillColor: strokeColor,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      title: "Leave / rejoin main route",
    });

    return () => {
      for (const line of linesRef.current) {
        line.setMap(null);
      }
      linesRef.current = [];
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    };
  }, [map, paths, strokeColor, visible]);

  return null;
}
