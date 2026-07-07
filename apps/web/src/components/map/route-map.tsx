"use client";

// RouteMap — Phase-4 route map ported to @vis.gl/react-google-maps on a vector
// mapId (P11-03, MAP-01/02/03), mirroring pulse-map.tsx.
//
// Google has NO per-vertex line-gradient, so the SoC gradient is rendered as N
// segmented solid-color google.maps.Polylines (buildSocPolylines) + a white
// active-segment casing Polyline (buildActiveCasingPath) — see @/lib/soc-segments.
// Chargers are AdvancedMarkers (NEVER google.maps.Marker), sized/colored by
// power_kw. The popup is an <InfoWindow>. Hover-sync preserves the identical
// turf nearestPointOnLine -> setActiveDistanceM(location*totalDistM) logic,
// only the event plumbing changes (Google map listeners instead of the old lib).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map,
  RenderingType,
  useMap,
} from "@vis.gl/react-google-maps";
import { bbox, lineString, nearestPointOnLine, point } from "@turf/turf";
import type { components } from "@fleetvolt/shared-types";
import { bboxTupleToBounds } from "@/lib/ca-framing";
import { mergeRouteWithSegments } from "@/lib/route-geometry";
import {
  buildActiveCasingPath,
  buildSocPolylines,
} from "@/lib/soc-segments";
import { findSegmentIndexByDistanceM } from "@/lib/segment-lookup";
import { createGoogleMapHandle, type FvMapRef } from "@/lib/map-ref";
import { useScenarioStore } from "@/stores/scenario-store";
import { MapTokenMissingBanner } from "./map-token-missing-banner";

type Segment = components["schemas"]["SegmentResult"];
type ChargingStop = components["schemas"]["ChargingStopResult"];

export type RouteMapProps = {
  segments: Segment[];
  chargingStops: ChargingStop[];
  routeCoords: [number, number][];
  routeDistanceM?: number;
  mapRef?: FvMapRef;
  selectedStopId?: string | null;
  onSelectStop?: (stopId: string | null) => void;
};

type SelectedStop = ChargingStop & { id: string };

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;

// SoCal fallback framing (parity with the old longitude -117.5 / lat 34.0 / z8).
const FALLBACK_BOUNDS = {
  north: 34.7,
  south: 33.3,
  east: -116.8,
  west: -118.2,
};

function formatDwellMinutes(dwellS: number): string {
  return `${Math.round(dwellS / 60)} min`;
}

function stopKey(stop: ChargingStop, index: number): string {
  return stop.station_id || String(index);
}

/** power_kw -> marker radius in px, reproducing Mapbox's 50->8..500->20 scale. */
function chargerRadiusPx(powerKw: number): number {
  const clamped = Math.min(500, Math.max(50, powerKw));
  const t = (clamped - 50) / (500 - 50);
  return 8 + t * (20 - 8);
}

function chargerColor(powerKw: number): string {
  return powerKw >= 350 ? "#2D4A6F" : "#8A8A93";
}

/**
 * Imperative controller living INSIDE <Map>: resolves the live google.maps.Map
 * via useMap(), publishes an FvMapHandle to mapRef for consumers (panTo +
 * captureSnapshot), and wires the turf hover-sync listeners. Never remounts the
 * <Map> — everything is prop-driven (Pitfall #6).
 */
