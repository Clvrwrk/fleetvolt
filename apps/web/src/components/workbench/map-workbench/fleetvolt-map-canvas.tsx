"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  APILoadingStatus,
  APIProvider,
  Map as GoogleMap,
  RenderingType,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { MapSoftBoundary } from "@/components/map/map-soft-boundary";
import { MapTokenMissingBanner } from "@/components/map/map-token-missing-banner";
import { FleetVoltLoader } from "@/components/design/fleetvolt-loader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  useMapWorkbenchStore,
  type CaasGeoLevel,
} from "@/stores/map-workbench-store";
import { cn } from "@/lib/utils";
import { distanceToPolylineM, ON_ROUTE_MAX_M } from "@/lib/maps/route-proximity";
import { PortAnchors } from "@/components/pulse/port-anchors";
import { AssetMarkerLayer, type WorkbenchMapAsset } from "./layers/asset-marker-layer";
import {
  CaasChoroplethLayer,
} from "./layers/caas-choropleth-layer";
import { DetourLegsLayer } from "./layers/detour-legs-layer";
import { FreightFlowLayer } from "./layers/freight-flow-layer";
import { GeneratorMarkers } from "./layers/generator-markers";
import { GeneratorSpokesLayer } from "./layers/generator-spokes-layer";
import { PortDetailPopup } from "./layers/port-detail-popup";
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

/** Full California framing — San Diego to Crescent City (+ border / Vegas). */
const WC_FREIGHT_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 42.1,
  south: 32.3,
  east: -114.0,
  west: -124.6,
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

    map.fitBounds(
      mode === "caas_gap_map" ? WC_FREIGHT_BOUNDS : CA_BOUNDS,
      36,
    );
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
  showGeoRegions,
  showGeneratorSpokes,
  selectedPortCode,
  onSelectPort,
  freightViaFilter,
  caasGeoLevel,
  routeFocusActive,
  onSelectRoute,
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
  showGeoRegions: boolean;
  showGeneratorSpokes: boolean;
  selectedPortCode: string | null;
  onSelectPort: (code: string | null) => void;
  freightViaFilter: "all" | "I-15" | "I-40";
  caasGeoLevel: CaasGeoLevel;
  routeFocusActive: boolean;
  onSelectRoute: () => void;
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
        <FleetVoltLoader label="Loading map" />
      </div>
    );
  }

  return (
      <GoogleMap
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
      <CaasChoroplethLayer
        level={caasGeoLevel}
        visible={
          !routeFocusActive && showGeoRegions && visibleLayer(activeLayers, "geo-regions")
        }
        selectedAsset={selectedAsset}
        onSelectRegion={selectAsset}
      />
      <FreightFlowLayer
        visible={!routeFocusActive && showFreightFlows && visibleLayer(activeLayers, "freight-flow")}
        viaFilter={freightViaFilter}
      />
      <GeneratorSpokesLayer
        visible={!routeFocusActive && showGeneratorSpokes}
        onSelectGenerator={selectAsset}
      />
      {!routeFocusActive && showPortAnchors && visibleLayer(activeLayers, "ports") ? (
        <PortAnchors
          selectedPortCode={selectedPortCode}
          onSelect={(code) =>
            onSelectPort(selectedPortCode === code ? null : code)
          }
        />
      ) : null}
      {!routeFocusActive && showPortAnchors ? (
        <GeneratorMarkers
          portCode={selectedPortCode}
          visible={Boolean(selectedPortCode)}
        />
      ) : null}
      <RouteLayer
        coordinates={routeCoordinates}
        visible={visibleLayer(activeLayers, "route") && showRouteLayer}
        onSelectRoute={onSelectRoute}
      />
      <DetourLegsLayer
        routeCoordinates={routeCoordinates}
        selectedAsset={selectedAsset}
        visible={visibleLayer(activeLayers, "route") && showRouteLayer}
      />
      <AssetMarkerLayer
        assets={assets.filter((asset) => visibleLayer(activeLayers, asset.layerId))}
        selectedAsset={selectedAsset}
        onSelectAsset={selectAsset}
      />
    </GoogleMap>
  );
}

function layerAssetToMapAsset(asset: {
  id: string;
  type: WorkbenchMapAsset["type"];
  layerId: WorkbenchMapAsset["layerId"];
  label: string;
  latitude: number;
  longitude: number;
  subtitle?: string;
  metric?: string;
  metadata?: Record<string, unknown>;
}): WorkbenchMapAsset {
  return {
    id: asset.id,
    type: asset.type,
    layerId: asset.layerId,
    label: asset.label,
    latitude: asset.latitude,
    longitude: asset.longitude,
    ...(asset.subtitle ? { subtitle: asset.subtitle } : {}),
    ...(asset.metric ? { metric: asset.metric } : {}),
    metadata: {
      ...asset.metadata,
      carrierHref:
        typeof asset.metadata?.carrierHref === "string"
          ? asset.metadata.carrierHref
          : `/caas?view=summary&carriers=1&lat=${asset.latitude.toFixed(3)}&lng=${asset.longitude.toFixed(3)}`,
    },
  };
}

