import { KpiCell } from "@/components/design/kpi-cell";
import { TechnicalLabel } from "@/components/design/technical-label";
import { formatKwhPerMi, formatPct, formatUsd } from "@/lib/catalog/format";
import { kwhPer100Miles } from "@/lib/catalog/energy";
import type { CatalogVehicle } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

export type EpaCatalogEfficiencyCardProps = {
  vehicle: CatalogVehicle;
  className?: string;
};

function formatEmissionsValue(n: number | null | undefined, decimals = 1): string {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

function PeerCompareBar({
  min,
  max,
  value,
}: {
  min: number;
  max: number;
  value: number | null;
}) {
  const span = max - min;
  const markerPct =
    value != null && span > 0
      ? Math.min(100, Math.max(0, ((value - min) / span) * 100))
      : null;

  return (
    <div className="space-y-2">
      <div className="relative h-3 rounded-sm border border-[var(--fv-stroke)]/30 bg-[var(--fv-surface-muted)]">
        <div
          className="absolute inset-y-0 left-0 rounded-l-sm bg-[var(--fv-blueprint-blue)]/20"
          style={{ width: "100%" }}
        />
        {markerPct != null ? (
          <div
            className="absolute top-1/2 z-[1] h-5 w-0.5 -translate-y-1/2 bg-[var(--fv-graphite)]"
            style={{ left: `calc(${markerPct}% - 1px)` }}
            aria-hidden
          />
        ) : null}
      </div>
      <div className="flex justify-between gap-2 text-[10px] text-[var(--fv-steel)]">
        <span className="font-[family-name:var(--font-mono)]">
          Best {formatKwhPerMi(min)} kWh/mi
        </span>
        <span className="font-[family-name:var(--font-mono)]">
          Worst {formatKwhPerMi(max)} kWh/mi
        </span>
      </div>
    </div>
  );
}

export function EpaCatalogEfficiencyCard({
  vehicle,
  className,
}: EpaCatalogEfficiencyCardProps) {
  const pending = vehicle.energyEstimatePending;
  const showCompare =
    vehicle.peerKwhPerMiMin != null && vehicle.peerKwhPerMiMax != null;
  const kwh100 =
    vehicle.kwhPerMiCombined != null
      ? kwhPer100Miles(vehicle.kwhPerMiCombined)
      : null;
  const emissions = vehicle.emissionsAnnual;

  return (
    <article
      data-testid="epa-catalog-efficiency-card"
      className={cn(
        "border border-[var(--fv-graphite)] bg-[var(--fv-surface)] text-[var(--fv-graphite)] shadow-sm",
        className,
      )}
    >
      {/* Header band */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--fv-graphite)] px-4 py-3">
        <div>
          <TechnicalLabel>FleetVolt · Energy &amp; Environment</TechnicalLabel>
          <p className="mt-1 text-xs text-[var(--fv-steel)]">
            Catalog model card · planning estimates
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded border border-[var(--fv-blueprint-blue)]/40 bg-[var(--fv-blueprint-blue)]/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-wide text-[var(--fv-blueprint-blue)]">
            {vehicle.technology}
          </span>
          <span className="rounded border border-[var(--fv-stroke)]/40 bg-[var(--fv-surface-muted)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-wide text-[var(--fv-slate)]">
            {vehicle.vehicleClassLabel}
          </span>
        </div>
      </header>

      {/* Identity strip */}
      <section className="border-b border-[var(--fv-graphite)] px-4 py-3">
        <h2 className="text-lg font-semibold tracking-tight">{vehicle.displayName}</h2>
        <p className="mt-1 text-sm text-[var(--fv-slate)]">
          {vehicle.oem} {vehicle.model}
          {vehicle.packKwh != null ? ` · ${vehicle.packKwh} kWh pack` : null}
          {" · "}
          {vehicle.category}
          {" · HVIP-eligible catalog model"}
        </p>
        {vehicle.physicsTruckName ? (
          <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[var(--fv-steel)]">
            Physics profile: {vehicle.physicsTruckName}
          </p>
        ) : null}
      </section>

      {pending ? (
        <div
          className="border-b border-[var(--fv-caution-amber)]/40 bg-[var(--fv-caution-amber)]/10 px-4 py-2 text-xs text-[var(--fv-slate)]"
          data-testid="epa-catalog-energy-pending"
        >
          Energy estimate pending — link a FleetVolt physics truck profile for
          kWh/mi and environment metrics.
        </div>
      ) : null}

      {/* Top metrics row */}
      <div className="grid border-b border-[var(--fv-graphite)] md:grid-cols-2">
        <section className="border-b border-[var(--fv-graphite)] p-4 md:border-b-0 md:border-r">
          <TechnicalLabel>Combined energy use</TechnicalLabel>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-mono)] text-5xl font-bold leading-none text-[var(--fv-graphite)]">
              {formatKwhPerMi(pending ? null : vehicle.kwhPerMiCombined)}
            </span>
            <span className="font-[family-name:var(--font-mono)] text-sm text-[var(--fv-steel)]">
              kWh/mi
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--fv-steel)]">combined duty</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="fv-mono-label text-[9px]">Fully laden</dt>
              <dd className="font-[family-name:var(--font-mono)] font-semibold">
                {formatKwhPerMi(pending ? null : vehicle.kwhPerMiFullyLaden)}{" "}
                <span className="text-xs font-normal text-[var(--fv-steel)]">
                  kWh/mi
                </span>
              </dd>
            </div>
            <div>
              <dt className="fv-mono-label text-[9px]">Drayage</dt>
              <dd className="font-[family-name:var(--font-mono)] font-semibold">
                {formatKwhPerMi(pending ? null : vehicle.kwhPerMiDrayage)}{" "}
                <span className="text-xs font-normal text-[var(--fv-steel)]">
                  kWh/mi
                </span>
              </dd>
            </div>
          </dl>
          <p className="mt-3 font-[family-name:var(--font-mono)] text-xs text-[var(--fv-slate)]">
            {kwh100 != null && !pending
              ? `${kwh100} kWh used every 100 miles`
              : "— kWh used every 100 miles"}
          </p>
        </section>

        <section className="p-4">
          <TechnicalLabel>Annual cost &amp; incentive</TechnicalLabel>
          <div className="mt-3 space-y-3">
            <div>
              <p className="fv-kpi-cell-label">Annual energy cost</p>
              <p className="font-[family-name:var(--font-mono)] text-2xl font-semibold">
                {formatUsd(pending ? null : vehicle.annualEnergyCostUsd)}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--fv-steel)]">
                est. @ 60,000 mi/yr · CA industrial rate
              </p>
            </div>
            <hr className="border-[var(--fv-stroke)]/30" />
            <div>
              <p className="fv-kpi-cell-label">HVIP base incentive</p>
              <p className="font-[family-name:var(--font-mono)] text-2xl font-semibold text-[var(--fv-signal-green)]">
                {formatUsd(vehicle.hvipIncentiveUsd)}
              </p>
              {vehicle.hvipVehicleUrl ? (
                <a
                  href={vehicle.hvipVehicleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[10px] text-[var(--fv-blueprint-blue)] underline-offset-2 hover:underline"
                >
                  HVIP catalog detail
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {/* Middle row */}
      <div className="grid border-b border-[var(--fv-graphite)] md:grid-cols-2">
        {showCompare ? (
          <section className="border-b border-[var(--fv-graphite)] p-4 md:border-b-0 md:border-r">
            <TechnicalLabel>How this vehicle compares</TechnicalLabel>
            <p className="mt-1 text-xs text-[var(--fv-steel)]">
              Class 8 BET peer range (FleetVolt catalog)
            </p>
            <div className="mt-3">
              <PeerCompareBar
                min={vehicle.peerKwhPerMiMin!}
                max={vehicle.peerKwhPerMiMax!}
                value={pending ? null : vehicle.kwhPerMiCombined}
              />
            </div>
          </section>
        ) : null}

        <section className={cn("p-4", !showCompare && "md:col-span-2")}>
          <TechnicalLabel>Environment vs diesel</TechnicalLabel>
          <p className="mt-1 text-xs text-[var(--fv-steel)]">
            Annual @ 60,000 mi · same duty for both
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[280px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--fv-stroke)]/40">
                  <th className="py-1.5 pr-2 font-normal text-[var(--fv-steel)]">
                    Factor
                  </th>
                  <th className="py-1.5 px-2 font-normal text-[var(--fv-steel)]">
                    Diesel
                  </th>
                  <th className="py-1.5 px-2 font-normal text-[var(--fv-steel)]">
                    This BEV
                  </th>
                  <th className="py-1.5 pl-2 font-normal text-[var(--fv-steel)]">
                    Avoided
                  </th>
                </tr>
              </thead>
              <tbody className="font-[family-name:var(--font-mono)]">
                <tr className="border-b border-[var(--fv-stroke)]/20">
                  <td className="py-2 pr-2 text-[var(--fv-slate)]">CO₂e (t/yr)</td>
                  <td className="py-2 px-2">
                    {formatEmissionsValue(emissions?.diesel.co2eT)}
                  </td>
                  <td className="py-2 px-2">
                    {formatEmissionsValue(emissions?.bev.co2eT)}
                  </td>
                  <td className="py-2 pl-2 text-[var(--fv-signal-green)]">
                    {formatEmissionsValue(emissions?.avoided.co2eT)}
                  </td>
                </tr>
                <tr className="border-b border-[var(--fv-stroke)]/20">
                  <td className="py-2 pr-2 text-[var(--fv-slate)]">NOx (kg/yr)</td>
                  <td className="py-2 px-2">
                    {formatEmissionsValue(emissions?.diesel.noxKg)}
                  </td>
                  <td className="py-2 px-2">
                    {formatEmissionsValue(emissions?.bev.noxKg)}
                  </td>
                  <td className="py-2 pl-2 text-[var(--fv-signal-green)]">
                    {formatEmissionsValue(emissions?.avoided.noxKg)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-2 text-[var(--fv-slate)]">PM₂.₅ (kg/yr)</td>
                  <td className="py-2 px-2">
                    {formatEmissionsValue(emissions?.diesel.pm25Kg, 2)}
                  </td>
                  <td className="py-2 px-2">
                    {formatEmissionsValue(emissions?.bev.pm25Kg, 2)}
                  </td>
                  <td className="py-2 pl-2 text-[var(--fv-signal-green)]">
                    {formatEmissionsValue(emissions?.avoided.pm25Kg, 2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {emissions ? (
            <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[var(--fv-signal-green)]">
              {formatPct(emissions.avoided.pctCo2e)} less CO₂e than Class 8 diesel
            </p>
          ) : null}
        </section>
      </div>

      {/* Spec strip */}
      <section className="grid grid-cols-2 border-b border-[var(--fv-graphite)] md:grid-cols-4">
        <KpiCell
          label="Pack"
          value={vehicle.packKwh != null ? `${vehicle.packKwh}` : "—"}
          unit={vehicle.packKwh != null ? "kWh" : undefined}
          className="rounded-none border-0 border-r border-[var(--fv-graphite)] shadow-none"
        />
        <KpiCell
          label="Class"
          value={vehicle.vehicleClassLabel}
          className="rounded-none border-0 border-r border-[var(--fv-graphite)] shadow-none"
        />
        <KpiCell
          label="Category"
          value={vehicle.category}
          className="rounded-none border-0 border-r border-[var(--fv-graphite)] shadow-none"
        />
        <KpiCell
          label="Tech"
          value={vehicle.technology}
          className="rounded-none border-0 shadow-none"
        />
      </section>

      {/* Fine print */}
      <footer className="space-y-1 px-4 py-3 text-[10px] leading-relaxed text-[var(--fv-steel)]">
        <p>
          Planning estimates from FleetVolt physics profiles — not EPA-certified
          fuel economy or emissions scores.
        </p>
        <p>
          Peer comparison uses FleetVolt HVIP catalog peers (Class 8 BET), not
          fueleconomy.gov.
        </p>
        <p>
          Environment vs diesel uses illustrative planning factors until Phase 5
          WTW lookup tables; grid-inclusive CO₂e @ CA industrial assumptions.
        </p>
        <p>
          HVIP base incentive may vary by air district, DAC status, and drayage
          eligibility.
        </p>
      </footer>
    </article>
  );
}
