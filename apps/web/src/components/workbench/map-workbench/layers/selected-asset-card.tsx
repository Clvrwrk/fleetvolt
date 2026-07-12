"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { assessRouteProximity } from "@/lib/maps/route-proximity";
import { cn } from "@/lib/utils";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import type { WorkbenchSelection } from "../types";

export type SelectedAssetCardProps = {
  selection: WorkbenchSelection | null;
  className?: string;
};

function formatSelectionType(type: WorkbenchSelection["type"]): string {
  return type
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function metadataRows(metadata: Record<string, unknown> | undefined) {
  if (!metadata) {
    return [];
  }

  return Object.entries(metadata)
    .filter(([key, value]) => {
      if (value === undefined || value === null || value === "") return false;
      // Keep the card focused — proximity is shown as the banner.
      if (key === "subtitle" || key === "metric") return false;
      return true;
    })
    .slice(0, 6)
    .map(([key, value]) => ({
      key,
      label: key
        .replace(/([A-Z])/g, " $1")
        .replace(/[-_]/g, " ")
        .replace(/^./, (char) => char.toUpperCase()),
      value: typeof value === "object" ? JSON.stringify(value) : String(value),
    }));
}

export function SelectedAssetCard({ selection, className }: SelectedAssetCardProps) {
  const routeGeometry = useMapWorkbenchStore((state) => state.routeGeometry);
  const selectAsset = useMapWorkbenchStore((state) => state.selectAsset);

  const proximity = useMemo(() => {
    if (
      !selection ||
      selection.type === "route" ||
      typeof selection.latitude !== "number" ||
      typeof selection.longitude !== "number" ||
      !Number.isFinite(selection.latitude) ||
      !Number.isFinite(selection.longitude)
    ) {
      return null;
    }

    const path = (routeGeometry?.coordinates ?? [])
      .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
      .map((c) => ({ lat: c.latitude, lng: c.longitude }));

    if (path.length < 2) return null;

    return assessRouteProximity(
      { lat: selection.latitude, lng: selection.longitude },
      path,
    );
  }, [routeGeometry?.coordinates, selection]);

  if (!selection) {
    return null;
  }

  const rows = metadataRows(selection.metadata);
  const gapMetadata = selection.type === "class8-gap" ? selection.metadata : null;
  const gapValue = (key: string, fallback = "Not available") => {
    const value = gapMetadata?.[key];
    return value === undefined || value === null || value === "" ? fallback : String(value);
  };

  return (
    <aside
      data-testid="selected-asset-card"
      data-asset-id={selection.id}
      data-asset-type={selection.type}
      data-on-route={proximity ? String(proximity.onRoute) : undefined}
      className={cn(
        "pointer-events-auto max-h-[min(44rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-black/10 bg-white/95 p-4 text-[var(--fv-graphite)] shadow-2xl backdrop-blur",
        className,
      )}
      aria-label={`${selection.label} details`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--fv-steel)]">
          {formatSelectionType(selection.type)} · {selection.layerId}
        </div>
        <h3 className="mt-1 text-base font-bold leading-tight">{selection.label}</h3>
        <p className="mt-1 text-[10px] text-[var(--fv-steel)]">
          Double-click the map item or use Close
        </p>
        </div>
        <button
          type="button"
          data-testid="selected-asset-card-close"
          onClick={() => selectAsset(null)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--fv-steel)] transition hover:border-[var(--fv-blueprint-blue)] hover:text-[var(--fv-blueprint-blue)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-blueprint-blue)]"
          aria-label={`Close ${selection.label} details`}
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {proximity ? (
        <div
          data-testid="selected-asset-route-proximity"
          className={cn(
            "mt-3 rounded-xl px-3 py-2 text-[11px] uppercase tracking-[0.08em]",
            proximity.onRoute
              ? "border border-[var(--fv-signal-green)]/30 bg-[var(--fv-signal-green)]/10 font-bold text-[var(--fv-signal-green)]"
              : "border-2 border-[var(--fv-alert-red)] bg-[var(--fv-alert-red)]/10 font-black text-[var(--fv-alert-red)]",
          )}
          role="status"
        >
          {proximity.label}
          {!proximity.onRoute ? (
            <span className="mt-1 block text-[10px] font-semibold normal-case tracking-normal text-[var(--fv-alert-red)]/90">
              Dotted blue spur = leave main route → this stop → rejoin.
            </span>
          ) : null}
        </div>
      ) : null}

      {typeof selection.latitude === "number" && typeof selection.longitude === "number" ? (
        <div className="mt-3 rounded-xl bg-[var(--fv-bg)] px-3 py-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[var(--fv-steel)]">
          {selection.latitude.toFixed(4)}, {selection.longitude.toFixed(4)}
        </div>
      ) : null}

      {gapMetadata ? (
        <div data-testid="class8-gap-explanation" className="mt-3 space-y-2">
          <div className="rounded-xl border border-[var(--fv-alert-red)]/30 bg-[var(--fv-alert-red)]/8 px-3 py-2.5">
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--fv-alert-red)]">
              Why this is a GAP candidate
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-[var(--fv-graphite)]">
              {gapValue("whyGap")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-black/10 bg-[var(--fv-bg)] px-3 py-2">
              <div className="text-[8px] font-black uppercase tracking-[0.12em] text-[var(--fv-blueprint-blue)]">Optimum charge window</div>
              <div className="mt-1 text-[11px] font-bold text-[var(--fv-graphite)]">{gapValue("optimalArrivalSoc")}</div>
              <div className="mt-0.5 text-[9px] text-[var(--fv-steel)]">{gapValue("dwellWindow")}</div>
            </div>
            <div className="rounded-xl border border-black/10 bg-[var(--fv-bg)] px-3 py-2">
              <div className="text-[8px] font-black uppercase tracking-[0.12em] text-[var(--fv-blueprint-blue)]">Mobile bridge</div>
              <div className="mt-1 text-[11px] font-bold text-[var(--fv-graphite)]">{gapValue("recommendedPower")}</div>
              <div className="mt-0.5 text-[9px] text-[var(--fv-steel)]">{gapValue("classification")}</div>
            </div>
          </div>
          <dl className="divide-y divide-black/10 overflow-hidden rounded-xl border border-black/10 text-[10px]">
            {[
              ["Site type", gapValue("siteType")],
              ["Why here", gapValue("whyHere")],
              ["Charger evidence", gapValue("chargerEvidence")],
              ["Confidence", gapValue("confidence")],
              ["Provenance", gapValue("provenance")],
              ["Must validate", gapValue("verification")],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[5.2rem_minmax(0,1fr)] gap-2 bg-white px-3 py-2">
                <dt className="font-bold text-[var(--fv-steel)]">{label}</dt>
                <dd className="text-right leading-4 text-[var(--fv-graphite)]">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-lg bg-[var(--fv-caution-amber)]/10 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--fv-caution-amber)]">
            {gapValue("status", "Modeled siting hypothesis — validation required")}
          </div>
        </div>
      ) : null}

      {!gapMetadata && rows.length > 0 ? (
        <dl className="mt-3 divide-y divide-black/10 overflow-hidden rounded-xl border border-black/10">
          {rows
            .filter((row) => row.key !== "carrierHref")
            .map((row) => (
            <div key={row.key} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 bg-white px-3 py-2 text-xs">
              <dt className="font-bold text-[var(--fv-steel)]">{row.label}</dt>
              <dd className="truncate text-right text-[var(--fv-graphite)]" title={row.value}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : !gapMetadata ? (
        <p className="mt-3 text-xs leading-5 text-[var(--fv-steel)]">
          Metadata card ready. Detailed Convex asset payloads attach through the workbench aggregation layer.
        </p>
      ) : null}

      {selection.type !== "route" && typeof selection.metadata?.carrierHref === "string" ? (
        <a
          href={selection.metadata.carrierHref}
          data-testid="carriers-in-region-link"
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[var(--fv-blueprint-blue)]/30 bg-[var(--fv-blueprint-blue)]/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--fv-blueprint-blue)] hover:bg-[var(--fv-blueprint-blue)]/15"
        >
          See carriers in this region
        </a>
      ) : selection.type !== "route" ? (
        <a
          href={`/caas?view=summary&carriers=1${
            typeof selection.latitude === "number" &&
            typeof selection.longitude === "number"
              ? `&lat=${selection.latitude.toFixed(3)}&lng=${selection.longitude.toFixed(3)}`
              : ""
          }`}
          data-testid="carriers-in-region-link"
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[var(--fv-blueprint-blue)]/30 bg-[var(--fv-blueprint-blue)]/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--fv-blueprint-blue)] hover:bg-[var(--fv-blueprint-blue)]/15"
        >
          See carriers near this point
        </a>
      ) : null}
    </aside>
  );
}
