"use client";

import { useEffect, useRef } from "react";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useWorkOSAuth } from "@/lib/auth";
import {
  endpointGeometry,
  normalizeRouteCoordinates,
  pickCoreCorridor,
} from "@/lib/workbench/core-routes";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import type { WorkbenchMapAsset } from "./layers/asset-marker-layer";
import type {
  RouteGeometryResult,
  WorkbenchMode,
  WorkbenchPlace,
  WorkbenchResultCard,
} from "./types";

type WorkbenchBootstrapProps = {
  mode: WorkbenchMode;
};

function asPlace(raw: {
  label: string;
  latitude: number;
  longitude: number;
  kind?: string;
  source?: string;
  id?: string;
}): WorkbenchPlace | null {
  if (!Number.isFinite(raw.latitude) || !Number.isFinite(raw.longitude)) {
    return null;
  }
  return {
    id: raw.id,
    label: raw.label,
    latitude: raw.latitude,
    longitude: raw.longitude,
    kind: (raw.kind as WorkbenchPlace["kind"]) ?? "manual",
    source: (raw.source as WorkbenchPlace["source"]) ?? "manual",
  };
}

function geometryFromRun(
  raw: unknown,
  origin: WorkbenchPlace,
  destination: WorkbenchPlace,
): RouteGeometryResult {
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const coordinates = normalizeRouteCoordinates(record.coordinates);
    if (coordinates.length >= 2) {
      return {
        provider:
          record.provider === "google" ||
          record.provider === "ptv" ||
          record.provider === "valhalla" ||
          record.provider === "mock"
            ? record.provider
            : "google",
        coordinates,
        distanceMeters:
          typeof record.distanceMeters === "number" ? record.distanceMeters : undefined,
        durationSeconds:
          typeof record.durationSeconds === "number" ? record.durationSeconds : undefined,
        warnings: Array.isArray(record.warnings)
          ? record.warnings.filter((w): w is string => typeof w === "string")
          : undefined,
      };
    }
  }
  return endpointGeometry(origin, destination);
}

