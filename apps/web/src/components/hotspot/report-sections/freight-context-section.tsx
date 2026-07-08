"use client";

// Freight context section — renders origin (zone 061), year, totalKtons,
// totalValueUSD, truckKtons, truckValueUSD as dimension-callout metrics.
// Part of the HotspotReportPanel (P15-02).
import { FvInsetCard } from "@/components/design/fv-inset-card";

export interface FreightContextSectionProps {
  freightContext: {
    origin: string;
    year: number;
    rowCount: number;
    totalKtons: number;
    totalValueUSD: number;
    truckKtons: number;
    truckValueUSD: number;
  };
}

function formatKtons(k: number): string {
  if (k >= 1000) return `${(k / 1000).toFixed(1)}M ktons`;
  return `${k.toFixed(1)}k ktons`;
}

function formatUSD(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${m.toFixed(0)}M`;
}

export function FreightContextSection({ freightContext }: FreightContextSectionProps) {
  const fc = freightContext;
  return (
    <FvInsetCard className="p-4" data-testid="freight-context-section">
      <h3 className="mb-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        Freight Context
      </h3>
      <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
        FAF Zone {fc.origin} · {fc.year} · {fc.rowCount} rows
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">
            {formatKtons(fc.totalKtons)}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            total ktons
          </p>
        </div>
        <div>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">
            {formatUSD(fc.totalValueUSD)}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            total value
          </p>
        </div>
        <div>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">
            {formatKtons(fc.truckKtons)}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            truck ktons
          </p>
        </div>
        <div>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">
            {formatUSD(fc.truckValueUSD)}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            truck value
          </p>
        </div>
      </div>
    </FvInsetCard>
  );
}
