"use client";

import { CalendarDays, Clock, RotateCcw, Ship, Warehouse } from "lucide-react";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";

export type FleetContractDefaults = {
  serviceDate: string;
  scheduleWindow: string;
  containersPerDay: number;
  gateStartHour: number;
  gateEndHour: number;
  portDwellMinutes: number;
  destinationDwellMinutes: number;
  shiftHours: number;
  yardReturn: boolean;
};

type ContractConstraintsProps = {
  className?: string;
};

/** Stable fallback — never allocate `{}` inside a Zustand selector (infinite loop). */
const EMPTY_METADATA: Record<string, unknown> = Object.freeze({});

type ContractPatchValue = number | string | boolean;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function metadataValue(key: string): unknown {
  return useMapWorkbenchStore.getState().draft.metadata?.[key];
}

function numberMetadata(key: string, fallback: number): number {
  const value = metadataValue(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringMetadata(key: string, fallback: string): string {
  const value = metadataValue(key);
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function booleanMetadata(key: string, fallback: boolean): boolean {
  const value = metadataValue(key);
  return typeof value === "boolean" ? value : fallback;
}

export function getFleetContractDefaults(): FleetContractDefaults {
  return {
    serviceDate: stringMetadata("serviceDate", todayIsoDate()),
    scheduleWindow: stringMetadata("scheduleWindow", "Day shift"),
    containersPerDay: numberMetadata("containersPerDay", 24),
    gateStartHour: numberMetadata("gateStartHour", 6),
    gateEndHour: numberMetadata("gateEndHour", 18),
    portDwellMinutes: numberMetadata("portDwellMinutes", 60),
    destinationDwellMinutes: numberMetadata("destinationDwellMinutes", 45),
    shiftHours: numberMetadata("shiftHours", 10),
    yardReturn: booleanMetadata("yardReturn", true),
  };
}

export function ContractConstraints({ className }: ContractConstraintsProps) {
  const metadata = useMapWorkbenchStore(
    (state) => state.draft.metadata ?? EMPTY_METADATA,
  );
  const applyDraftPatch = useMapWorkbenchStore((state) => state.applyDraftPatch);

  const serviceDate = typeof metadata.serviceDate === "string" ? metadata.serviceDate : todayIsoDate();
  const scheduleWindow = typeof metadata.scheduleWindow === "string" ? metadata.scheduleWindow : "Day shift";
  const containersPerDay = typeof metadata.containersPerDay === "number" ? metadata.containersPerDay : 24;
  const gateStartHour = typeof metadata.gateStartHour === "number" ? metadata.gateStartHour : 6;
  const gateEndHour = typeof metadata.gateEndHour === "number" ? metadata.gateEndHour : 18;
  const portDwellMinutes = typeof metadata.portDwellMinutes === "number" ? metadata.portDwellMinutes : 60;
  const destinationDwellMinutes = typeof metadata.destinationDwellMinutes === "number" ? metadata.destinationDwellMinutes : 45;
  const shiftHours = typeof metadata.shiftHours === "number" ? metadata.shiftHours : 10;
  const yardReturn = typeof metadata.yardReturn === "boolean" ? metadata.yardReturn : true;

  function patchMetadata(patch: Record<string, ContractPatchValue>) {
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
          <TechnicalLabel>Service date</TechnicalLabel>
          <input
            type="date"
            value={serviceDate}
            onChange={(event) => patchMetadata({ serviceDate: event.target.value })}
            className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
          />
        </label>
        <label className="space-y-1">
          <TechnicalLabel>Schedule</TechnicalLabel>
          <select
            value={scheduleWindow}
            onChange={(event) => patchMetadata({ scheduleWindow: event.target.value })}
            className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
          >
            <option value="Day shift">Day shift</option>
            <option value="Swing shift">Swing shift</option>
            <option value="Night gate">Night gate</option>
            <option value="24h gate">24h gate</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <TechnicalLabel>Containers / day</TechnicalLabel>
        <input
          type="number"
          min={1}
          max={500}
          step={1}
          value={containersPerDay}
          onChange={(event) => patchMetadata({ containersPerDay: Number(event.target.value) })}
          className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <TechnicalLabel>Gate open</TechnicalLabel>
          <input
            type="number"
            min={0}
            max={23}
            step={0.5}
            value={gateStartHour}
            onChange={(event) => patchMetadata({ gateStartHour: Number(event.target.value) })}
            className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
          />
        </label>
        <label className="space-y-1">
          <TechnicalLabel>Gate close</TechnicalLabel>
          <input
            type="number"
            min={1}
            max={24}
            step={0.5}
            value={gateEndHour}
            onChange={(event) => patchMetadata({ gateEndHour: Number(event.target.value) })}
            className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <TechnicalLabel>Port dwell min</TechnicalLabel>
          <input
            type="number"
            min={0}
            max={360}
            step={15}
            value={portDwellMinutes}
            onChange={(event) => patchMetadata({ portDwellMinutes: Number(event.target.value) })}
            className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
          />
        </label>
        <label className="space-y-1">
          <TechnicalLabel>Dest dwell min</TechnicalLabel>
          <input
            type="number"
            min={0}
            max={360}
            step={15}
            value={destinationDwellMinutes}
            onChange={(event) => patchMetadata({ destinationDwellMinutes: Number(event.target.value) })}
            className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <TechnicalLabel>Shift hours</TechnicalLabel>
          <input
            type="number"
            min={4}
            max={16}
            step={0.5}
            value={shiftHours}
            onChange={(event) => patchMetadata({ shiftHours: Number(event.target.value) })}
            className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
          />
        </label>
        <label className="space-y-1">
          <TechnicalLabel>Yard return</TechnicalLabel>
          <button
            type="button"
            aria-pressed={yardReturn}
            onClick={() => patchMetadata({ yardReturn: !yardReturn })}
            className={cn(
              "flex min-h-11 w-full items-center justify-center rounded-xl border px-3 text-sm font-bold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]",
              yardReturn
                ? "border-[var(--fv-accent)] bg-[var(--fv-accent)] text-white"
                : "border-black/10 bg-white text-[var(--fv-graphite)]",
            )}
          >
            {yardReturn ? "Required" : "Not required"}
          </button>
        </label>
      </div>

      <div className="grid grid-cols-4 gap-2 text-[11px] leading-4 text-[var(--fv-steel)]">
        <div className="rounded-xl border border-black/10 bg-white/70 p-2">
          <Ship size={14} className="mb-1 text-[var(--fv-accent)]" />
          Port gate and dwell bound cycle time.
        </div>
        <div className="rounded-xl border border-black/10 bg-white/70 p-2">
          <Warehouse size={14} className="mb-1 text-[var(--fv-accent)]" />
          Inland dwell is modeled per container turn.
        </div>
        <div className="rounded-xl border border-black/10 bg-white/70 p-2">
          <Clock size={14} className="mb-1 text-[var(--fv-accent)]" />
          Shift length sets trips/truck/day.
        </div>
        <div className="rounded-xl border border-black/10 bg-white/70 p-2">
          {yardReturn ? <RotateCcw size={14} className="mb-1 text-[var(--fv-accent)]" /> : <CalendarDays size={14} className="mb-1 text-[var(--fv-accent)]" />}
          Yard return adds end-of-shift time.
        </div>
      </div>
    </div>
  );
}
