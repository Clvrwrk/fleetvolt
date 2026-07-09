"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { BookOpen, ChevronDown, ChevronRight, Filter, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { CatalogVehicleList } from "@/components/catalog/catalog-vehicle-list";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";

type CatalogFilters = {
  oem: string | null;
  category: string | null;
  vehicleClassLabel: string | null;
  technology: string | null;
};

const EMPTY_FILTERS: CatalogFilters = {
  oem: null,
  category: null,
  vehicleClassLabel: null,
  technology: null,
};

function FilterGroup({
  title,
  options,
  value,
  onChange,
  defaultOpen = true,
}: {
  title: string;
  options: string[];
  value: string | null;
  onChange: (next: string | null) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-white/10" data-filter-group={title.toLowerCase()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--fv-fog)] hover:text-white"
        aria-expanded={open}
      >
        <span>{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open ? (
        <div className="max-h-48 space-y-0.5 overflow-y-auto px-2 pb-3">
          <button
            type="button"
            onClick={() => onChange(null)}
            className={cn(
              "flex w-full rounded-md px-2 py-1.5 text-left text-xs transition",
              value === null
                ? "bg-white/10 text-white"
                : "text-[var(--fv-slate)] hover:bg-white/5 hover:text-[var(--fv-fog)]",
            )}
          >
            All
          </button>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option === value ? null : option)}
              className={cn(
                "flex w-full rounded-md px-2 py-1.5 text-left text-xs transition",
                value === option
                  ? "bg-[var(--fv-blueprint-blue)]/25 text-white"
                  : "text-[var(--fv-slate)] hover:bg-white/5 hover:text-[var(--fv-fog)]",
              )}
              title={option}
            >
              <span className="truncate">{option}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ActiveChips({
  filters,
  onClear,
  onClearOne,
}: {
  filters: CatalogFilters;
  onClear: () => void;
  onClearOne: (key: keyof CatalogFilters) => void;
}) {
  const chips = (
    [
      ["oem", filters.oem],
      ["category", filters.category],
      ["vehicleClassLabel", filters.vehicleClassLabel],
      ["technology", filters.technology],
    ] as const
  ).filter(([, v]) => v);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map(([key, value]) => (
        <button
          key={key}
          type="button"
          onClick={() => onClearOne(key)}
          className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--fv-graphite)]"
        >
          <span className="max-w-[180px] truncate">{value}</span>
          <X size={12} aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="text-[11px] font-mono uppercase tracking-wider text-[var(--fv-steel)] hover:text-[var(--fv-graphite)]"
      >
        Clear
      </button>
    </div>
  );
}

export function CatalogShell({ children }: { children?: ReactNode }) {
  const facets = useQuery(api.catalog.queries.listFacets, {});
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [railOpen, setRailOpen] = useState(true);

  const queryArgs = useMemo(
    () => ({
      ...(filters.oem ? { oem: filters.oem } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.vehicleClassLabel
        ? { vehicleClassLabel: filters.vehicleClassLabel }
        : {}),
      ...(filters.technology ? { technology: filters.technology } : {}),
      limit: 250,
    }),
    [filters],
  );

  const vehicles = useQuery(api.catalog.queries.list, queryArgs);

  const activeCount = [
    filters.oem,
    filters.category,
    filters.vehicleClassLabel,
    filters.technology,
  ].filter(Boolean).length;

  return (
    <div
      data-testid="catalog-shell"
      className="flex min-h-[calc(100dvh-3.5rem)] w-full max-w-none bg-[var(--fv-bg)]"
    >
      {/* Filter rail — same graphite language as app sidebar / workbench tool rail */}
      <aside
        data-testid="catalog-filter-rail"
        data-open={railOpen ? "true" : "false"}
        className={cn(
          "flex shrink-0 flex-col border-r border-white/10 bg-[var(--fv-graphite)] transition-[width] duration-200",
          railOpen ? "w-72" : "w-14",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-3">
          {railOpen ? (
            <div className="min-w-0">
              <TechnicalLabel className="!text-[var(--fv-steel)]">Filters</TechnicalLabel>
              <div className="truncate text-sm font-semibold text-white">Catalog</div>
            </div>
          ) : (
            <Filter size={16} className="mx-auto text-[var(--fv-fog)]" aria-hidden />
          )}
          <button
            type="button"
            onClick={() => setRailOpen((v) => !v)}
            className="rounded-md p-1.5 text-[var(--fv-steel)] hover:bg-white/5 hover:text-white"
            aria-label={railOpen ? "Collapse catalog filters" : "Expand catalog filters"}
            data-testid="catalog-filter-toggle"
          >
            {railOpen ? <ChevronRight size={16} className="rotate-180" /> : <ChevronRight size={16} />}
          </button>
        </div>

        {railOpen ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-3 py-3 text-[11px] text-[var(--fv-steel)]">
              {facets === undefined
                ? "Loading facets…"
                : `${facets.total} vehicles · ${activeCount} filter${activeCount === 1 ? "" : "s"}`}
            </div>
            <FilterGroup
              title="Type"
              options={facets?.categories ?? []}
              value={filters.category}
              onChange={(category) => setFilters((f) => ({ ...f, category }))}
            />
            <FilterGroup
              title="OEM"
              options={facets?.oems ?? []}
              value={filters.oem}
              onChange={(oem) => setFilters((f) => ({ ...f, oem }))}
              defaultOpen={false}
            />
            <FilterGroup
              title="Class"
              options={facets?.classes ?? []}
              value={filters.vehicleClassLabel}
              onChange={(vehicleClassLabel) =>
                setFilters((f) => ({ ...f, vehicleClassLabel }))
              }
              defaultOpen={false}
            />
            <FilterGroup
              title="Technology"
              options={facets?.technologies ?? []}
              value={filters.technology}
              onChange={(technology) => setFilters((f) => ({ ...f, technology }))}
              defaultOpen={false}
            />
          </div>
        ) : null}
      </aside>

      {/* Full-bleed content (no FramedPanel max-width) */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="border-b border-black/8 bg-[var(--fv-paper)] px-5 py-5 md:px-8">
          <div className="flex flex-wrap items-start gap-3">
            <BookOpen size={20} className="mt-0.5 shrink-0 text-[var(--fv-accent)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <TechnicalLabel>HVIP CATALOG</TechnicalLabel>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-[var(--fv-text)]">
                Class 8 BEV Vehicle Catalog
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-[var(--fv-text-muted)]">
                Browse HVIP-eligible models with FleetVolt energy and incentive estimates.
              </p>
            </div>
            <div className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--fv-steel)]">
              {vehicles === undefined ? "…" : `${vehicles.length} shown`}
            </div>
          </div>
          <div className="mt-4">
            <ActiveChips
              filters={filters}
              onClear={() => setFilters(EMPTY_FILTERS)}
              onClearOne={(key) => setFilters((f) => ({ ...f, [key]: null }))}
            />
          </div>
        </div>

        <div className="px-5 py-5 md:px-8">
          {children ??
            (vehicles === undefined ? (
              <div className="py-16 text-center text-sm text-[var(--fv-text-muted)]">
                Loading catalog…
              </div>
            ) : (
              <CatalogVehicleList vehicles={vehicles} />
            ))}
        </div>

        <div className="fv-footer-credit px-5 pb-6 text-right md:px-8">
          POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
        </div>
      </div>
    </div>
  );
}
