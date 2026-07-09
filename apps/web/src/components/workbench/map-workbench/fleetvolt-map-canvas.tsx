"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APILoadingStatus,
  APIProvider,
  Map,
  RenderingType,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps";
import { MapSoftBoundary } from "@/components/map/map-soft-boundary";
import { MapTokenMissingBanner } from "@/components/map/map-token-missing-banner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import { cn } from "@/lib/utils";
import { PortAnchors } from "@/components/pulse/port-anchors";
import { AssetMarkerLayer, type WorkbenchMapAsset } from "./layers/asset-marker-layer";
import { DetourLegsLayer } from "./layers/detour-legs-layer";
import { FreightFlowLayer } from "./layers/freight-flow-layer";
import { GeoRegionLayer, type WorkbenchGeoRegion } from "./layers/geo-region-layer";
import { RouteLayer } from "./layers/route-layer";
import { SelectedAssetCard } from "./layers/selected-asset-card";
import type {
  RouteCoordinate,
  WorkbenchMode,
  WorkbenchSelection,
} from "./types";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
/** Prefer monochrome cloud style when configured; fall back to the primary vector Map ID. */
const MAP_ID =
  process.env.NEXT_PUBLIC_GOOGLE_MAP_ID_MONOCHROME ||
  process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;

const CA_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 42.1,
  south: 32.3,
  east: -114.1,
  west: -124.6,
};

const US_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 49.5,
  south: 24.4,
  east: -66.5,
  west: -125.0,
};

/** West-coast freight overview framing (ports + inland corridors). */
const WC_FREIGHT_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 42.2,
  south: 31.8,
  east: -111.5,
  west: -125.0,
};

const SAMPLE_ROUTES: Record<WorkbenchMode, RouteCoordinate[]> = {
  driver_day_plan: [
    { latitude: 33.7542, longitude: -118.2165 },
    { latitude: 33.9022, longitude: -117.8854 },
    { latitude: 34.1064, longitude: -117.5931 },
    { latitude: 34.8958, longitude: -117.0173 },
  ],
  fleet_contract_plan: [
    { latitude: 33.7542, longitude: -118.2165 },
    { latitude: 34.0556, longitude: -117.1825 },
    { latitude: 34.5361, longitude: -117.2912 },
    { latitude: 35.3733, longitude: -119.0187 },
  ],
  caas_gap_map: [
    { latitude: 37.8044, longitude: -122.2712 },
    { latitude: 37.7397, longitude: -121.4252 },
    { latitude: 36.7378, longitude: -119.7871 },
    { latitude: 34.0522, longitude: -118.2437 },
  ],
};

const SAMPLE_ASSETS: Record<WorkbenchMode, WorkbenchMapAsset[]> = {
  driver_day_plan: [
    {
      id: "charger-ontario-hd",
      type: "charger",
      layerId: "chargers",
      label: "Ontario Class 8 charging plaza",
      latitude: 34.0573,
      longitude: -117.6509,
      subtitle: "350 kW · trailer friendly",
      metric: "350 kW",
      metadata: { status: "candidate", access: "trailer friendly", source: "sample layer" },
    },
    {
      id: "parking-fontana-yard",
      type: "parking",
      layerId: "parking",
      label: "Fontana overnight truck parking",
      latitude: 34.0922,
      longitude: -117.435,
      subtitle: "secure parking near I-10",
      metric: "42 bays",
      metadata: { siteAccess: "24/7", source: "sample layer" },
    },
    {
      id: "poi-barstow-rest",
      type: "poi",
      layerId: "pois",
      label: "Barstow driver services",
      latitude: 34.8958,
      longitude: -117.0173,
      subtitle: "food · rest · staging",
      metric: "POI",
      metadata: { category: "driver amenity", source: "sample layer" },
    },
  ],
  fleet_contract_plan: [
    {
      id: "fleet-yard-redlands",
      type: "fleet-yard",
      layerId: "fleet-yards",
      label: "Redlands fleet yard",
      latitude: 34.0556,
      longitude: -117.1825,
      subtitle: "yard return candidate",
      metric: "Yard",
      metadata: { dwell: "45 min", source: "sample layer" },
    },
    {
      id: "charger-victorville-hd",
      type: "charger",
      layerId: "chargers",
      label: "Victorville HD charger",
      latitude: 34.5361,
      longitude: -117.2912,
      subtitle: "contract route charge stop",
      metric: "420 kW",
      metadata: { status: "candidate", source: "sample layer" },
    },
    {
      id: "highway-i15-flow",
      type: "highway",
      layerId: "highways",
      label: "I-15 freight segment",
      latitude: 34.2483,
      longitude: -117.41,
      subtitle: "high freight intensity",
      metric: "AADT+",
      metadata: { modeled: true, source: "sample layer" },
    },
  ],
  caas_gap_map: [
    {
      id: "gap-central-valley",
      type: "class8-gap",
      layerId: "class8-gaps",
      label: "Central Valley Class 8 gap",
      latitude: 36.7378,
      longitude: -119.7871,
      subtitle: "modeled charger coverage gap",
      metric: "Gap",
      metadata: { method: "modeled", source: "sample layer" },
    },
    {
      id: "carrier-stockton-cluster",
      type: "carrier",
      layerId: "carriers",
      label: "Stockton carrier cluster",
      latitude: 37.9577,
      longitude: -121.2908,
      subtitle: "drayage outreach cluster",
      metric: "Carriers",
      metadata: { method: "modeled", source: "sample layer" },
    },
    {
      id: "caas-zone-la-basin",
      type: "caas-zone",
      layerId: "caas-zones",
      label: "LA Basin mobile CaaS zone",
      latitude: 34.0522,
      longitude: -118.2437,
      subtitle: "deployment opportunity",
      metric: "Zone",
      metadata: { priority: "medium", source: "sample layer" },
    },
  ],
};

