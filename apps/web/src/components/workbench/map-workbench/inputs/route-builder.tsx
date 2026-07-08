"use client";

import { ArrowRightLeft } from "lucide-react";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import type { WorkbenchPlace } from "../types";
import { PlaceInput } from "./place-input";

type RouteBuilderProps = {
  fleetId?: string;
};

export function RouteBuilder({ fleetId }: RouteBuilderProps) {
  const origin = useMapWorkbenchStore((state) => state.draft.origin ?? null);
  const destination = useMapWorkbenchStore((state) => state.draft.destination ?? null);
  const applyDraftPatch = useMapWorkbenchStore((state) => state.applyDraftPatch);

  function setOrigin(place: WorkbenchPlace | null) {
    applyDraftPatch({ origin: place });
  }

  function setDestination(place: WorkbenchPlace | null) {
    applyDraftPatch({ destination: place });
  }

  function swapEndpoints() {
    applyDraftPatch({ origin: destination, destination: origin });
  }

  return (
    <div className="space-y-3">
      <PlaceInput
        label="Origin"
        value={origin}
        onChange={setOrigin}
        fleetId={fleetId}
        placeholder="Port, fleet yard, charger, address, or lat,lng"
      />

      <div className="flex justify-center">
        <button
          type="button"
          onClick={swapEndpoints}
          disabled={!origin && !destination}
          className="flex min-h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-3 text-xs font-bold text-[var(--fv-graphite)] shadow-sm transition hover:border-[var(--fv-accent)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ArrowRightLeft size={14} />
          Swap
        </button>
      </div>

      <PlaceInput
        label="Destination"
        value={destination}
        onChange={setDestination}
        fleetId={fleetId}
        placeholder="Delivery point, carrier, POI, address, or lat,lng"
      />

      <div className="rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-[11px] leading-5 text-[var(--fv-steel)]">
        Selected endpoints are normalized with label, latitude/longitude, kind, and source metadata for route planning.
      </div>
    </div>
  );
}
