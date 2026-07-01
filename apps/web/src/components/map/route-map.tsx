"use client";

import { useCallback, useMemo, useState } from "react";
import Map, {
  Layer,
  Popup,
  Source,
  type MapMouseEvent,
  type MapRef,
} from "react-map-gl/mapbox";
import { bbox, lineString, nearestPointOnLine, point } from "@turf/turf";
import type { ExpressionSpecification } from "mapbox-gl";
import type { components } from "@fleetvolt/shared-types";
import {
  buildRouteGeoJsonSource,
  buildSocGradientExpression,
} from "@/lib/segment-geojson";
import {
  mergeRouteWithSegments,
  segmentDistanceBoundsM,
  sliceRouteByDistanceM,
} from "@/lib/route-geometry";
import { findSegmentIndexByDistanceM } from "@/lib/segment-lookup";
import { useScenarioStore } from "@/stores/scenario-store";
import { MapTokenMissingBanner } from "./map-token-missing-banner";
import "mapbox-gl/dist/mapbox-gl.css";

type Segment = components["schemas"]["SegmentResult"];
type ChargingStop = components["schemas"]["ChargingStopResult"];

export type RouteMapProps = {
  segments: Segment[];
  chargingStops: ChargingStop[];
  routeCoords: [number, number][];
  routeDistanceM?: number;
  mapRef?: React.RefObject<MapRef | null>;
};

type SelectedStop = ChargingStop & { id: string };

const MAP_STYLE = "mapbox://styles/mapbox/light-v11";

function formatDwellMinutes(dwellS: number): string {
  return `${Math.round(dwellS / 60)} min`;
}

export function RouteMap({
  segments,
  chargingStops,
  routeCoords,
  routeDistanceM = 0,
  mapRef,
}: RouteMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [selectedStop, setSelectedStop] = useState<SelectedStop | null>(null);
  const setActiveDistanceM = useScenarioStore((s) => s.setActiveDistanceM);
  const activeDistanceM = useScenarioStore((s) => s.activeDistanceM);
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

  const routeFeature = useMemo(
    () => buildRouteGeoJsonSource(merged.routeCoords),
    [merged.routeCoords],
  );

  const gradientExpression = useMemo(
    () =>
      buildSocGradientExpression(
        segments,
        merged.totalDistM,
      ) as ExpressionSpecification,
    [segments, merged.totalDistM],
  );

  const activeSegmentFeature = useMemo(() => {
    if (activeSegmentIndex < 0) {
      return null;
    }

    const { startM, endM } = segmentDistanceBoundsM(segments, activeSegmentIndex);
    const coords = sliceRouteByDistanceM(
      merged.routeCoords,
      startM,
      endM,
      merged.totalDistM,
    );

    if (coords.length < 2) {
      return null;
    }

    return buildRouteGeoJsonSource(coords);
  }, [activeSegmentIndex, merged.routeCoords, merged.totalDistM, segments]);

  const chargerFeatures = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: chargingStops.map((stop, index) => ({
        type: "Feature" as const,
        id: stop.station_id || String(index),
        properties: {
          name: stop.name ?? "Charging stop",
          power_kw: stop.power_kw,
          arrival_soc_pct: stop.arrival_soc_pct,
          departure_soc_pct: stop.departure_soc_pct,
          dwell_s: stop.dwell_s,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [stop.lon, stop.lat],
        },
      })),
    }),
    [chargingStops],
  );

  const initialViewState = useMemo(() => {
    if (routeCoords.length < 2) {
      return {
        longitude: -117.5,
        latitude: 34.0,
        zoom: 8,
      };
    }

    const [west, south, east, north] = bbox(lineString(routeCoords));
    return {
      bounds: [
        [west, south],
        [east, north],
      ] as [[number, number], [number, number]],
      fitBoundsOptions: { padding: 48 },
    };
  }, [routeCoords]);

  const onMapClick = useCallback(
    (event: MapMouseEvent) => {
      const feature = event.features?.[0];
      if (feature?.layer?.id === "charger-circles" && feature.properties) {
        event.originalEvent.stopPropagation();
        const props = feature.properties;
        setSelectedStop({
          id: String(feature.id ?? props.name),
          station_id: String(feature.id ?? props.name),
          name: String(props.name),
          lat: (feature.geometry as GeoJSON.Point).coordinates[1]!,
          lon: (feature.geometry as GeoJSON.Point).coordinates[0]!,
          power_kw: Number(props.power_kw),
          arrival_soc_pct: Number(props.arrival_soc_pct),
          departure_soc_pct: Number(props.departure_soc_pct),
          dwell_s: Number(props.dwell_s),
          energy_added_kwh: 0,
          detour_s: 0,
        });
        return;
      }

      setSelectedStop(null);
    },
    [],
  );

  const onMapMouseMove = useCallback(
    (event: MapMouseEvent) => {
      if (merged.routeCoords.length < 2 || merged.totalDistM <= 0) {
        return;
      }

      const line = lineString(merged.routeCoords);
      const nearest = nearestPointOnLine(
        line,
        point([event.lngLat.lng, event.lngLat.lat]),
      );
      const location = nearest.properties?.location;
      if (typeof location === "number") {
        setActiveDistanceM(location * merged.totalDistM);
      }
    },
    [merged.routeCoords, merged.totalDistM, setActiveDistanceM],
  );

  const onMapMouseLeave = useCallback(() => {
    setActiveDistanceM(null);
  }, [setActiveDistanceM]);

  if (!token) {
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
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle={MAP_STYLE}
        preserveDrawingBuffer
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%", minHeight: 360 }}
        interactiveLayerIds={["route-soc", "charger-circles"]}
        onClick={onMapClick}
        onMouseMove={onMapMouseMove}
        onMouseLeave={onMapMouseLeave}
        aria-label={`Route map with ${chargingStops.length} charging stops`}
      >
        <Source id="route" type="geojson" data={routeFeature} lineMetrics>
          <Layer
            id="route-soc"
            type="line"
            paint={{
              "line-width": 5,
              "line-gradient": gradientExpression,
            }}
          />
        </Source>

        {activeSegmentFeature && (
          <Source id="route-active" type="geojson" data={activeSegmentFeature}>
            <Layer
              id="route-active-casing"
              type="line"
              paint={{
                "line-color": "#FFFFFF",
                "line-width": 9,
              }}
            />
          </Source>
        )}

        {chargingStops.length > 0 && (
          <Source id="chargers" type="geojson" data={chargerFeatures}>
            <Layer
              id="charger-circles"
              type="circle"
              paint={{
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["get", "power_kw"],
                  50,
                  8,
                  500,
                  20,
                ],
                "circle-color": [
                  "case",
                  [">=", ["get", "power_kw"], 350],
                  "#2D4A6F",
                  "#8A8A93",
                ],
                "circle-stroke-width": 1,
                "circle-stroke-color": "#FFFFFF",
              }}
            />
          </Source>
        )}

        {selectedStop && (
          <Popup
            longitude={selectedStop.lon}
            latitude={selectedStop.lat}
            closeButton
            closeOnClick={false}
            onClose={() => setSelectedStop(null)}
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
          </Popup>
        )}
      </Map>

      <div
        className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-[var(--fv-stroke)] bg-white/95 px-3 py-2 text-xs shadow-sm"
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
