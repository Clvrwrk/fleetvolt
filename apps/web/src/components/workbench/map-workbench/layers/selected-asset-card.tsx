"use client";

import { X } from "lucide-react";
import type { WorkbenchSelection } from "../types";
import { cn } from "@/lib/utils";

export type SelectedAssetCardProps = {
  selection: WorkbenchSelection | null;
  className?: string;
  onClose?: () => void;
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
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
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

export function SelectedAssetCard({ selection, className, onClose }: SelectedAssetCardProps) {
  if (!selection) {
    return null;
  }

  const rows = metadataRows(selection.metadata);

  return (
    <aside
      data-testid="selected-asset-card"
      data-asset-id={selection.id}
      data-asset-type={selection.type}
      className={cn(
        "pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-black/10 bg-white/95 p-4 text-[var(--fv-graphite)] shadow-2xl backdrop-blur",
        className,
      )}
      aria-label={`${selection.label} details`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--fv-steel)]">
            {formatSelectionType(selection.type)} · {selection.layerId}
          </div>
          <h3 className="mt-1 text-base font-bold leading-tight">{selection.label}</h3>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-9 min-w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-[var(--fv-steel)] transition hover:border-[var(--fv-accent)] hover:text-[var(--fv-graphite)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
            aria-label="Close selected asset card"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {typeof selection.latitude === "number" && typeof selection.longitude === "number" ? (
        <div className="mt-3 rounded-xl bg-[var(--fv-bg)] px-3 py-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[var(--fv-steel)]">
          {selection.latitude.toFixed(4)}, {selection.longitude.toFixed(4)}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <dl className="mt-3 divide-y divide-black/10 overflow-hidden rounded-xl border border-black/10">
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 bg-white px-3 py-2 text-xs">
              <dt className="font-bold text-[var(--fv-steel)]">{row.label}</dt>
              <dd className="truncate text-right text-[var(--fv-graphite)]" title={row.value}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-xs leading-5 text-[var(--fv-steel)]">
          Metadata card ready. Detailed Convex asset payloads attach through the workbench aggregation layer.
        </p>
      )}
    </aside>
  );
}
