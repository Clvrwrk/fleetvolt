"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { BookOpen, Check, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { TechnicalLabel } from "@/components/design/technical-label";
import { formatKwhPerMi, formatUsd } from "@/lib/catalog/format";
import type { CatalogVehicle } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

type FacetKey = "oem" | "vehicleClassLabel" | "category";

const FACET_BUTTONS: { key: FacetKey; label: string }[] = [
  { key: "oem", label: "OEM" },
  { key: "vehicleClassLabel", label: "CLASS" },
  { key: "category", label: "TYPE" },
];

/** slug → quantity (qty > 0 means selected) */
export type FleetSelection = Record<string, number>;

export type FleetVehiclePickerProps = {
  selection: FleetSelection;
  onToggle: (slug: string, displayName?: string) => void;
  onQtyChange: (slug: string, qty: number) => void;
  onClearSelection?: () => void;
};

export function FleetVehiclePicker({
  selection,
  onToggle,
  onQtyChange,
  onClearSelection,
}: FleetVehiclePickerProps) {
  const facets = useQuery(api.catalog.queries.listFacets, {});
  const [filters, setFilters] = useState<{
    oem: string | null;
    vehicleClassLabel: string | null;
    category: string | null;
  }>({ oem: null, vehicleClassLabel: null, category: null });
  const [openFacet, setOpenFacet] = useState<FacetKey | null>(null);

  const queryArgs = useMemo(
    () => ({
      ...(filters.oem ? { oem: filters.oem } : {}),
      ...(filters.vehicleClassLabel
        ? { vehicleClassLabel: filters.vehicleClassLabel }
        : {}),
      ...(filters.category ? { category: filters.category } : {}),
      limit: 250,
    }),
    [filters],
  );

  const vehicles = useQuery(api.catalog.queries.list, queryArgs);
  const selectedCount = Object.keys(selection).length;
  const totalUnits = Object.values(selection).reduce((s, q) => s + q, 0);
  const activeFilterCount = [
    filters.oem,
    filters.vehicleClassLabel,
    filters.category,
  ].filter(Boolean).length;

  const facetOptions = (key: FacetKey): string[] => {
    if (!facets) return [];
    if (key === "oem") return facets.oems;
    if (key === "vehicleClassLabel") return facets.classes;
    return facets.categories;
  };

  const clearFilters = () => {
    setFilters({ oem: null, vehicleClassLabel: null, category: null });
    setOpenFacet(null);
  };

  return (
    <section data-testid="fleet-vehicle-picker" className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <TechnicalLabel>VEHICLE CATALOG</TechnicalLabel>
          <p className="mt-1 text-sm text-[var(--fv-text-muted)]">
            Select models to build your fleet
            {selectedCount > 0
              ? ` · ${selectedCount} model${selectedCount === 1 ? "" : "s"} · ${totalUnits} unit${totalUnits === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FACET_BUTTONS.map(({ key, label }) => {
            const active = filters[key] != null;
            return (
              <div key={key} className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenFacet((v) => (v === key ? null : key))
                  }
                  className={cn(
                    "min-h-11 rounded-sm border px-3 text-[11px] font-mono uppercase tracking-wider transition",
                    active
                      ? "border-[var(--fv-alert-red)]/40 bg-[var(--fv-alert-red)]/10 text-[var(--fv-alert-red)]"
                      : "border-white/12 bg-[#121820] text-[#a5b2bc] hover:border-[#42a5d9]/50 hover:text-white",
                  )}
                  data-active={active ? "true" : "false"}
                >
                  {label}
                  {active ? ` · ${filters[key]}` : ""}
                </button>
                {openFacet === key ? (
                  <div className="absolute right-0 z-20 mt-1 max-h-56 w-64 overflow-y-auto rounded-sm border border-white/12 bg-[#121820] py-1 shadow-lg">
                    <button
                      type="button"
                      className="block min-h-11 w-full px-3 text-left text-xs text-[#a5b2bc] hover:bg-white/5 hover:text-white"
                      onClick={() => {
                        setFilters((f) => ({ ...f, [key]: null }));
                        setOpenFacet(null);
                      }}
                    >
                      All
                    </button>
                    {facetOptions(key).map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={cn(
                          "block min-h-11 w-full truncate px-3 text-left text-xs text-[#a5b2bc] hover:bg-white/5 hover:text-white",
                          filters[key] === option
                            ? "font-semibold text-[var(--fv-blueprint-blue)]"
                            : "text-[var(--fv-graphite)]",
                        )}
                        onClick={() => {
                          setFilters((f) => ({ ...f, [key]: option }));
                          setOpenFacet(null);
                        }}
                        title={option}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-[var(--fv-alert-red)] hover:underline"
            >
              <X size={12} aria-hidden />
              Remove all filters
            </button>
          ) : null}
          {selectedCount > 0 && onClearSelection ? (
            <button
              type="button"
              onClick={onClearSelection}
              className="text-[11px] font-mono uppercase tracking-wider text-[var(--fv-steel)] hover:text-[var(--fv-graphite)]"
            >
              Clear selection
            </button>
          ) : null}
        </div>
      </div>

      {vehicles === undefined ? (
        <div className="py-12 text-center text-sm text-[var(--fv-text-muted)]">
          Loading catalog…
        </div>
      ) : vehicles.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--fv-text-muted)]">
          No vehicles match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(vehicles as CatalogVehicle[]).map((vehicle) => {
            const qty = selection[vehicle.slug];
            const selected = qty != null && qty > 0;
            const energyLabel = vehicle.energyEstimatePending
              ? "pending"
              : `${formatKwhPerMi(vehicle.kwhPerMiCombined)} kWh/mi`;

            return (
              <div
                key={vehicle.slug}
                className="group text-left"
                data-selected={selected ? "true" : "false"}
              >
                <SkeuomorphicCard
                  className={cn(
                    "h-full overflow-hidden p-0 transition-transform duration-150 ease-out group-hover:-translate-y-px",
                    selected && "ring-2 ring-[var(--fv-blueprint-blue)]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onToggle(vehicle.slug, vehicle.displayName)
                    }
                    className="relative aspect-[16/9] w-full bg-[var(--fv-surface-muted)]"
                    aria-pressed={selected}
                  >
                    {vehicle.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote HVIP CDN URLs
                      <img
                        src={vehicle.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center gap-2 text-[var(--fv-steel)]">
                        <BookOpen size={18} aria-hidden />
                        <span className="font-mono text-[10px] uppercase tracking-wider">
                          Photo pending
                        </span>
                      </div>
                    )}
                    <span
                      className={cn(
                        "absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded border bg-white shadow-sm",
                        selected
                          ? "border-[var(--fv-blueprint-blue)] bg-[var(--fv-blueprint-blue)] text-white"
                          : "border-black/15 text-transparent",
                      )}
                      aria-hidden
                    >
                      <Check size={14} strokeWidth={3} />
                    </span>
                  </button>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-[var(--fv-text)]">
                      {vehicle.displayName}
                    </p>
                    <p className="truncate text-xs text-[var(--fv-text-muted)]">
                      {vehicle.oem}
                    </p>
                    {selected ? (
                      <label
                        className="mt-2 flex items-center gap-2"
                        data-testid={`qty-${vehicle.slug}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="fv-mono-label text-[8px]">Qty</span>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={qty}
                          onChange={(e) => {
                            const next = Math.max(
                              1,
                              Math.min(999, parseInt(e.target.value, 10) || 1),
                            );
                            onQtyChange(vehicle.slug, next);
                          }}
                          className="fv-input w-16 py-1 text-center text-sm font-mono font-semibold"
                          aria-label={`Quantity for ${vehicle.displayName}`}
                        />
                      </label>
                    ) : null}
                    <dl className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
                      <div>
                        <dt className="fv-mono-label text-[8px]">Pack</dt>
                        <dd className="font-mono font-semibold">
                          {vehicle.packKwh != null
                            ? `${vehicle.packKwh} kWh`
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="fv-mono-label text-[8px]">HVIP</dt>
                        <dd className="font-mono font-semibold text-[var(--fv-signal-green)]">
                          {formatUsd(vehicle.hvipIncentiveUsd)}
                        </dd>
                      </div>
                      <div>
                        <dt className="fv-mono-label text-[8px]">Energy</dt>
                        <dd
                          className={cn(
                            "font-mono font-semibold",
                            vehicle.energyEstimatePending
                              ? "text-[var(--fv-caution-amber)]"
                              : "text-[var(--fv-graphite)]",
                          )}
                        >
                          {energyLabel}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </SkeuomorphicCard>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
