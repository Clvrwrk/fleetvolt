"use client";

// Parking section — renders count + totalSpots prominently + parking list.
// Part of the HotspotReportPanel (P15-02).
import { FvInsetCard } from "@/components/design/fv-inset-card";

export interface ParkingRow {
  name: string | null;
  numberOfSpots: number | null;
  hgv: boolean | null;
  location: { lat: number; lng: number };
  distanceM: number;
}

export interface ParkingSectionProps {
  parking: {
    count: number;
    totalSpots: number;
    parking: ParkingRow[];
  };
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function ParkingSection({ parking }: ParkingSectionProps) {
  return (
    <FvInsetCard className="p-4" data-testid="parking-section">
      <h3 className="mb-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        Truck Parking
      </h3>
      <div className="mb-3 flex gap-6">
        <div>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
            {parking.count}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">sites</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
            {parking.totalSpots}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">total spots</p>
        </div>
      </div>
      {parking.parking.length > 0 && (
        <ul className="space-y-1">
          {parking.parking.slice(0, 8).map((p, i) => (
            <li
              key={i}
              className="flex items-center justify-between text-sm text-[var(--color-text-primary)]"
            >
              <span>{p.name ?? "Unnamed"}</span>
              <span className="text-[var(--color-text-secondary)]">
                {p.numberOfSpots ?? "?"} spots · {formatDistance(p.distanceM)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </FvInsetCard>
  );
}
