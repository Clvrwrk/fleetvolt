"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { components } from "@fleetvolt/shared-types";
import {
  chargingStopDistanceM,
  distMToMiles,
  segmentsToChartData,
} from "@/lib/segment-lookup";
import { computeTotalDistM } from "@/lib/route-geometry";
import type { RouteCoordinates } from "@/lib/route-geometry";
import { useScenarioStore } from "@/stores/scenario-store";

type Segment = components["schemas"]["SegmentResult"];
type ChargingStop = components["schemas"]["ChargingStopResult"];

export type SocProfileChartProps = {
  segments: Segment[];
  chargingStops?: ChargingStop[];
  routeCoords?: RouteCoordinates;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: {
      distMi: number;
      socPct: number;
      energyKwh: number;
      grade: number;
    };
  }>;
};

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.[0]) {
    return null;
  }

  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-[var(--fv-stroke)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{point.distMi.toFixed(1)} mi</p>
      <p>SoC {point.socPct.toFixed(1)}%</p>
      <p>Energy {point.energyKwh.toFixed(1)} kWh</p>
      <p>Grade {point.grade.toFixed(1)}%</p>
    </div>
  );
}

export function SocProfileChart({
  segments,
  chargingStops = [],
  routeCoords = [],
}: SocProfileChartProps) {
  const [showEnergy, setShowEnergy] = useState(false);
  const activeDistanceM = useScenarioStore((s) => s.activeDistanceM);
  const setActiveDistanceM = useScenarioStore((s) => s.setActiveDistanceM);

  const chartData = useMemo(() => segmentsToChartData(segments), [segments]);
  const totalDistM = useMemo(() => computeTotalDistM(segments), [segments]);

  const stopDistancesMi = useMemo(
    () =>
      chargingStops.map((stop) =>
        distMToMiles(
          chargingStopDistanceM(segments, stop, routeCoords, totalDistM),
        ),
      ),
    [chargingStops, routeCoords, segments, totalDistM],
  );

  const activeDistanceMi =
    activeDistanceM != null ? distMToMiles(activeDistanceM) : null;

  if (segments.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-[var(--fv-stroke)] bg-white text-sm text-muted-foreground">
        No segment data for profile chart.
      </div>
    );
  }

  return (
    <div className="flex min-h-[240px] flex-col rounded-lg border border-[var(--fv-stroke)] bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          SoC profile
        </p>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showEnergy}
            onChange={(event) => setShowEnergy(event.target.checked)}
            className="rounded border-[var(--fv-stroke)]"
          />
          Energy (kWh)
        </label>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
          onMouseMove={(state) => {
            const index = state?.activeTooltipIndex;
            if (typeof index === "number" && chartData[index]) {
              setActiveDistanceM(chartData[index]!.distM);
            }
          }}
          onMouseLeave={() => {
            setActiveDistanceM(null);
          }}
        >
          <CartesianGrid stroke="#E5E5EB" strokeDasharray="3 3" />
          <XAxis
            dataKey="distMi"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: 11 }}
            label={{
              value: "Distance (mi)",
              position: "insideBottom",
              offset: -4,
              fontSize: 11,
            }}
          />
          <YAxis
            yAxisId="soc"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            label={{
              value: "SoC (%)",
              angle: -90,
              position: "insideLeft",
              fontSize: 11,
            }}
          />
          {showEnergy && (
            <YAxis
              yAxisId="energy"
              orientation="right"
              tick={{ fontSize: 11 }}
              label={{
                value: "Energy (kWh)",
                angle: 90,
                position: "insideRight",
                fontSize: 11,
              }}
            />
          )}
          <Tooltip content={<ChartTooltip />} />
          <Line
            yAxisId="soc"
            type="monotone"
            dataKey="socPct"
            stroke="#2D4A6F"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {showEnergy && (
            <Line
              yAxisId="energy"
              type="monotone"
              dataKey="energyKwh"
              stroke="#8A8A93"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          )}
          {stopDistancesMi.map((distMi, index) => (
            <ReferenceLine
              key={`stop-${index}`}
              x={distMi}
              yAxisId="soc"
              stroke="#8A8A93"
              strokeDasharray="4 4"
            />
          ))}
          {activeDistanceMi != null && (
            <ReferenceLine
              x={activeDistanceMi}
              yAxisId="soc"
              stroke="#6366f1"
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
