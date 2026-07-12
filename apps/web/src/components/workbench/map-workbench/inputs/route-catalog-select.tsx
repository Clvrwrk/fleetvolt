"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import type { WorkbenchPlace } from "../types";

function asWorkbenchPlace(
  place: {
    id?: string;
    label: string;
    latitude: number;
    longitude: number;
    kind: string;
    source: string;
  },
  fallbackKind: WorkbenchPlace["kind"],
): WorkbenchPlace {
  const allowedKinds = new Set<WorkbenchPlace["kind"]>([
    "address",
    "port",
    "charger",
    "parking",
    "fleet-yard",
    "carrier",
    "poi",
    "geo-region",
    "manual",
  ]);
  const allowedSources = new Set<WorkbenchPlace["source"]>([
    "fleetvolt",
    "google",
    "manual",
  ]);
  return {
    ...place,
    kind: allowedKinds.has(place.kind as WorkbenchPlace["kind"])
      ? (place.kind as WorkbenchPlace["kind"])
      : fallbackKind,
    source: allowedSources.has(place.source as WorkbenchPlace["source"])
      ? (place.source as WorkbenchPlace["source"])
      : "fleetvolt",
  };
}

function boundsFromCoordinates(
  coordinates: Array<{ latitude: number; longitude: number }>,
) {
  let north = coordinates[0]!.latitude;
  let south = north;
  let east = coordinates[0]!.longitude;
  let west = east;
  for (const point of coordinates) {
    north = Math.max(north, point.latitude);
    south = Math.min(south, point.latitude);
    east = Math.max(east, point.longitude);
    west = Math.min(west, point.longitude);
  }
  const latPad = Math.max(0.12, (north - south) * 0.22);
  const lngPad = Math.max(0.12, (east - west) * 0.22);
  return {
    north: north + latPad,
    south: south - latPad,
    east: east + lngPad,
    west: west - lngPad,
  };
}

export function RouteCatalogSelect() {
  const catalog = useQuery(api.routes.catalog.list, {});
  const [selectedId, setSelectedId] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const entries = catalog
    ? [...catalog.preconfigured, ...catalog.recent]
    : [];
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;
  const isEmpty = catalog !== undefined && entries.length === 0;

  function applyRoute(id: string) {
    setSelectedId(id);
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry || entry.geometry.coordinates.length < 8) return;

    const current = useMapWorkbenchStore.getState();
    useMapWorkbenchStore.setState({
      draft: {
        ...current.draft,
        origin: asWorkbenchPlace(entry.origin, "port"),
        destination: asWorkbenchPlace(entry.destination, "poi"),
        metadata: {
          ...(current.draft.metadata ?? {}),
          routeCatalogId: entry.id,
          routeRequestHash: entry.requestHash,
        },
      },
      routeGeometry: entry.geometry,
      providerWarnings: entry.geometry.warnings ?? [],
      resultCards: [],
      mapAssets: [],
      selectedAsset: null,
      focusBounds: boundsFromCoordinates(entry.geometry.coordinates),
      caasPhase: "route_analysis",
    });
    setAnnouncement(`${entry.label} applied from cached road geometry.`);
  }

  return (
    <section className="space-y-2" aria-labelledby="route-catalog-label">
      <label
        id="route-catalog-label"
        htmlFor="route-catalog-select"
        className="block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--fv-steel)]"
      >
        Route catalog
      </label>
      <select
        id="route-catalog-select"
        data-testid="route-catalog-select"
        value={selectedId}
        onChange={(event) => applyRoute(event.target.value)}
        disabled={catalog === undefined || isEmpty}
        className="min-h-11 w-full rounded-xl border border-black/10 bg-white/85 px-3 text-xs font-semibold text-[var(--fv-graphite)] shadow-sm outline-none transition focus:border-[var(--fv-accent)] focus:ring-2 focus:ring-[var(--fv-accent)]/25 disabled:cursor-not-allowed disabled:text-[var(--fv-steel)]"
      >
        <option value="">
          {catalog === undefined
            ? "Loading route catalog…"
            : isEmpty
              ? "No preconfigured routes yet"
              : "Choose a cached road route"}
        </option>
        {catalog && catalog.preconfigured.length > 0 ? (
          <optgroup label="Preconfigured">
            {catalog.preconfigured.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </optgroup>
        ) : null}
        {catalog && catalog.recent.length > 0 ? (
          <optgroup label="Recent">
            {catalog.recent.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>

      {isEmpty ? (
        <p className="text-[10px] leading-4 text-[var(--fv-steel)]">
          No preconfigured routes yet — enter endpoints below.
        </p>
      ) : null}

      {selected ? (
        <div
          data-testid="route-catalog-manifest"
          className="grid grid-cols-3 overflow-hidden rounded-xl border border-black/10 bg-white/80 shadow-sm"
        >
          {(
            [
              ["ROAD", selected.manifest.road],
              ["TRAFFIC", selected.manifest.traffic],
              ["CHARGE", selected.manifest.charge],
            ] as const
          ).map(([label, value], index) => (
            <div
              key={label}
              className={cn(
                "min-w-0 px-2 py-2.5",
                index > 0 && "border-l border-black/10",
              )}
            >
              <span className="block font-mono text-[9px] font-bold tracking-[0.14em] text-[var(--fv-steel)]">
                {label}
              </span>
              <span
                className={cn(
                  "mt-0.5 block truncate text-[11px] font-bold text-[var(--fv-graphite)]",
                  selected.manifest.stale && label !== "ROAD" && "text-amber-700",
                )}
                title={value}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
