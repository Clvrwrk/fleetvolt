"use client";

import type { RefObject } from "react";
import type { FvMapHandle } from "@/lib/map-ref";
import type { components } from "@fleetvolt/shared-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ChargingStop = components["schemas"]["ChargingStopResult"];

export type ChargingPlanTableProps = {
  chargingStops: ChargingStop[];
  selectedStopId?: string | null;
  onStopSelect?: (stop: ChargingStop) => void;
  mapRef?: RefObject<FvMapHandle | null>;
};

function stopKey(stop: ChargingStop, index: number): string {
  return stop.station_id || `stop-${index}`;
}

function formatDwellMinutes(dwellS: number): string {
  return `${Math.round(dwellS / 60)} min`;
}

function locationLabel(stop: ChargingStop): string {
  return stop.name?.trim() || stop.station_id;
}

export function ChargingPlanTable({
  chargingStops,
  selectedStopId,
  onStopSelect,
  mapRef,
}: ChargingPlanTableProps) {
  if (chargingStops.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No charging stops recommended for this scenario.
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
    <Table data-testid="charging-plan-table">
      <TableHeader>
        <TableRow>
          <TableHead>Location</TableHead>
          <TableHead>Power</TableHead>
          <TableHead>Arrival SoC</TableHead>
          <TableHead>Energy added</TableHead>
          <TableHead>Dwell</TableHead>
          <TableHead>Departure SoC</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {chargingStops.map((stop, index) => {
          const key = stopKey(stop, index);
          const isSelected = selectedStopId === key;

          return (
            <TableRow
              key={key}
              data-state={isSelected ? "selected" : undefined}
              data-testid={`charging-stop-row-${key}`}
              className="cursor-pointer"
              tabIndex={0}
              onClick={() => handleRowClick(stop, index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleRowClick(stop, index);
                }
              }}
            >
              <TableCell className="font-medium">{locationLabel(stop)}</TableCell>
              <TableCell>{stop.power_kw} kW</TableCell>
              <TableCell>{stop.arrival_soc_pct}%</TableCell>
              <TableCell>{stop.energy_added_kwh.toFixed(1)} kWh</TableCell>
              <TableCell>{formatDwellMinutes(stop.dwell_s)}</TableCell>
              <TableCell>{stop.departure_soc_pct}%</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
