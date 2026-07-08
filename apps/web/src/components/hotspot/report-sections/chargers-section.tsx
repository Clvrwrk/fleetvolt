"use client";

// Chargers section — renders class8WithinRadius + closestClass8DistanceM as
// headline metrics + fiveClosest table + class8Chargers list.
// Part of the HotspotReportPanel (P15-02).
import { FvInsetCard } from "@/components/design/fv-inset-card";

export interface ChargerRow {
  stationId: string;
  name: string | null;
  powerKw: number;
  maxVehicleClass: string | null;
  connectorTypes: string[];
  isClass8Capable: boolean;
  distanceM: number;
}

export interface ChargersSectionProps {
  chargers: {
    fiveClosest: ChargerRow[];
    class8WithinRadius: number;
    closestClass8DistanceM: number | null;
    class8Chargers: ChargerRow[];
  };
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function ChargersSection({ chargers }: ChargersSectionProps) {
  return (
    <FvInsetCard className="p-4" data-testid="chargers-section">
      <h3 className="mb-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        Charging Infrastructure
      </h3>
      <div className="mb-3 flex gap-6">
        <div>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
            {chargers.class8WithinRadius}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Class-8 in radius
          </p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
            {chargers.closestClass8DistanceM !== null
              ? formatDistance(chargers.closestClass8DistanceM)
              : "—"}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            nearest Class-8
          </p>
        </div>
      </div>

      {chargers.fiveClosest.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
            5 Closest Chargers
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--color-text-secondary)]">
                <th className="text-left font-normal">Name</th>
                <th className="text-right font-normal">kW</th>
                <th className="text-right font-normal">Class</th>
                <th className="text-right font-normal">Dist</th>
              </tr>
            </thead>
            <tbody>
              {chargers.fiveClosest.map((c, i) => (
                <tr key={i} className="text-[var(--color-text-primary)]">
                  <td>{c.name ?? c.stationId}</td>
                  <td className="text-right">{c.powerKw}</td>
                  <td className="text-right">
                    {c.isClass8Capable ? "8" : c.maxVehicleClass ?? "—"}
                  </td>
                  <td className="text-right">{formatDistance(c.distanceM)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {chargers.class8Chargers.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
            Class-8 Chargers in Radius
          </p>
          <ul className="space-y-1">
            {chargers.class8Chargers.map((c, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-sm text-[var(--color-text-primary)]"
              >
                <span>{c.name ?? c.stationId}</span>
                <span className="text-[var(--color-text-secondary)]">
                  {c.powerKw} kW · {formatDistance(c.distanceM)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </FvInsetCard>
  );
}
