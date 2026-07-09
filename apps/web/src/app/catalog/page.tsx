"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CatalogVehicleList } from "@/components/catalog/catalog-vehicle-list";
import { FramedPanel } from "@/components/design/framed-panel";
import { SkeletonContent } from "@/components/design/skeleton-card";
import { TechnicalLabel } from "@/components/design/technical-label";
import { BookOpen } from "lucide-react";

export default function CatalogBrowsePage() {
  const vehicles = useQuery(api.catalog.queries.list, {});

  if (vehicles === undefined) {
    return (
      <FramedPanel maxWidthClass="max-w-[1100px]">
        <SkeletonContent kpiCount={0} cardLines={4} />
      </FramedPanel>
    );
  }

  return (
    <FramedPanel maxWidthClass="max-w-[1100px]">
      <div className="mb-6 flex items-start gap-3 border-b border-black/8 pb-4">
        <BookOpen size={20} className="mt-0.5 shrink-0 text-[var(--fv-accent)]" aria-hidden />
        <div>
          <TechnicalLabel>HVIP CATALOG</TechnicalLabel>
          <h1 className="mt-1 text-lg font-bold text-[var(--fv-text)]">
            Class 8 BEV Vehicle Catalog
          </h1>
          <p className="mt-1 text-sm text-[var(--fv-text-muted)]">
            Browse HVIP-eligible models with FleetVolt energy and incentive estimates.
          </p>
        </div>
      </div>

      <CatalogVehicleList vehicles={vehicles} />

      <div className="fv-footer-credit mt-6 text-right">
        POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
      </div>
    </FramedPanel>
  );
}
