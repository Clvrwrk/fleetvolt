"use client";

// HotspotMap — the Google VECTOR base map for /hotspot (P15-01).
//
// - Vector map via @vis.gl/react-google-maps <APIProvider version="quarterly">
//   + <Map mapId renderingType=VECTOR> — mirrors pulse-map.tsx exactly.
// - Three zoom levels drive which data layer renders:
//     nation (zoom ≤5)  → state-level geoRegions (aggregateScore pins)
//     state   (zoom 6–8) → county-level geoRegions (aggregateScore pins)
//     county  (zoom ≥9)  → individual modeledDwell hotspot pins (score pins)
// - The <Map> stays MOUNTED across zoom changes; zoom transitions drive an
//   imperative data-layer swap via ZoomLevelController (parity with pulse-map.tsx
//   MapFocusController pattern — never a remount).
// - Pins are <AdvancedMarker> (NEVER google.maps.Marker), sized by
//   scoreToRadiusPx, colored by scoreToColor, labeled "(modeled)" in the title.
import { useEffect, useState, type ReactNode } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  RenderingType,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  zoomLevelForZoom,
  scoreToColor,
  scoreToRadiusPx,
  type ZoomLevel,
} from "@/lib/hotspot-zoom";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;

// US framing bounds (nation view).
const US_BOUNDS = {
  north: 49.5,
  south: 24.4,
  east: -66.5,
  west: -125.0,
};

// ── Data types (matching the Convex query returns) ──────────────────────────
interface HotspotPin {
  _id: string;
  title: string;
  location: { lat: number; lng: number };
  score?: number;
  scoreInputs?: unknown;
}

interface GeoRegion {
  _id: string;
  fips: string;
  name: string;
  level: "nation" | "state" | "county";
  parentFips: string | null;
  centroid: { lat: number; lng: number } | null;
  bbox: unknown;
  aggregateScore: number | null;
}

export type HotspotMapProps = {
  hotspots: HotspotPin[] | undefined;
  geoRegions: GeoRegion[] | undefined;
  onHotspotSelect?: (h: {
    lat: number;
    lng: number;
    hotspotId: string;
    title: string;
  }) => void;
};

/**
 * Imperative zoom-level controller. Lives INSIDE <Map> so useMap() resolves the
 * mounted map instance; listens to 'zoom_changed' and updates the zoom level
 * state — never remounts the map (parity with pulse-map.tsx MapFocusController).
 */
function ZoomLevelController({
  onZoomChange,
}: {
  onZoomChange: (level: ZoomLevel) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const update = () => {
      const z = map.getZoom();
      if (typeof z === "number") {
        onZoomChange(zoomLevelForZoom(z));
      }
    };

    // Set initial level.
    update();

    const listener = map.addListener("zoom_changed", update);
    return () => {
      listener.remove();
    };
  }, [map, onZoomChange]);

  return null;
}

/**
 * Graceful fallback when the Google key / Map ID is not configured — parity
 * with pulse-map.tsx MapUnavailable.
 */
function MapUnavailable() {
  return (
    <div
      data-testid="hotspot-map-unavailable"
      className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed p-6 text-center"
      style={{ borderColor: "var(--color-line)" }}
    >
      <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase leading-relaxed tracking-[0.12em] text-[var(--color-text-secondary)]">
        Map unavailable — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and
        NEXT_PUBLIC_GOOGLE_MAP_ID
      </p>
    </div>
  );
}

/**
 * Render state-level geoRegions as aggregate-score pins (nation zoom).
 */
function RegionPins({
  regions,
  level,
}: {
  regions: GeoRegion[];
  level: "state" | "county";
}) {
  const filtered = regions.filter(
    (r) => r.level === level && r.centroid !== null,
  );

  return (
    <>
      {filtered.map((r) => {
        const score = r.aggregateScore ?? 0;
        const radius = scoreToRadiusPx(score);
        const color = scoreToColor(score);
        return (
          <AdvancedMarker
            key={r._id}
            position={r.centroid!}
            title={`${r.name} — aggregate score ${score.toFixed(3)} (modeled)`}
          >
            <div
              style={{
                width: radius * 2,
                height: radius * 2,
                borderRadius: "9999px",
                backgroundColor: color,
                border: "1px solid #FFFFFF",
                boxSizing: "border-box",
                cursor: "pointer",
                opacity: 0.85,
              }}
            />
          </AdvancedMarker>
        );
      })}
    </>
  );
}

/**
 * Render individual modeledDwell hotspot pins (county zoom).
 * Title includes "(modeled)" — NEVER "observed".
 */
function HotspotPins({
  hotspots,
  onSelect,
}: {
  hotspots: HotspotPin[];
  onSelect?: HotspotMapProps["onHotspotSelect"];
}) {
  return (
    <>
      {hotspots.map((h) => {
        const score = typeof h.score === "number" ? h.score : 0;
        const radius = scoreToRadiusPx(score);
        const color = scoreToColor(score);
        return (
          <AdvancedMarker
            key={h._id}
            position={h.location}
            title={`${h.title} — score ${score.toFixed(3)} (modeled)`}
            onClick={() =>
              onSelect?.({
                lat: h.location.lat,
                lng: h.location.lng,
                hotspotId: h._id,
                title: h.title,
              })
            }
          >
            <div
              data-testid="hotspot-pin"
              data-hotspot-id={h._id}
              style={{
                width: radius * 2,
                height: radius * 2,
                borderRadius: "9999px",
                backgroundColor: color,
                border: "1px solid #FFFFFF",
                boxSizing: "border-box",
                cursor: "pointer",
              }}
            />
          </AdvancedMarker>
        );
      })}
    </>
  );
}

/**
 * The framed vector base map. Wrapped in TechnicalFrame by HotspotExplorer.
 */
export function HotspotMap({
  hotspots,
  geoRegions,
  onHotspotSelect,
}: HotspotMapProps) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("nation");

  if (!API_KEY || !MAP_ID) {
    return <MapUnavailable />;
  }

  return (
    <div
      data-testid="hotspot-map"
      className="relative h-full min-h-[420px] w-full overflow-hidden rounded-2xl"
    >
      <APIProvider apiKey={API_KEY} version="quarterly">
        <Map
          mapId={MAP_ID}
          renderingType={RenderingType.VECTOR}
          defaultBounds={US_BOUNDS}
          gestureHandling="greedy"
          disableDefaultUI
          className="h-full w-full"
          data-testid="hotspot-map-canvas"
        >
          <ZoomLevelController onZoomChange={setZoomLevel} />

          {zoomLevel === "nation" && geoRegions && (
            <RegionPins regions={geoRegions} level="state" />
          )}

          {zoomLevel === "state" && geoRegions && (
            <RegionPins regions={geoRegions} level="county" />
          )}

          {zoomLevel === "county" && hotspots && (
            <HotspotPins hotspots={hotspots} onSelect={onHotspotSelect} />
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
