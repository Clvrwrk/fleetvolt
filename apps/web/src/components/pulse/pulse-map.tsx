"use client";

// PulseMap — the Google VECTOR base map for /pulse (FLOW-01, FLOW-07, D-02, D-09).
//
// - Vector map via @vis.gl/react-google-maps <APIProvider version="quarterly">
//   + <Map mapId renderingType=VECTOR>. A vector Map ID is MANDATORY for
//   AdvancedMarkerElement and cloud styling (Pitfall #1).
// - CAD styling comes ENTIRELY from the cloud Map ID — we pass NO inline
//   styles[] array (silently ignored on vector maps — Pitfall #2 / D-09).
// - Framed on the CA coast on load via computeCaCoastBounds() (FLOW-01).
// - The <Map> stays MOUNTED across selection changes; selection drives an
//   imperative fitBounds/panTo, never a remount (Pitfall #6).
import { useEffect, type ReactNode } from "react";
import {
  APIProvider,
  Map,
  RenderingType,
  useMap,
} from "@vis.gl/react-google-maps";
import { computeCaCoastBounds, type LatLng } from "@/lib/ca-framing";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;

const CA_BOUNDS = computeCaCoastBounds();

type PulseMapProps = {
  /** Port anchors etc. render as children inside the <Map>. */
  children?: ReactNode;
  /** When set, the map imperatively pans/zooms to focus this coordinate. */
  focusPoint?: LatLng | null;
};

/**
 * Imperative focus controller. Lives INSIDE <Map> so useMap() resolves the
 * mounted map instance; pans/zooms on focusPoint change without remounting.
 */
function MapFocusController({ focusPoint }: { focusPoint?: LatLng | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (focusPoint) {
      map.panTo({ lat: focusPoint.lat, lng: focusPoint.lng });
      map.setZoom(11);
    } else {
      // No selection — reframe to the full CA coast.
      map.fitBounds(CA_BOUNDS);
    }
  }, [map, focusPoint]);

  return null;
}

/**
 * Graceful fallback when the Google key / Map ID is not configured — parity
 * with the retiring Mapbox "token missing" banner.
 */
function MapUnavailable() {
  return (
    <div
      data-testid="pulse-map-unavailable"
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
 * The framed vector base map. Wrapped in TechnicalFrame by PulseSurface; keep
 * the map inset so Google's mandated attribution/logo stays visible (Pitfall #10).
 */
export function PulseMap({ children, focusPoint }: PulseMapProps) {
  if (!API_KEY || !MAP_ID) {
    return <MapUnavailable />;
  }

  return (
    <div
      data-testid="pulse-map"
      className="relative h-full min-h-[420px] w-full overflow-hidden rounded-2xl"
    >
      <APIProvider apiKey={API_KEY} version="quarterly">
        <Map
          mapId={MAP_ID}
          renderingType={RenderingType.VECTOR}
          defaultBounds={CA_BOUNDS}
          gestureHandling="greedy"
          disableDefaultUI
          // NO styles[] — CAD styling is on the cloud Map ID (D-09, Pitfall #2).
          className="h-full w-full"
          data-testid="pulse-map-canvas"
        >
          <MapFocusController focusPoint={focusPoint} />
          {children}
        </Map>
      </APIProvider>
    </div>
  );
}
