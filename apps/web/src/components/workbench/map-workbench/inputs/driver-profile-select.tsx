"use client";

import { UserRound } from "lucide-react";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";

export const CAAS_DRIVER_PROFILES = [
  {
    id: "regional_drayage",
    label: "Regional drayage",
    note: "Port ↔ inland warehouse, same-day turns",
  },
  {
    id: "long_haul_regional",
    label: "Long-haul regional",
    note: "Multi-stop corridor with overnight dwell",
  },
  {
    id: "local_shuttle",
    label: "Local shuttle",
    note: "Short hops near port / rail yard",
  },
] as const;

type DriverProfileSelectProps = {
  className?: string;
};

export function DriverProfileSelect({ className }: DriverProfileSelectProps) {
  const profileId = useMapWorkbenchStore(
    (state) =>
      (state.draft.metadata?.driverProfile as string | undefined) ??
      CAAS_DRIVER_PROFILES[0].id,
  );
  const applyDraftPatch = useMapWorkbenchStore((state) => state.applyDraftPatch);
  const selected =
    CAAS_DRIVER_PROFILES.find((p) => p.id === profileId) ?? CAAS_DRIVER_PROFILES[0];

  return (
    <div className={cn("space-y-2", className)}>
      <label className="block space-y-1">
        <TechnicalLabel>Driver profile</TechnicalLabel>
        <select
          value={selected.id}
          onChange={(event) => {
            applyDraftPatch({
              metadata: {
                ...(useMapWorkbenchStore.getState().draft.metadata ?? {}),
                driverProfile: event.target.value,
              },
            });
          }}
          className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
        >
          {CAAS_DRIVER_PROFILES.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.label}
            </option>
          ))}
        </select>
      </label>
      <div className="rounded-xl border border-black/10 bg-white/70 p-3 text-xs leading-5 text-[var(--fv-steel)]">
        <div className="flex items-start gap-2">
          <UserRound size={15} className="mt-0.5 shrink-0 text-[var(--fv-accent)]" />
          <div className="font-semibold text-[var(--fv-graphite)]">{selected.note}</div>
        </div>
      </div>
    </div>
  );
}