function MapController({
  mapRef,
  routeCoords,
  totalDistM,
}: {
  mapRef?: FvMapRef;
  routeCoords: [number, number][];
  totalDistM: number;
}) {
  const map = useMap();
  const setActiveDistanceM = useScenarioStore((s) => s.setActiveDistanceM);

  // Publish the shared handle to consumers.
  useEffect(() => {
    if (!mapRef) return;
    mapRef.current = createGoogleMapHandle(map);
    return () => {
      mapRef.current = null;
    };
  }, [map, mapRef]);

  // Hover-sync: identical turf nearestPointOnLine logic, Google event plumbing.
  useEffect(() => {
    if (!map) return;
    if (routeCoords.length < 2 || totalDistM <= 0) return;

    const line = lineString(routeCoords);

    const moveListener = map.addListener(
      "mousemove",
      (event: google.maps.MapMouseEvent) => {
        const latLng = event.latLng;
        if (!latLng) return;
        const nearest = nearestPointOnLine(
          line,
          point([latLng.lng(), latLng.lat()]),
        );
        const location = nearest.properties?.location;
        if (typeof location === "number") {
          setActiveDistanceM(location * totalDistM);
        }
      },
    );

    const outListener = map.addListener("mouseout", () => {
      setActiveDistanceM(null);
    });

    return () => {
      moveListener.remove();
      outListener.remove();
    };
  }, [map, routeCoords, totalDistM, setActiveDistanceM]);

  return null;
}

/**
 * Imperatively manages the segmented SoC polylines + white active casing as
 * google.maps.Polyline objects (no per-vertex gradient in Google). Adds/removes
 * on prop change, cleans up on unmount.
 */
function RoutePolylines({
  routeCoords,
  segments,
  totalDistM,
  activeSegmentIndex,
}: {
  routeCoords: [number, number][];
  segments: Segment[];
  totalDistM: number;
  activeSegmentIndex: number;
}) {
  const map = useMap();
  const socRef = useRef<google.maps.Polyline[]>([]);
  const casingRef = useRef<google.maps.Polyline | null>(null);

  // Segmented SoC polylines.
  useEffect(() => {
    if (!map) return;
    const descriptors = buildSocPolylines(routeCoords, segments, totalDistM);
    const lines = descriptors.map(
      (d) =>
        new google.maps.Polyline({
          path: d.path,
          strokeColor: d.strokeColor,
          strokeWeight: 5,
          strokeOpacity: 1,
          map,
          zIndex: 2,
        }),
    );
    socRef.current = lines;
    return () => {
      for (const line of socRef.current) line.setMap(null);
      socRef.current = [];
    };
  }, [map, routeCoords, segments, totalDistM]);

  // White active-segment casing UNDER the SoC line (lower zIndex).
  useEffect(() => {
    if (!map) return;
    const path = buildActiveCasingPath(
      routeCoords,
      segments,
      activeSegmentIndex,
      totalDistM,
    );
    if (path.length < 2) {
      return;
    }
    const casing = new google.maps.Polyline({
      path,
      strokeColor: "#FFFFFF",
      strokeWeight: 9,
      strokeOpacity: 1,
      map,
      zIndex: 1,
    });
    casingRef.current = casing;
    return () => {
      casing.setMap(null);
      casingRef.current = null;
    };
  }, [map, routeCoords, segments, activeSegmentIndex, totalDistM]);

  return null;
}

