import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { formatKwhPerMi, formatUsd } from "@/lib/catalog/format";
import type { CatalogVehicle } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

export type CatalogVehicleListProps = {
  vehicles: CatalogVehicle[];
  className?: string;
};

function CatalogPill({
  children,
  variant = "muted",
}: {
  children: ReactNode;
  variant?: "accent" | "muted";
}) {
  return (
    <span
      className={cn(
        "rounded border px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-wide",
        variant === "accent"
          ? "border-[var(--fv-blueprint-blue)]/40 bg-[var(--fv-blueprint-blue)]/10 text-[var(--fv-blueprint-blue)]"
          : "border-[var(--fv-stroke)]/40 bg-[var(--fv-surface-muted)] text-[var(--fv-slate)]",
      )}
    >
      {children}
    </span>
  );
}

export function CatalogVehicleList({ vehicles, className }: CatalogVehicleListProps) {
  if (vehicles.length === 0) {
    return (
      <div
        data-testid="catalog-vehicle-list"
        className={cn("py-10 text-center text-sm text-[var(--fv-text-muted)]", className)}
      >
        No catalog vehicles found. Run the HVIP ingest to populate the browse list.
      </div>
    );
  }

  return (
    <div
      data-testid="catalog-vehicle-list"
      className={cn("grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3", className)}
    >
      {vehicles.map((vehicle) => {
        const energyLabel = vehicle.energyEstimatePending
          ? "pending"
          : `${formatKwhPerMi(vehicle.kwhPerMiCombined)} kWh/mi`;

        return (
          <Link
            key={vehicle.slug}
            href={`/catalog/${vehicle.slug}`}
            className="no-underline group"
          >
            <SkeuomorphicCard className="h-full overflow-hidden p-0 transition-transform duration-150 ease-out group-hover:-translate-y-px">
              <div className="relative aspect-[16/9] w-full bg-[var(--fv-surface-muted)]">
                {vehicle.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote HVIP CDN URLs vary by OEM
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
              </div>
              <div className="p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--fv-text)]">
                    {vehicle.displayName}
                  </p>
                  <p className="truncate text-xs text-[var(--fv-text-muted)]">
                    {vehicle.oem}
                  </p>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                <CatalogPill variant="muted">{vehicle.category}</CatalogPill>
                <CatalogPill variant="accent">{vehicle.technology}</CatalogPill>
              </div>

              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="fv-mono-label text-[9px]">Pack</dt>
                  <dd className="font-[family-name:var(--font-mono)] font-semibold text-[var(--fv-graphite)]">
                    {vehicle.packKwh != null ? `${vehicle.packKwh} kWh` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="fv-mono-label text-[9px]">HVIP</dt>
                  <dd className="font-[family-name:var(--font-mono)] font-semibold text-[var(--fv-signal-green)]">
                    {formatUsd(vehicle.hvipIncentiveUsd)}
                  </dd>
                </div>
                <div>
                  <dt className="fv-mono-label text-[9px]">Energy</dt>
                  <dd
                    className={cn(
                      "font-[family-name:var(--font-mono)] font-semibold",
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
          </Link>
        );
      })}
    </div>
  );
}
