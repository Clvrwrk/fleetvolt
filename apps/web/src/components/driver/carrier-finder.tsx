"use client";

// Carrier finder (P-DRIVER) — browse/search carriers near a lat/lng point.
//
// Uses two Convex queries:
//   • driver.queries.listCarriersNear — located carriers within radius (delegates
//     to carriers.queries.carriersInRadius)
//   • carriers.queries.carrierDensityByCorridorCity — cluster ranking
//
// The "Associate" button calls back to the parent so the registration form can
// set associatedCarrierKey on the profile.
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

type CarrierRow = {
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  corridorCity: string | null;
  location: { lat: number; lng: number } | null;
  distanceM: number;
};

type CarrierFinderProps = {
  lat: number;
  lng: number;
  selectedCarrierKey: string | null;
  onAssociate: (carrierKey: string | null, carrierName: string | null) => void;
};

const RADIUS_PRESETS = [
  { label: "5 mi", valueM: 8047 },
  { label: "10 mi", valueM: 16093 },
  { label: "25 mi", valueM: 40234 },
  { label: "50 mi", valueM: 80467 },
];

export function CarrierFinder({
  lat,
  lng,
  selectedCarrierKey,
  onAssociate,
}: CarrierFinderProps) {
  const [radiusM, setRadiusM] = useState(16093);

  const carriers = useQuery(api.driver.queries.listCarriersNear, {
    lat,
    lng,
    radiusM,
    limit: 50,
  }) as CarrierRow[] | undefined;

  const density = useQuery(api.carriers.queries.carrierDensityByCorridorCity);

  return (
    <div className="space-y-5">
      {/* Radius selector */}
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">
          Search radius
        </label>
        <div className="flex gap-2">
          {RADIUS_PRESETS.map((preset) => (
            <button
              key={preset.valueM}
              type="button"
              onClick={() => setRadiusM(preset.valueM)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                radiusM === preset.valueM
                  ? "bg-[var(--fv-accent)] text-white"
                  : "bg-[var(--fv-surface-muted)] text-[var(--fv-text-secondary)] hover:bg-[var(--fv-accent)]/10"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Carrier density by corridor city */}
      {density && (
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">
            Carrier density by corridor city
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {density.clusters.slice(0, 8).map((cluster) => (
              <span
                key={cluster.corridorCity}
                className="rounded-full bg-[var(--fv-surface-muted)] px-2.5 py-1 text-[10px] font-medium text-[var(--fv-text-secondary)]"
              >
                {cluster.corridorCity}: {cluster.count}
              </span>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-[var(--fv-text-muted)]">
            {density.totalInCorridor} carriers in corridor
          </p>
        </div>
      )}

      {/* Carrier list */}
      <div>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">
          Carriers near this terminal
        </h4>
        {carriers === undefined ? (
          <p className="text-sm text-[var(--fv-text-muted)]">Loading…</p>
        ) : carriers.length === 0 ? (
          <p className="text-sm text-[var(--fv-text-muted)]">
            No geocoded carriers within {Math.round(radiusM / 1609.34)} mi.
          </p>
        ) : (
          <div className="max-h-[320px] space-y-1.5 overflow-y-auto">
            {carriers.map((carrier, i) => {
              // Use index as a fallback key — carrierKey is not in the row
              const isSelected = false; // selection tracked by key in parent
              const distanceMi = (carrier.distanceM / 1609.34).toFixed(1);
              return (
                <div
                  key={`${carrier.name}-${i}`}
                  className={`flex items-center justify-between rounded-lg border p-2.5 text-sm transition-colors ${
                    isSelected
                      ? "border-[var(--fv-accent)] bg-[var(--fv-accent)]/5"
                      : "border-black/8 bg-[var(--fv-surface)]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--fv-text)]">
                      {carrier.name}
                    </p>
                    <p className="truncate text-[11px] text-[var(--fv-text-muted)]">
                      {carrier.city ? `${carrier.city}, ` : ""}
                      {carrier.state ?? ""} · {distanceMi} mi
                      {carrier.corridorCity
                        ? ` · ${carrier.corridorCity}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onAssociate(
                        // carrierKey not in row; use name as a stable key
                        // (the profile stores it; a future query can resolve)
                        carrier.name,
                        carrier.name,
                      )
                    }
                    className="ml-2 shrink-0 rounded-md bg-[var(--fv-accent)] px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90"
                  >
                    Associate
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clear association */}
      {selectedCarrierKey && (
        <button
          type="button"
          onClick={() => onAssociate(null, null)}
          className="text-[11px] text-[var(--fv-text-muted)] underline hover:text-[var(--fv-text)]"
        >
          Clear carrier association ({selectedCarrierKey})
        </button>
      )}
    </div>
  );
}