const SAMPLE_REGIONS: WorkbenchGeoRegion[] = [
  {
    id: "ca-state-region",
    name: "California freight opportunity",
    level: "state",
    centroid: { latitude: 36.7783, longitude: -119.4179 },
    bbox: [-124.6, 32.3, -114.1, 42.1],
    score: 0.82,
    metadata: { method: "modeled", coverage: "state" },
  },
  {
    id: "la-county-region",
    name: "Los Angeles County",
    level: "county",
    centroid: { latitude: 34.3207, longitude: -118.2248 },
    bbox: [-118.95, 33.7, -117.65, 34.85],
    score: 0.73,
    metadata: { method: "modeled", coverage: "county" },
  },
  {
    id: "san-joaquin-region",
    name: "San Joaquin freight corridor",
    level: "county",
    centroid: { latitude: 37.934, longitude: -121.2722 },
    bbox: [-121.65, 37.48, -120.91, 38.28],
    score: 0.58,
    metadata: { method: "modeled", coverage: "county" },
  },
];

type FleetVoltMapCanvasProps = {
  mode: WorkbenchMode;
  className?: string;
};

function boundsForCoordinates(
  coordinates: RouteCoordinate[],
): google.maps.LatLngBoundsLiteral | null {
  if (coordinates.length === 0) {
    return null;
  }

  return coordinates.reduce<google.maps.LatLngBoundsLiteral>(
    (bounds, coordinate) => ({
      north: Math.max(bounds.north, coordinate.latitude),
      south: Math.min(bounds.south, coordinate.latitude),
      east: Math.max(bounds.east, coordinate.longitude),
      west: Math.min(bounds.west, coordinate.longitude),
    }),
    {
      north: coordinates[0]!.latitude,
      south: coordinates[0]!.latitude,
      east: coordinates[0]!.longitude,
      west: coordinates[0]!.longitude,
    },
  );
}

function paddedBounds(bounds: google.maps.LatLngBoundsLiteral): google.maps.LatLngBoundsLiteral {
  const latPad = Math.max(0.05, (bounds.north - bounds.south) * 0.18);
  const lngPad = Math.max(0.05, (bounds.east - bounds.west) * 0.18);

  return {
    north: bounds.north + latPad,
    south: bounds.south - latPad,
    east: bounds.east + lngPad,
    west: bounds.west - lngPad,
  };
}

function MapFocusController({
  mode,
  routeCoordinates,
  selectedAsset,
  focusBounds,
}: {
  mode: WorkbenchMode;
  routeCoordinates: RouteCoordinate[];
  selectedAsset: WorkbenchSelection | null;
  focusBounds: google.maps.LatLngBoundsLiteral | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) {
      return;
    }

    if (focusBounds) {
      map.fitBounds(paddedBounds(focusBounds), 48);
      return;
    }

    if (
      selectedAsset &&
      typeof selectedAsset.latitude === "number" &&
      Number.isFinite(selectedAsset.latitude) &&
      typeof selectedAsset.longitude === "number" &&
      Number.isFinite(selectedAsset.longitude)
    ) {
      map.panTo({ lat: selectedAsset.latitude, lng: selectedAsset.longitude });
      const zoom = map.getZoom();
      if (typeof zoom !== "number" || zoom < 9) {
        map.setZoom(10);
      }
      return;
    }

    const routeBounds = boundsForCoordinates(
      routeCoordinates.filter(
        (c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude),
      ),
    );
    if (routeBounds) {
      map.fitBounds(paddedBounds(routeBounds), 56);
      return;
    }

    map.fitBounds(mode === "caas_gap_map" ? US_BOUNDS : CA_BOUNDS, 36);
  }, [map, focusBounds, mode, routeCoordinates, selectedAsset]);

  return null;
}