function anonSeed(): string {
  try {
    const existing = window.localStorage.getItem("fv_anon_seed");
    if (existing) return existing;
    const seed =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s${Date.now().toString(36)}`;
    window.localStorage.setItem("fv_anon_seed", seed);
    return seed;
  } catch {
    return "anon-fallback";
  }
}

/** True when geometry has enough vertices to be a road-following polyline. */
function isRoadSnapped(geometry: RouteGeometryResult | null | undefined): boolean {
  return Boolean(geometry && geometry.coordinates.length >= 8);
}

/**
 * On workbench open: restore last Convex run for this user+mode, else seed a
 * stable per-user core corridor. Then ALWAYS upgrade to Google road-snapped
 * polylines via workbench/actions:routeGeometry (retries on failure).
 */
export function WorkbenchBootstrap({ mode }: WorkbenchBootstrapProps) {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useWorkOSAuth();
  const appliedKey = useRef<string | null>(null);
  const snapInFlight = useRef<string | null>(null);
  const fetchRouteGeometry = useAction(api["workbench/actions"].routeGeometry);

  const latestRun = useQuery(
    api["workbench/runs"].getLatestRun,
    isAuthenticated ? { mode } : "skip",
  );

  const originLat = useMapWorkbenchStore((s) => s.draft.origin?.latitude);
  const originLng = useMapWorkbenchStore((s) => s.draft.origin?.longitude);
  const destLat = useMapWorkbenchStore((s) => s.draft.destination?.latitude);
  const destLng = useMapWorkbenchStore((s) => s.draft.destination?.longitude);

  useEffect(() => {
    const key = `${mode}:${user?.id ?? "anon"}:${latestRun === undefined ? "loading" : latestRun?._id ?? "none"}`;
    if (appliedKey.current === key) return;
    if (isAuthenticated && latestRun === undefined) return;

    if (latestRun) {
      const origin = asPlace(latestRun.origin);
      const destination = asPlace(latestRun.destination);
      if (origin && destination) {
        const geometry = geometryFromRun(latestRun.routeGeometry, origin, destination);
        useMapWorkbenchStore.setState({
          mode,
          draft: {
            ...useMapWorkbenchStore.getState().draft,
            origin,
            destination,
            metadata: {
              ...(useMapWorkbenchStore.getState().draft.metadata ?? {}),
              ...(latestRun.metadata && typeof latestRun.metadata === "object"
                ? (latestRun.metadata as Record<string, unknown>)
                : {}),
              bootstrapSource: "last_run",
            },
          },
          routeGeometry: geometry,
          resultCards: Array.isArray(latestRun.resultCards)
            ? (latestRun.resultCards as WorkbenchResultCard[])
            : useMapWorkbenchStore.getState().resultCards,
          mapAssets: Array.isArray(
            (latestRun.metadata as { mapPins?: unknown } | undefined)?.mapPins,
          )
            ? ((latestRun.metadata as { mapPins: WorkbenchMapAsset[] }).mapPins)
            : [],
          providerWarnings: latestRun.providerWarnings ?? [],
        });
        appliedKey.current = key;
        return;
      }
    }

    const userKey = user?.id ?? `anon:${anonSeed()}`;
    const corridor = pickCoreCorridor(userKey);
    useMapWorkbenchStore.setState({
      mode,
      draft: {
        ...useMapWorkbenchStore.getState().draft,
        origin: corridor.origin,
        destination: corridor.destination,
        metadata: {
          ...(useMapWorkbenchStore.getState().draft.metadata ?? {}),
          bootstrapSource: "core_corridor",
          coreCorridorId: corridor.id,
        },
      },
      // Temporary straight line only — road snap replaces this immediately.
      routeGeometry: endpointGeometry(corridor.origin, corridor.destination),
      providerWarnings: [
        `${corridor.label} preview (${corridor.meta}). Snapping to Google roads…`,
      ],
    });
    appliedKey.current = key;
  }, [isAuthenticated, latestRun, mode, user?.id]);

  // Road-snap whenever endpoints change. Retries so a cancelled Strict Mode
  // pass or transient Convex error doesn't leave a crow-flies line forever.
  useEffect(() => {
    if (
      originLat === undefined ||
      originLng === undefined ||
      destLat === undefined ||
      destLng === undefined
    ) {
      return;
    }

    const key = `${mode}:${originLat},${originLng}->${destLat},${destLng}`;
    const current = useMapWorkbenchStore.getState().routeGeometry;
    if (isRoadSnapped(current) && snapInFlight.current === key) {
      return;
    }
    if (isRoadSnapped(current) && current?.provider === "google") {
      snapInFlight.current = key;
      return;
    }

    let cancelled = false;
    snapInFlight.current = key;

    void (async () => {
      const maxAttempts = 3;
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (cancelled) return;
        try {
          const snapped = (await fetchRouteGeometry({
            origin: { latitude: originLat, longitude: originLng },
            destination: { latitude: destLat, longitude: destLng },
            provider: "google",
          })) as RouteGeometryResult;

          if (cancelled) return;

          const live = useMapWorkbenchStore.getState().draft;
          if (
            live.origin?.latitude !== originLat ||
            live.origin?.longitude !== originLng ||
            live.destination?.latitude !== destLat ||
            live.destination?.longitude !== destLng
          ) {
            return;
          }

          if (!snapped.coordinates || snapped.coordinates.length < 2) {
            lastError = new Error(
              snapped.warnings?.join("; ") || "Google Routes returned no geometry",
            );
            continue;
          }

          // Still only 2 points = crow-flies fallback from the action.
          if (snapped.coordinates.length < 8) {
            lastError = new Error(
              snapped.warnings?.join("; ") ||
                "Google Routes fell back to endpoint geometry (check API key / Routes API enablement)",
            );
            useMapWorkbenchStore.setState({
              providerWarnings: [
                "Road snap incomplete — showing straight-line preview.",
                ...(snapped.warnings ?? []),
              ],
            });
            continue;
          }

          useMapWorkbenchStore.setState({
            routeGeometry: snapped,
            providerWarnings: Array.from(
              new Set([
                ...(snapped.warnings ?? []),
                "Google road geometry (follows highways). Run Calculate for physics + Class 8 stops.",
              ]),
            ),
          });
          return;
        } catch (error) {
          lastError = error;
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 400 * attempt));
          }
        }
      }

      if (cancelled) return;
      const message =
        lastError instanceof Error ? lastError.message : String(lastError ?? "unknown error");
      console.error("[workbench] road snap failed after retries", lastError);
      useMapWorkbenchStore.setState({
        providerWarnings: [
          `Road snap failed — straight line is NOT the drive path. ${message}`,
        ],
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [destLat, destLng, fetchRouteGeometry, mode, originLat, originLng]);

  return null;
}
