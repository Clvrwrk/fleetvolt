/// <reference types="google.maps" />
// Framework-neutral map handle (P11-02) — replaces react-map-gl's `MapRef`
// across every non-render consumer so none import react-map-gl.
//
// The Mapbox map exposed two things consumers reached for:
//   1. mapRef.current.flyTo({ center:[lon,lat], zoom, essential })  (pan/zoom)
//   2. mapRef.current.getMap().getCanvas().toDataURL("image/png")   (PNG snapshot)
//
// Those are collapsed to a minimal contract — panTo() + captureSnapshot() — so
// the tables (flyTo) and the export path (canvas snapshot) depend only on this
// abstraction. RouteMap wires a real handle in via createGoogleMapHandle().
import type { RefObject } from "react";

/** Minimal, framework-neutral map handle shared by all non-render consumers. */
export type FvMapHandle = {
  /** Pan (and optionally zoom) the map to a coordinate — flyTo() replacement. */
  panTo(lat: number, lng: number, zoom?: number): void;
  /**
   * Capture a PNG data URL of the current map view, or null if unavailable.
   * See createGoogleMapHandle() for why Google vector maps return null.
   */
  captureSnapshot(): Promise<string | null>;
};

/** React ref alias for props that used to be typed `RefObject<MapRef | null>`. */
export type FvMapRef = RefObject<FvMapHandle | null>;

/**
 * Build an FvMapHandle backed by a live google.maps.Map instance (mirrors
 * pulse-map's MapFocusController pan/zoom).
 *
 * captureSnapshot() returns null: Google's vector (WebGL) map does NOT expose a
 * canvas.toDataURL() equivalent the way Mapbox's `preserveDrawingBuffer` canvas
 * did, so client-side PNG export via getCanvas() is not portable. The export
 * path already tolerates this — registerMapSnapshotCapture(null) is a valid
 * store state, so PNG export degrades gracefully rather than crashing. If PNG
 * export is later required, it should move to a server-side Static Maps render
 * (follow-up; not a Phase-11 requirement).
 */
export function createGoogleMapHandle(
  map: google.maps.Map | null,
): FvMapHandle {
  return {
    panTo(lat: number, lng: number, zoom?: number) {
      if (!map) return;
      map.panTo({ lat, lng });
      if (typeof zoom === "number") {
        map.setZoom(zoom);
      }
    },
    async captureSnapshot() {
      // Not portable on a Google vector/WebGL map — see the note above.
      return null;
    },
  };
}
