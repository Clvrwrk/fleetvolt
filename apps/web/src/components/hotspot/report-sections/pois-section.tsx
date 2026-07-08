"use client";

// POIs section — renders total + byType as a grid + flat list.
// Part of the HotspotReportPanel (P15-02).
import { FvInsetCard } from "@/components/design/fv-inset-card";

export interface PoiRow {
  type: string;
  name: string | null;
  location: { lat: number; lng: number };
  distanceM: number;
}

export interface PoisSectionProps {
  pois: {
    total: number;
    byType: Record<string, number>;
    pois: PoiRow[];
  };
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function PoisSection({ pois }: PoisSectionProps) {
  const typeEntries = Object.entries(pois.byType);
  return (
    <FvInsetCard className="p-4" data-testid="pois-section">
      <h3 className="mb-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        Points of Interest
      </h3>
      <p className="mb-3 text-2xl font-semibold text-[var(--color-text-primary)]">
        {pois.total}
      </p>
      {typeEntries.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {typeEntries.map(([type, count]) => (
            <div
              key={type}
              className="flex items-center justify-between border-b pb-1 text-sm"
              style={{ borderColor: "var(--color-line-subtle)" }}
            >
              <span className="text-[var(--color-text-primary)]">{type}</span>
              <span className="text-[var(--color-text-secondary)]">{count}</span>
            </div>
          ))}
        </div>
      )}
      {pois.pois.length > 0 && (
        <ul className="space-y-1">
          {pois.pois.slice(0, 6).map((p, i) => (
            <li
              key={i}
              className="flex items-center justify-between text-sm text-[var(--color-text-primary)]"
            >
              <span>{p.name ?? p.type}</span>
              <span className="text-[var(--color-text-secondary)]">
                {p.type} · {formatDistance(p.distanceM)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </FvInsetCard>
  );
}
