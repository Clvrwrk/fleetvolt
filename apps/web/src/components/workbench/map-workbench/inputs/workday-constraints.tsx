"use client";

import { Clock, CloudSun, Package } from "lucide-react";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";

type WorkdayConstraintsProps = {
  className?: string;
};

const weatherOptions = [
  { value: "ideal", label: "Ideal", note: "FleetVolt baseline" },
  { value: "hot", label: "Hot", note: "Aux / thermal load" },
  { value: "cold", label: "Cold", note: "Range derate" },
  { value: "headwind", label: "Headwind", note: "Aero penalty" },
] as const;

function numberMetadata(key: string, fallback: number): number {
  const value = useMapWorkbenchStore.getState().draft.metadata?.[key];
  return typeof value === "number" ? value : fallback;
}

function stringMetadata(key: string, fallback: string): string {
  const value = useMapWorkbenchStore.getState().draft.metadata?.[key];
  return typeof value === "string" ? value : fallback;
}

export function WorkdayConstraints({ className }: WorkdayConstraintsProps) {
  const metadata = useMapWorkbenchStore((state) => state.draft.metadata ?? {});
  const applyDraftPatch = useMapWorkbenchStore((state) => state.applyDraftPatch);

  const roundTrips = typeof metadata.roundTrips === "number" ? metadata.roundTrips : 1;
  const payloadLbs = typeof metadata.payloadLbs === "number" ? metadata.payloadLbs : 34_000;
  const weatherPreset = typeof metadata.weatherPreset === "string" ? metadata.weatherPreset : "ideal";
  const workdayHours = typeof metadata.workdayHours === "number" ? metadata.workdayHours : 10;
  const breakMinutes = typeof metadata.breakMinutes === "number" ? metadata.breakMinutes : 30;

  function patchMetadata(patch: Record<string, number | string | boolean>) {
    applyDraftPatch({
      metadata: {
        ...useMapWorkbenchStore.getState().draft.metadata,
        ...patch,
      },
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <TechnicalLabel>Round trips</TechnicalLabel>
          <input
            type="number"
            min={1}
            max={8}
            value={roundTrips}
            onChange={(event) => patchMetadata({ roundTrips: Number(event.target.value) })}
            className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
          />
        </label>
        <label className="space-y-1">
          <TechnicalLabel>Payload lbs</TechnicalLabel>
          <input
            type="number"
            min={20_000}
            max={80_000}
            step={1_000}
            value={payloadLbs}
            onChange={(event) => patchMetadata({ payloadLbs: Number(event.target.value) })}
            className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <TechnicalLabel>Weather / road load</TechnicalLabel>
        <select
          value={weatherPreset}
          onChange={(event) => patchMetadata({ weatherPreset: event.target.value })}
          className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
        >
          {weatherOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} — {option.note}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <TechnicalLabel>Workday hours</TechnicalLabel>
          <input
            type="number"
            min={1}
            max={18}
            step={0.5}
            value={workdayHours}
            onChange={(event) => patchMetadata({ workdayHours: Number(event.target.value) })}
            className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
          />
        </label>
        <label className="space-y-1">
          <TechnicalLabel>Break min</TechnicalLabel>
          <input
            type="number"
            min={0}
            max={240}
            step={15}
            value={breakMinutes}
            onChange={(event) => patchMetadata({ breakMinutes: Number(event.target.value) })}
            className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px] leading-4 text-[var(--fv-steel)]">
        <div className="rounded-xl border border-black/10 bg-white/70 p-2">
          <Package size={14} className="mb-1 text-[var(--fv-accent)]" />
          Payload feeds the physics model.
        </div>
        <div className="rounded-xl border border-black/10 bg-white/70 p-2">
          <CloudSun size={14} className="mb-1 text-[var(--fv-accent)]" />
          Weather is modeled, not observed.
        </div>
        <div className="rounded-xl border border-black/10 bg-white/70 p-2">
          <Clock size={14} className="mb-1 text-[var(--fv-accent)]" />
          HOS compliance remains advisory.
        </div>
      </div>
    </div>
  );
}

export function getDriverConstraintDefaults() {
  return {
    roundTrips: numberMetadata("roundTrips", 1),
    payloadLbs: numberMetadata("payloadLbs", 34_000),
    weatherPreset: stringMetadata("weatherPreset", "ideal"),
    workdayHours: numberMetadata("workdayHours", 10),
    breakMinutes: numberMetadata("breakMinutes", 30),
  };
}
