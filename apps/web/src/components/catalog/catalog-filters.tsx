"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";

export type CatalogFilters = {
  oem: string | null;
  category: string | null;
  vehicleClassLabel: string | null;
  technology: string | null;
};

export const EMPTY_CATALOG_FILTERS: CatalogFilters = {
  oem: null,
  category: null,
  vehicleClassLabel: null,
  technology: null,
};

const PARAM = {
  oem: "oem",
  category: "type",
  vehicleClassLabel: "class",
  technology: "tech",
} as const;

export function parseCatalogFilters(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
): CatalogFilters {
  return {
    oem: searchParams.get(PARAM.oem),
    category: searchParams.get(PARAM.category),
    vehicleClassLabel: searchParams.get(PARAM.vehicleClassLabel),
    technology: searchParams.get(PARAM.technology),
  };
}

export function catalogFiltersToQueryArgs(filters: CatalogFilters) {
  return {
    ...(filters.oem ? { oem: filters.oem } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.vehicleClassLabel
      ? { vehicleClassLabel: filters.vehicleClassLabel }
      : {}),
    ...(filters.technology ? { technology: filters.technology } : {}),
    limit: 250,
  };
}

export function countActiveCatalogFilters(filters: CatalogFilters): number {
  return [
    filters.oem,
    filters.category,
    filters.vehicleClassLabel,
    filters.technology,
  ].filter(Boolean).length;
}

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
        <div className="max-h-40 space-y-0.5 overflow-y-auto px-2 pb-3">
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

export function CatalogActiveChips({
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

/** Hook: read/write catalog filters via URL search params. */
export function useCatalogFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseCatalogFilters(searchParams),
    [searchParams],
  );

  const write = useCallback(
    (next: CatalogFilters) => {
      const params = new URLSearchParams();
      if (next.oem) params.set(PARAM.oem, next.oem);
      if (next.category) params.set(PARAM.category, next.category);
      if (next.vehicleClassLabel)
        params.set(PARAM.vehicleClassLabel, next.vehicleClassLabel);
      if (next.technology) params.set(PARAM.technology, next.technology);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setFilter = useCallback(
    <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) => {
      write({ ...filters, [key]: value });
    },
    [filters, write],
  );

  const clearOne = useCallback(
    (key: keyof CatalogFilters) => {
      write({ ...filters, [key]: null });
    },
    [filters, write],
  );

  const clearAll = useCallback(() => {
    write(EMPTY_CATALOG_FILTERS);
  }, [write]);

  return { filters, setFilter, clearOne, clearAll, write };
}

/**
 * Filter accordion for the global app sidebar (catalog routes only).
 * Keeps Type / OEM / Class / Technology in the primary nav chrome.
 */
export function CatalogSidebarFilters() {
  const facets = useQuery(api.catalog.queries.listFacets, {});
  const { filters, setFilter } = useCatalogFilterParams();
  const activeCount = countActiveCatalogFilters(filters);

  return (
    <div
      data-testid="catalog-filter-rail"
      className="flex min-h-0 flex-1 flex-col border-t border-white/10"
    >
      <div className="px-3 py-3">
        <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--fv-steel)]">
          Vehicle Catalog
        </div>
        <div className="mt-1 text-[11px] text-[var(--fv-steel)]">
          {facets === undefined
            ? "Loading facets…"
            : `${facets.total} vehicles · ${activeCount} filter${activeCount === 1 ? "" : "s"}`}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FilterGroup
          title="Type"
          options={facets?.categories ?? []}
          value={filters.category}
          onChange={(category) => setFilter("category", category)}
        />
        <FilterGroup
          title="OEM"
          options={facets?.oems ?? []}
          value={filters.oem}
          onChange={(oem) => setFilter("oem", oem)}
          defaultOpen={false}
        />
        <FilterGroup
          title="Class"
          options={facets?.classes ?? []}
          value={filters.vehicleClassLabel}
          onChange={(vehicleClassLabel) =>
            setFilter("vehicleClassLabel", vehicleClassLabel)
          }
          defaultOpen={false}
        />
        <FilterGroup
          title="Technology"
          options={facets?.technologies ?? []}
          value={filters.technology}
          onChange={(technology) => setFilter("technology", technology)}
          defaultOpen={false}
        />
      </div>
    </div>
  );
}