export function RouteMap({
  segments,
  chargingStops,
  routeCoords,
  routeDistanceM = 0,
  mapRef,
  selectedStopId,
  onSelectStop,
}: RouteMapProps) {
  const [selectedStop, setSelectedStop] = useState<SelectedStop | null>(null);
  const [prevSelectedStopId, setPrevSelectedStopId] = useState<
    string | null | undefined
  >(selectedStopId);
  const activeDistanceM = useScenarioStore((s) => s.activeDistanceM);

  // Sync the controlled selectedStopId prop -> local selectedStop by adjusting
  // state during render (React's endorsed alternative to a setState effect).
  if (selectedStopId !== prevSelectedStopId) {
    setPrevSelectedStopId(selectedStopId);
    if (selectedStopId == null) {
      setSelectedStop(null);
    } else {
      const index = chargingStops.findIndex(
        (stop, idx) => stopKey(stop, idx) === selectedStopId,
      );
      const stop = chargingStops[index];
      setSelectedStop(
        stop
          ? {
              ...stop,
              id: selectedStopId,
              name: stop.name ?? "Charging stop",
              station_id: stop.station_id || selectedStopId,
            }
          : null,
      );
    }
  }

  const activeSegmentIndex = useMemo(
    () =>
      activeDistanceM == null
        ? -1
        : findSegmentIndexByDistanceM(segments, activeDistanceM),
    [activeDistanceM, segments],
  );

  const merged = useMemo(
    () => mergeRouteWithSegments(routeCoords, segments, routeDistanceM),
    [routeCoords, segments, routeDistanceM],
  );

  const bounds = useMemo(() => {
    if (routeCoords.length < 2) {
      return FALLBACK_BOUNDS;
    }
    const [west, south, east, north] = bbox(lineString(routeCoords));
    return bboxTupleToBounds([west, south, east, north]);
  }, [routeCoords]);

  const handleSelectStop = useCallback(
    (stop: ChargingStop, index: number) => {
      const id = stopKey(stop, index);
      setSelectedStop({
        ...stop,
        id,
        name: stop.name ?? "Charging stop",
        station_id: stop.station_id || id,
      });
      onSelectStop?.(id);
    },
    [onSelectStop],
  );

  if (!API_KEY || !MAP_ID) {
    return <MapTokenMissingBanner />;
  }

  if (routeCoords.length < 2 || segments.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-[var(--fv-stroke)] bg-[var(--fv-surface)] text-sm text-muted-foreground">
        Route geometry unavailable for this simulation.
      </div>
    );
  }

  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-[var(--fv-stroke)]">
      <APIProvider apiKey={API_KEY} version="quarterly">
        <Map
          mapId={MAP_ID}
          renderingType={RenderingType.VECTOR}
          defaultBounds={bounds}
          gestureHandling="greedy"
          disableDefaultUI
          className="h-full w-full"
          style={{ width: "100%", height: "100%", minHeight: 360 }}
          data-testid="route-map-canvas"
          aria-label={`Route map with ${chargingStops.length} charging stops`}
        >
          <MapController
            mapRef={mapRef}
            routeCoords={merged.routeCoords}
            totalDistM={merged.totalDistM}
          />
          <RoutePolylines
            routeCoords={merged.routeCoords}
            segments={segments}
            totalDistM={merged.totalDistM}
            activeSegmentIndex={activeSegmentIndex}
          />

          {chargingStops.map((stop, index) => {
            const id = stopKey(stop, index);
            const radius = chargerRadiusPx(stop.power_kw);
            return (
              <AdvancedMarker
                key={id}
                position={{ lat: stop.lat, lng: stop.lon }}
                title={stop.name ?? "Charging stop"}
                onClick={() => handleSelectStop(stop, index)}
              >
                <div
                  data-testid="charger-marker"
                  data-station-id={id}
                  aria-label={`${stop.name ?? "Charging stop"} — ${stop.power_kw} kW`}
                  style={{
                    width: radius * 2,
                    height: radius * 2,
                    borderRadius: "9999px",
                    backgroundColor: chargerColor(stop.power_kw),
                    border: "1px solid #FFFFFF",
                    boxSizing: "border-box",
                    cursor: "pointer",
                  }}
                />
              </AdvancedMarker>
            );
          })}

          {selectedStop && (
            <InfoWindow
              position={{ lat: selectedStop.lat, lng: selectedStop.lon }}
              onCloseClick={() => setSelectedStop(null)}
            >
              <div className="space-y-1 text-sm">
                <p className="font-medium">{selectedStop.name}</p>
                <p>{selectedStop.power_kw} kW</p>
                <p>
                  Arrival {selectedStop.arrival_soc_pct}% → Departure{" "}
                  {selectedStop.departure_soc_pct}%
                </p>
                <p>Dwell {formatDwellMinutes(selectedStop.dwell_s)}</p>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>

      <div
        className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-[var(--fv-stroke)] bg-white/95 px-3 py-2 text-xs shadow-sm"
        aria-hidden
      >
        <p className="mb-1 font-medium text-foreground">SoC along route</p>
        <div className="flex flex-col gap-1 text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-6 rounded-sm bg-[#16A34A]" />
            Above 40%
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-6 rounded-sm bg-[#D97706]" />
            20–40%
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-6 rounded-sm bg-[#DC2626]" />
            Below 20%
          </span>
        </div>
      </div>
    </div>
  );
}