export function FleetVoltMapCanvas({ mode, className }: FleetVoltMapCanvasProps) {
  const activeLayers = useMapWorkbenchStore((state) => state.activeLayers);
  const selectedAsset = useMapWorkbenchStore((state) => state.selectedAsset);
  const routeGeometry = useMapWorkbenchStore((state) => state.routeGeometry);
  const mapAssets = useMapWorkbenchStore((state) => state.mapAssets);
  const focusBounds = useMapWorkbenchStore((state) => state.focusBounds);
  const selectAsset = useMapWorkbenchStore((state) => state.selectAsset);
  const caasPhase = useMapWorkbenchStore((state) => state.caasPhase);
  const selectedPortCode = useMapWorkbenchStore(
    (state) => state.selectedPortCode,
  );
  const setSelectedPortCode = useMapWorkbenchStore(
    (state) => state.setSelectedPortCode,
  );
  const freightViaFilter = useMapWorkbenchStore(
    (state) => state.freightViaFilter,
  );
  const caasGeoLevel = useMapWorkbenchStore((state) => state.caasGeoLevel);
  const [authError, setAuthError] = useState<string | null>(null);

  const isCaas = mode === "caas_gap_map";
  const freightOverview = isCaas && caasPhase === "freight_overview";
  // Always paint overview data layers on CaaS (freight/geo/assets) — route
  // analysis adds the A→B line on top; it must not blank the data stack.
  const showCaasDataLayers = isCaas;

  const overviewLayers = useMemo(() => {
    if (!showCaasDataLayers) return undefined;
    return activeLayers.filter((id) =>
      ["chargers", "parking", "carriers", "pois", "fleet-yards"].includes(id),
    ) as Array<"chargers" | "parking" | "carriers" | "pois" | "fleet-yards">;
  }, [activeLayers, showCaasDataLayers]);

  const assetBbox = useMemo(() => {
    if (!showCaasDataLayers) return null;
    // Prefer corridor focus for denser pins near A→B; else full west-coast frame.
    if (
      caasPhase === "route_analysis" &&
      focusBounds &&
      Number.isFinite(focusBounds.north)
    ) {
      return {
        minLat: focusBounds.south,
        minLng: focusBounds.west,
        maxLat: focusBounds.north,
        maxLng: focusBounds.east,
      };
    }
    return {
      minLat: WC_FREIGHT_BOUNDS.south,
      minLng: WC_FREIGHT_BOUNDS.west,
      maxLat: WC_FREIGHT_BOUNDS.north,
      maxLng: WC_FREIGHT_BOUNDS.east,
    };
  }, [caasPhase, focusBounds, showCaasDataLayers]);

  const overviewAssetsQuery = useQuery(
    api.workbench.queries.visibleLayers,
    showCaasDataLayers &&
      overviewLayers &&
      overviewLayers.length > 0 &&
      assetBbox
      ? {
          bbox: assetBbox,
          mode: "caas_gap_map" as const,
          layers: overviewLayers,
          limit: 400,
        }
      : "skip",
  );

  const routeCoordinates = useMemo(() => {
    // Freight overview: no sample A→B polyline — only animated port arcs.
    if (freightOverview) return [];
    const raw = routeGeometry?.coordinates ?? [];
    const valid = raw.filter((c) => isValidLatLng(c.latitude, c.longitude));
    // A route is only a route when it follows roads. Endpoint previews and
    // short fallback polylines stay hidden instead of misleading planners.
    return valid.length >= 8 ? valid : [];
  }, [freightOverview, routeGeometry?.coordinates]);

  const roadSnapStatus =
    freightOverview
      ? "empty"
      : routeCoordinates.length >= 8
        ? "road"
        : routeCoordinates.length >= 2
          ? "loading"
          : "empty";

  const assets = useMemo(() => {
    if (showCaasDataLayers) {
      const live = overviewAssetsQuery?.assets;
      const fromQuery: WorkbenchMapAsset[] = live
        ? [
            ...(live.chargers ?? []).map(layerAssetToMapAsset),
            ...(live.parking ?? []).map(layerAssetToMapAsset),
            ...(live.carriers ?? []).map(layerAssetToMapAsset),
            ...(live.pois ?? []).map(layerAssetToMapAsset),
            ...(live.fleetYards ?? []).map(layerAssetToMapAsset),
          ]
        : [];
      // Merge Calculate pins (if any) on top of statewide/corridor query pins.
      const byId = new Map<string, WorkbenchMapAsset>();
      for (const asset of [...fromQuery, ...mapAssets]) {
        if (isValidLatLng(asset.latitude, asset.longitude)) {
          byId.set(asset.id, asset);
        }
      }
      return [...byId.values()];
    }
    // Prefer live Calculate pins; fall back to mode samples only before first run.
    const source = mapAssets.length > 0 ? mapAssets : SAMPLE_ASSETS[mode];
    return source.filter((asset) =>
      isValidLatLng(asset.latitude, asset.longitude),
    );
  }, [mapAssets, mode, overviewAssetsQuery?.assets, showCaasDataLayers]);
  const routeFocusActive = selectedAsset?.type === "route";
  const routeFocusedAssets = useMemo(() => {
    if (!routeFocusActive || routeCoordinates.length < 8) return assets;
    const path = routeCoordinates.map((point) => ({
      lat: point.latitude,
      lng: point.longitude,
    }));
    return assets.filter(
      (asset) =>
        distanceToPolylineM(
          { lat: asset.latitude, lng: asset.longitude },
          path,
        ) <= ON_ROUTE_MAX_M,
    );
  }, [assets, routeCoordinates, routeFocusActive]);

  const routeProvider = routeGeometry?.provider;
  const routeDistanceMeters = routeGeometry?.distanceMeters;
  const selectRoute = useCallback(() => {
    if (routeCoordinates.length < 8) return;
    const midpoint = routeCoordinates[Math.floor(routeCoordinates.length / 2)]!;
    selectAsset({
      id: `route-${mode}`,
      type: "route",
      label: `${routeProvider?.toUpperCase() ?? "Road"} route`,
      layerId: "route",
      latitude: midpoint.latitude,
      longitude: midpoint.longitude,
      metadata: {
        provider: routeProvider ?? "unknown",
        roadPoints: routeCoordinates.length,
        distanceMiles: routeDistanceMeters
          ? Math.round((routeDistanceMeters / 1609.344) * 10) / 10
          : "unavailable",
        routeFocus: "Only assets within 0.5 miles of this route are shown",
      },
    });
  }, [mode, routeCoordinates, routeDistanceMeters, routeProvider, selectAsset]);
  const defaultBounds =
    mode === "caas_gap_map" ? WC_FREIGHT_BOUNDS : CA_BOUNDS;

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
            assets={routeFocusedAssets}
            activeLayers={activeLayers}
            selectedAsset={selectedAsset}
            focusBounds={focusBounds}
            selectAsset={selectAsset}
            defaultBounds={defaultBounds}
            authError={authError}
            showFreightFlows={
              showCaasDataLayers &&
              visibleLayer(activeLayers, "freight-flow")
            }
            showPortAnchors={
              showCaasDataLayers && visibleLayer(activeLayers, "ports")
            }
            showRouteLayer={!freightOverview && routeCoordinates.length >= 2}
            showGeoRegions={
              showCaasDataLayers &&
              visibleLayer(activeLayers, "geo-regions")
            }
            showGeneratorSpokes={showCaasDataLayers}
            selectedPortCode={selectedPortCode}
            onSelectPort={setSelectedPortCode}
            freightViaFilter={freightViaFilter}
            caasGeoLevel={caasGeoLevel}
            routeFocusActive={routeFocusActive}
            onSelectRoute={selectRoute}
          />
        </APIProvider>
      </MapSoftBoundary>

      {showCaasDataLayers && selectedPortCode && !routeFocusActive ? (
        <PortDetailPopup
          portCode={selectedPortCode}
          onClose={() => setSelectedPortCode(null)}
        />
      ) : null}

      <div className="pointer-events-none absolute left-3 top-3 rounded-2xl border border-black/10 bg-white/90 px-3 py-2 shadow-lg backdrop-blur md:left-5 md:top-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fv-steel)]">
          Google vector map
        </div>
        <div className="mt-1 text-sm font-semibold text-[var(--fv-graphite)]">
          {isCaas
            ? freightOverview
              ? "California freight & truck traffic"
              : "Corridor + freight data stack"
            : "Shared FleetVolt canvas"}
        </div>
        <div
          data-testid="route-snap-status"
          data-status={freightOverview ? "freight" : roadSnapStatus}
          className={cn(
            "mt-2 text-[10px] font-bold uppercase tracking-[0.12em]",
            freightOverview || isCaas
              ? "text-[var(--fv-blueprint-blue)]"
              : roadSnapStatus === "road"
                ? "text-[var(--fv-signal-green)]"
                : "text-[var(--fv-alert-red)]",
          )}
        >
          {freightOverview
            ? "Heavy = slow red pulse · light = fast green · fill ≤50%"
            : isCaas && routeCoordinates.length >= 2
              ? `${roadSnapStatus === "road" ? "Road-snapped" : "Preview"} · freight/geo/assets on`
            : roadSnapStatus === "road"
              ? `Road-snapped · ${routeCoordinates.length} pts`
              : "Loading road geometry · no straight-line fallback"}
        </div>
        {!freightOverview && routeCoordinates.length >= 8 ? (
          <button
            type="button"
            data-testid="route-focus-toggle"
            onClick={selectRoute}
            className="pointer-events-auto mt-2 rounded-full border border-[var(--fv-blueprint-blue)]/35 bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--fv-blueprint-blue)] shadow-sm transition hover:bg-[var(--fv-blueprint-blue)] hover:text-white"
          >
            {routeFocusActive ? "Show all map layers" : "Focus this route"}
          </button>
        ) : null}
      </div>

      <div className="absolute bottom-5 right-5 z-10">
        <SelectedAssetCard selection={selectedAsset} />
      </div>
    </div>
  );
}
