"use client";

import { Truck } from "lucide-react";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";

export type DriverTruckProfile = {
  slug: string;
  label: string;
  batteryKwh: number;
  maxChargeKw: number;
  recommendedMiles: number;
  note: string;
};

export const DRIVER_TRUCK_PROFILES: DriverTruckProfile[] = [
  {
    slug: "ecascadia_438",
    label: "Freightliner eCascadia 438 kWh",
    batteryKwh: 438,
    maxChargeKw: 350,
    recommendedMiles: 155,
    note: "Default Class 8 drayage profile",
  },
  {
    slug: "vnr_electric_565",
    label: "Volvo VNR Electric 565 kWh",
    batteryKwh: 565,
    maxChargeKw: 250,
    recommendedMiles: 190,
    note: "Longer usable battery envelope",
  },
  {
    slug: "tesla_semi_800",
    label: "Tesla Semi 800 kWh",
    batteryKwh: 800,
    maxChargeKw: 750,
    recommendedMiles: 300,
    note: "High-capacity future-facing profile",
  },
];

type TruckProfileSelectProps = {
  className?: string;
};

export function TruckProfileSelect({ className }: TruckProfileSelectProps) {
  const truckSlug = useMapWorkbenchStore(
    (state) => (state.draft.metadata?.truckSlug as string | undefined) ?? DRIVER_TRUCK_PROFILES[0].slug,
  );
  const applyDraftPatch = useMapWorkbenchStore((state) => state.applyDraftPatch);
  const selected = DRIVER_TRUCK_PROFILES.find((profile) => profile.slug === truckSlug) ?? DRIVER_TRUCK_PROFILES[0];

  function updateTruckProfile(slug: string) {
    const profile = DRIVER_TRUCK_PROFILES.find((candidate) => candidate.slug === slug) ?? DRIVER_TRUCK_PROFILES[0];
    applyDraftPatch({
      vehicleClass: profile.label,
      metadata: {
        ...useMapWorkbenchStore.getState().draft.metadata,
        truckSlug: profile.slug,
        truckBatteryKwh: profile.batteryKwh,
        maxChargeKw: profile.maxChargeKw,
        recommendedMiles: profile.recommendedMiles,
      },
    });
  }

  return (
    <div className={cn("space-y-2", className)}>
      <label className="block space-y-1">
        <TechnicalLabel>Truck / profile</TechnicalLabel>
        <select
          value={selected.slug}
          onChange={(event) => updateTruckProfile(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
        >
          {DRIVER_TRUCK_PROFILES.map((profile) => (
            <option key={profile.slug} value={profile.slug}>
              {profile.label}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-xl border border-black/10 bg-white/70 p-3 text-xs leading-5 text-[var(--fv-steel)]">
        <div className="flex items-start gap-2">
          <Truck size={15} className="mt-0.5 shrink-0 text-[var(--fv-accent)]" />
          <div>
            <div className="font-semibold text-[var(--fv-graphite)]">{selected.note}</div>
            <div>
              {selected.batteryKwh} kWh usable · {selected.maxChargeKw} kW max charge · {selected.recommendedMiles} mi planning envelope
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
