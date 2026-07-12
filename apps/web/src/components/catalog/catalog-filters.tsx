"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { SlidersHorizontal, X } from "lucide-react";
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

type CatalogFilterKey = keyof CatalogFilters;

type FilterDefinition = {
  key: CatalogFilterKey;
  label: string;
  options: string[];
};

function CatalogFilterDrawer({
  definition,
  value,
  onChange,
  onClose,
}: {
  definition: FilterDefinition;
  value: string | null;
  onChange: (next: string | null) => void;
  onClose: () => void;
}) {
  const choices = ["All vehicles", ...definition.options];

  return (
    <section
      id={`catalog-filter-drawer-${definition.key}`}
      data-testid="catalog-filter-drawer"
      className="fixed inset-x-2 bottom-16 top-16 z-[70] flex min-h-0 flex-col overflow-hidden rounded-sm border border-[#42a5d9]/35 bg-[#0b1016]/[0.98] shadow-[0_24px_80px_rgba(0,0,0,0.56)] backdrop-blur-xl md:bottom-3 md:left-[268px] md:right-3 md:top-[64px] md:max-w-[760px]"
      aria-label={`${definition.label} catalog filters`}
    >
      <header className="flex shrink-0 items-start justify-between gap-5 border-b border-white/10 px-4 py-3 md:px-5 md:py-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#69c5f0]">
            FILTER CONTROL · {definition.label}
          </div>
          <h2 className="mt-1 text-base font-semibold text-white md:text-lg">
            Limit the catalog view
          </h2>
          <p className="mt-1 max-w-xl text-xs text-[#a5b2bc]">
            Toggle one option on. Toggle it again—or select All vehicles—to restore the full fleet.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-white/12 text-[#c5d0d8] transition hover:border-[#42a5d9]/60 hover:text-white"
          aria-label={`Close ${definition.label} filters`}
        >
          <X size={17} aria-hidden />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-px overflow-hidden bg-white/10 p-px sm:grid-cols-3 lg:grid-cols-4">
        {choices.map((choice, index) => {
          const option = index === 0 ? null : choice;
          const selected = option === value;
          return (
            <button
              key={choice}
              type="button"
              role="switch"
              aria-checked={selected}
              onClick={() => onChange(selected && option !== null ? null : option)}
              className={cn(
                "group flex min-h-11 min-w-0 items-center justify-between gap-2 bg-[#101720] px-3 text-left transition focus-visible:relative focus-visible:z-10",
                selected
                  ? "bg-[#132d3b] text-white"
                  : "text-[#b9c5ce] hover:bg-[#17212b] hover:text-white",
              )}
              title={choice}
            >
              <span className="truncate text-[11px] font-medium sm:text-xs">{choice}</span>
              <span
                className={cn(
                  "relative h-5 w-9 shrink-0 rounded-full border transition",
                  selected
                    ? "border-[#69c5f0] bg-[#42a5d9]"
                    : "border-white/20 bg-[#29333d] group-hover:border-white/35",
                )}
                aria-hidden
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                    selected ? "translate-x-[17px]" : "translate-x-0.5",
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>

      <footer className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-t border-white/10 px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-[#9aa9b4]">
        <span>{definition.options.length} available</span>
        <span className="text-[#69c5f0]">{value ?? "All vehicles"}</span>
      </footer>
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
          className="inline-flex min-h-11 items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 text-[11px] font-medium text-[var(--fv-graphite)]"
        >
          <span className="max-w-[180px] truncate">{value}</span>
          <X size={12} aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="min-h-11 px-2 text-[11px] font-mono uppercase tracking-wider text-[var(--fv-steel)] hover:text-[var(--fv-graphite)]"
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

function CatalogFilterDock({ variant }: { variant: "sidebar" | "inline" }) {
  const facets = useQuery(api.catalog.queries.listFacets, {});
  const { filters, setFilter, clearAll } = useCatalogFilterParams();
  const activeCount = countActiveCatalogFilters(filters);
  const [openKey, setOpenKey] = useState<CatalogFilterKey | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  const definitions = useMemo<FilterDefinition[]>(
    () => [
      { key: "category", label: "Type", options: facets?.categories ?? [] },
      { key: "oem", label: "OEM", options: facets?.oems ?? [] },
      {
        key: "vehicleClassLabel",
        label: "Class",
        options: facets?.classes ?? [],
      },
      {
        key: "technology",
        label: "Technology",
        options: facets?.technologies ?? [],
      },
    ],
    [facets],
  );
  const openDefinition = definitions.find(({ key }) => key === openKey) ?? null;

  const cancelTimers = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
  }, []);

  const scheduleOpen = useCallback(
    (key: CatalogFilterKey) => {
      cancelTimers();
      openTimer.current = setTimeout(() => setOpenKey(key), 360);
    },
    [cancelTimers],
  );

  const scheduleClose = useCallback(() => {
    cancelTimers();
    closeTimer.current = setTimeout(() => setOpenKey(null), 260);
  }, [cancelTimers]);

  useEffect(() => cancelTimers, [cancelTimers]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenKey(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      data-testid="catalog-filter-rail"
      ref={dockRef}
      className={cn(
        "relative",
        variant === "sidebar"
          ? "shrink-0 border-t border-white/10 px-3 py-3"
          : "mt-4 md:hidden",
      )}
      onMouseEnter={cancelTimers}
      onMouseLeave={scheduleClose}
      onBlurCapture={(event) => {
        if (!dockRef.current?.contains(event.relatedTarget as Node | null)) {
          scheduleClose();
        }
      }}
    >
      <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#69c5f0]">
            <SlidersHorizontal size={13} aria-hidden />
            FILTER CONTROL
          </div>
          <div className="mt-1 text-[10px] text-[#a5b2bc]">
            {facets === undefined ? "Loading…" : `${facets.total} vehicles`}
          </div>
        </div>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="min-h-11 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#ff8b80] hover:text-white"
          >
            Clear {activeCount}
          </button>
        ) : null}
      </div>

      <div className={cn("grid gap-1.5", variant === "sidebar" ? "grid-cols-2" : "grid-cols-4")}>
        {definitions.map((definition) => {
          const value = filters[definition.key];
          const active = Boolean(value);
          const expanded = openKey === definition.key;
          return (
            <button
              key={definition.key}
              type="button"
              onClick={() => {
                cancelTimers();
                setOpenKey(expanded ? null : definition.key);
              }}
              onMouseEnter={() => scheduleOpen(definition.key)}
              className={cn(
                "relative flex min-h-11 min-w-0 flex-col justify-center rounded-sm border px-2 text-left transition",
                expanded
                  ? "border-[#69c5f0] bg-[#173042] text-white"
                  : active
                    ? "border-[#42a5d9]/55 bg-[#132633] text-white"
                    : "border-white/12 bg-[#121820] text-[#c5d0d8] hover:border-[#42a5d9]/45 hover:text-white",
              )}
              aria-expanded={expanded}
              aria-controls={`catalog-filter-drawer-${definition.key}`}
              data-filter-group={definition.label.toLowerCase()}
              data-active={active ? "true" : "false"}
            >
              <span className="truncate font-mono text-[9px] uppercase tracking-[0.14em]">
                {definition.label}
              </span>
              <span className={cn("mt-0.5 truncate text-[10px]", active ? "text-[#69c5f0]" : "text-[#9aa9b4]")}>
                {value ?? "All"}
              </span>
              {active ? <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#69c5f0]" aria-hidden /> : null}
            </button>
          );
        })}
      </div>

      {openDefinition ? (
        <CatalogFilterDrawer
          definition={openDefinition}
          value={filters[openDefinition.key]}
          onChange={(next) => setFilter(openDefinition.key, next)}
          onClose={() => setOpenKey(null)}
        />
      ) : null}
    </div>
  );
}

/** Compact sidebar dock; drawers open over the catalog canvas. */
export function CatalogSidebarFilters() {
  return <CatalogFilterDock variant="sidebar" />;
}

/** Mobile dock uses the same drawer model without introducing a dropdown. */
export function CatalogInlineFilters() {
  return <CatalogFilterDock variant="inline" />;
}