function visibleLayer(activeLayers: string[], layerId: string): boolean {
  return activeLayers.includes(layerId);
}

function isValidLatLng(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

function MapsAuthFallback({ message }: { message: string | null }) {
  return (
    <div
      data-testid="map-auth-failure"
      className="flex h-full min-h-[420px] w-full items-center justify-center p-4"
    >
      <Alert className="max-w-lg border-[var(--fv-stroke)] bg-[var(--fv-surface)]">
        <AlertTitle>Map blocked by Google API key</AlertTitle>
        <AlertDescription className="space-y-2 text-muted-foreground">
          <p>
            The Maps JavaScript key rejected this site (usually a missing HTTP referrer). Tools and
            result cards remain available.
          </p>
          <p className="text-xs">
            Allowlist must include both <code>https://fleetvolt.network/*</code> and{" "}
            <code>https://*.fleetvolt.network/*</code> (apex ≠ subdomain wildcard).
          </p>
          {message ? (
            <p className="rounded-lg bg-black/5 px-3 py-2 font-mono text-xs">{message}</p>
          ) : null}
        </AlertDescription>
      </Alert>
    </div>
  );
}

/**
 * Only mount AdvancedMarker / Map children after Maps auth succeeds.
 * AUTH_FAILURE still reports LOADED first; markers then crash with
 * `Cannot read properties of undefined (reading 'get')`.
 */
function MapCanvasBody({
  mode,
  mapId,
  routeCoordinates,
  assets,
  activeLayers,
  selectedAsset,
  focusBounds,
  selectAsset,
  defaultBounds,
  authError,
  showFreightFlows,
  showPortAnchors,
  showRouteLayer,
}: {
  mode: WorkbenchMode;
  mapId: string;
  routeCoordinates: RouteCoordinate[];
  assets: WorkbenchMapAsset[];
  activeLayers: string[];
  selectedAsset: WorkbenchSelection | null;
  focusBounds: google.maps.LatLngBoundsLiteral | null;
  selectAsset: (selection: WorkbenchSelection | null) => void;
  defaultBounds: google.maps.LatLngBoundsLiteral;
  authError: string | null;
  showFreightFlows: boolean;
  showPortAnchors: boolean;
  showRouteLayer: boolean;
}) {
  const status = useApiLoadingStatus();

  // AUTH_FAILURE often arrives after a brief LOADED state; prefer explicit onError too.
  if (
    authError ||
    status === APILoadingStatus.AUTH_FAILURE ||
    status === APILoadingStatus.FAILED
  ) {
    return <MapsAuthFallback message={authError ?? status} />;
  }

  if (status !== APILoadingStatus.LOADED) {
    return (
      <div
        data-testid="map-loading"
        className="flex h-full min-h-[420px] w-full items-center justify-center text-sm text-[var(--fv-steel)]"
      >
        Loading map…
      </div>
    );
  }

  return (
    <Map
      mapId={mapId}
      renderingType={RenderingType.VECTOR}
      defaultBounds={defaultBounds}
      gestureHandling="greedy"
      disableDefaultUI
      className="h-full w-full"
      data-testid="fleetvolt-vector-map"
    >
      <MapFocusController
        mode={mode}
        routeCoordinates={routeCoordinates}
        selectedAsset={selectedAsset}
        focusBounds={focusBounds}
      />
      <FreightFlowLayer
        visible={showFreightFlows && visibleLayer(activeLayers, "freight-flow")}
      />
      {showPortAnchors && visibleLayer(activeLayers, "ports") ? (
        <PortAnchors />
      ) : null}
      <RouteLayer
        coordinates={routeCoordinates}
        visible={visibleLayer(activeLayers, "route") && showRouteLayer}
      />
      <DetourLegsLayer
        routeCoordinates={routeCoordinates}
        selectedAsset={selectedAsset}
        visible={visibleLayer(activeLayers, "route") && showRouteLayer}
      />
      <GeoRegionLayer
        regions={SAMPLE_REGIONS}
        visible={visibleLayer(activeLayers, "geo-regions")}
        selectedAsset={selectedAsset}
        onSelectRegion={selectAsset}
      />
      <AssetMarkerLayer
        assets={assets.filter((asset) => visibleLayer(activeLayers, asset.layerId))}
        selectedAsset={selectedAsset}
        onSelectAsset={selectAsset}
      />
    </Map>
  );
}

export function FleetVoltMapCanvas({ mode, className }: FleetVoltMapCanvasProps) {
  const storeMode = useMapWorkbenchStore((state) => state.mode);
  const reset = useMapWorkbenchStore((state) => state.reset);
  const activeLayers = useMapWorkbenchStore((state) => state.activeLayers);
  const selectedAsset = useMapWorkbenchStore((state) => state.selectedAsset);
  const routeGeometry = useMapWorkbenchStore((state) => state.routeGeometry);
  const mapAssets = useMapWorkbenchStore((state) => state.mapAssets);
  const focusBounds = useMapWorkbenchStore((state) => state.focusBounds);
  const selectAsset = useMapWorkbenchStore((state) => state.selectAsset);
  const caasPhase = useMapWorkbenchStore((state) => state.caasPhase);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (storeMode !== mode) {
      reset(mode);
    }
  }, [mode, reset, storeMode]);

  const freightOverview =
    mode === "caas_gap_map" && caasPhase === "freight_overview";

  const routeCoordinates = useMemo(() => {
    // Freight overview: no sample A→B polyline — only animated port arcs.
    if (freightOverview) return [];
    const raw = routeGeometry?.coordinates ?? [];
    const valid = raw.filter((c) => isValidLatLng(c.latitude, c.longitude));
    return valid.length >= 2 ? valid : SAMPLE_ROUTES[mode];
  }, [freightOverview, mode, routeGeometry?.coordinates]);

  const roadSnapStatus =
    freightOverview
      ? "empty"
      : routeCoordinates.length >= 8
        ? "road"
        : routeCoordinates.length >= 2
          ? "preview"
          : "empty";

  const assets = useMemo(() => {
    // Prefer live Calculate pins; fall back to mode samples only before first run.
    // Freight overview: hide sample route pins so arcs dominate.
    if (freightOverview && mapAssets.length === 0) return [];
    const source = mapAssets.length > 0 ? mapAssets : SAMPLE_ASSETS[mode];
    return source.filter((asset) => isValidLatLng(asset.latitude, asset.longitude));
  }, [freightOverview, mapAssets, mode]);
  const defaultBounds =
    mode === "caas_gap_map"
      ? freightOverview
        ? WC_FREIGHT_BOUNDS
        : US_BOUNDS
      : CA_BOUNDS;

  if (!API_KEY || !MAP_ID) {
    return (
      <div
        data-testid="fleetvolt-map-canvas"
        className={cn("flex h-full min-h-[420px] w-full items-center justify-center p-4", className)}
      >
        <MapTokenMissingBanner />
      </div>
    );
  }

  return (
    <div
      data-testid="fleetvolt-map-canvas"
      className={cn("relative h-full min-h-[420px] w-full overflow-hidden", className)}
    >
      <MapSoftBoundary label="workbench-map">
        <APIProvider
          apiKey={API_KEY}
          version="quarterly"
          onError={(error) => {
            const message =
              error instanceof Error
                ? error.message
                : typeof error === "string"
                  ? error
                  : "Google Maps failed to load";
            console.warn("[FleetVoltMapCanvas] Maps API error:", message);
            setAuthError(message);
          }}
        >
          <MapCanvasBody
            mode={mode}
            mapId={MAP_ID}
            routeCoordinates={routeCoordinates}
            assets={assets}
            activeLayers={activeLayers}
            selectedAsset={selectedAsset}
            focusBounds={focusBounds}
            selectAsset={selectAsset}
            defaultBounds={defaultBounds}
            authError={authError}
            showFreightFlows={
              freightOverview && visibleLayer(activeLayers, "freight-flow")
            }
            showPortAnchors={freightOverview}
            showRouteLayer={!freightOverview}
          />
        </APIProvider>
      </MapSoftBoundary>

      <div className="pointer-events-none absolute left-3 top-3 rounded-2xl border border-black/10 bg-white/90 px-3 py-2 shadow-lg backdrop-blur md:left-5 md:top-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fv-steel)]">
          Google vector map
        </div>
        <div className="mt-1 text-sm font-semibold text-[var(--fv-graphite)]">
          {freightOverview
            ? "West-coast freight movement"
            : "Shared FleetVolt canvas"}
        </div>
        <div
          data-testid="route-snap-status"
          data-status={freightOverview ? "freight" : roadSnapStatus}
          className={cn(
            "mt-2 text-[10px] font-bold uppercase tracking-[0.12em]",
            freightOverview
              ? "text-[var(--fv-blueprint-blue)]"
              : roadSnapStatus === "road"
                ? "text-[var(--fv-signal-green)]"
                : "text-[var(--fv-alert-red)]",
          )}
        >
          {freightOverview
            ? "Static freight arcs · green / yellow / red by volume"
            : roadSnapStatus === "road"
              ? `Road-snapped · ${routeCoordinates.length} pts`
              : "Straight-line preview · snapping to roads…"}
        </div>
      </div>

      <div className="absolute bottom-5 right-5 z-10">
        <SelectedAssetCard selection={selectedAsset} />
      </div>
    </div>
  );
}
