"use client";

import type { RefObject } from "react";
import type { FvMapHandle } from "@/lib/map-ref";
import type { components } from "@fleetvolt/shared-types";

type ChargingStop = components["schemas"]["ChargingStopResult"];

export type ChargingPlanCompactProps = {
  chargingStops: ChargingStop[];
  selectedStopId?: string | null;
  onStopSelect?: (stop: ChargingStop) => void;
  mapRef?: RefObject<FvMapHandle | null>;
};

function stopKey(stop: ChargingStop, index: number): string {
  return stop.station_id || `stop-${index}`;
}

function locationLabel(stop: ChargingStop): string {
  return stop.name?.trim() || stop.station_id;
}

function arrivalColor(soc: number): string {
  if (soc < 20) {
    return "#c0392b";
  }
  if (soc < 35) {
    return "#b8874c";
  }
  return "#1a1a1e";
}

export function ChargingPlanCompact({
  chargingStops,
  selectedStopId,
  onStopSelect,
  mapRef,
}: ChargingPlanCompactProps) {
  if (chargingStops.length === 0) {
    return (
      <p className="py-4 text-center font-mono text-[10.5px] text-[#9a9aa2]">
        No charging stops for this scenario.
      </p>
    );
  }

  const handleRowClick = (stop: ChargingStop, index: number) => {
    onStopSelect?.(stop);
    if (mapRef?.current) {
      mapRef.current.panTo(stop.lat, stop.lon, 12);
    }
  };

  return (
    <div data-testid="charging-plan-table">
      <div className="fv-charge-grid fv-charge-grid-head">
        <div>SITE</div>
        <div className="text-right">ARR%</div>
        <div className="text-right">kW</div>
        <div className="text-right">MIN</div>
      </div>
      {chargingStops.map((stop, index) => {
        const key = stopKey(stop, index);
        const isSelected = selectedStopId === key;
        const dwellMin = Math.round(stop.dwell_s / 60);

        return (
          <button
            key={key}
            type="button"
            data-testid={`charging-stop-row-${key}`}
            className={`fv-charge-grid fv-charge-grid-row w-full text-left ${isSelected ? "fv-charge-grid-row-selected" : ""}`}
            onClick={() => handleRowClick(stop, index)}
          >
            <div className="font-sans text-[11px] font-medium">{locationLabel(stop)}</div>
            <div
              className="text-right font-semibold"
              style={{ color: arrivalColor(stop.arrival_soc_pct) }}
            >
              {Math.round(stop.arrival_soc_pct)}%
            </div>
            <div className="text-right text-[#6b6b73]">{stop.power_kw}</div>
            <div className="text-right font-semibold text-[#111116]">{dwellMin}</div>
          </button>
        );
      })}
    </div>
  );
}
