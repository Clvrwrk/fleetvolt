"use client";

import { Suspense, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { BookOpen } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { CatalogVehicleList } from "@/components/catalog/catalog-vehicle-list";
import {
  CatalogActiveChips,
  catalogFiltersToQueryArgs,
  useCatalogFilterParams,
} from "@/components/catalog/catalog-filters";
import { TechnicalLabel } from "@/components/design/technical-label";

function CatalogShellInner({ children }: { children?: ReactNode }) {
  const { filters, clearAll, clearOne } = useCatalogFilterParams();
  const vehicles = useQuery(
    api.catalog.queries.list,
    catalogFiltersToQueryArgs(filters),
  );

  return (
    <div
      data-testid="catalog-shell"
      className="min-h-[calc(100dvh-3.5rem)] w-full max-w-none bg-[var(--fv-bg)]"
    >
      <div className="border-b border-black/8 bg-[var(--fv-paper)] px-5 py-5 md:px-8">
        <div className="flex flex-wrap items-start gap-3">
          <BookOpen
            size={20}
            className="mt-0.5 shrink-0 text-[var(--fv-accent)]"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <TechnicalLabel>HVIP CATALOG</TechnicalLabel>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-[var(--fv-text)]">
              Class 8 BEV Vehicle Catalog
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--fv-text-muted)]">
              Browse HVIP-eligible models with FleetVolt energy and incentive
              estimates.
            </p>
          </div>
          <div className="text-right font-mono text-[11px] uppercase tracking-wider text-[var(--fv-steel)]">
            {vehicles === undefined ? "…" : `${vehicles.length} shown`}
          </div>
        </div>
        <div className="mt-4">
          <CatalogActiveChips
            filters={filters}
            onClear={clearAll}
            onClearOne={clearOne}
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
  );
}

export function CatalogShell({ children }: { children?: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          data-testid="catalog-shell"
          className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center text-sm text-[var(--fv-text-muted)]"
        >
          Loading catalog…
        </div>
      }
    >
      <CatalogShellInner>{children}</CatalogShellInner>
    </Suspense>
  );
}
