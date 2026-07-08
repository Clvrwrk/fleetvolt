"use client";

// Carriers section — renders carrier name + city + corridorCity + distanceM.
// Part of the HotspotReportPanel (P15-02).
import { FvInsetCard } from "@/components/design/fv-inset-card";

export interface CarrierRow {
  name: string;
  city: string | null;
  corridorCity: string | null;
  location: { lat: number; lng: number } | null;
  distanceM: number;
}

export interface CarriersSectionProps {
  carriers: CarrierRow[];
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function CarriersSection({ carriers }: CarriersSectionProps) {
  return (
    <FvInsetCard className="p-4" data-testid="carriers-section">
      <h3 className="mb-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        Carriers in Radius
      </h3>
      <p className="mb-3 text-2xl font-semibold text-[var(--color-text-primary)]">
        {carriers.length}
      </p>
      {carriers.length > 0 && (
        <ul className="space-y-1">
          {carriers.slice(0, 10).map((c, i) => (
            <li
              key={i}
              className="flex items-center justify-between text-sm text-[var(--color-text-primary)]"
            >
              <span>{c.name}</span>
              <span className="text-[var(--color-text-secondary)]">
                {c.corridorCity ?? c.city ?? "—"} · {formatDistance(c.distanceM)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </FvInsetCard>
  );
}
