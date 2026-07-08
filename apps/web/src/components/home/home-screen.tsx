"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { components } from "@fleetvolt/shared-types";
import { AppActionBar } from "@/components/design/app-action-bar";
import { RoutePlannerFrame } from "@/components/design/route-planner-frame";
import { ScreenHeader } from "@/components/design/screen-header";
import { FvInsetCard } from "@/components/design/fv-inset-card";
import { FvVizPanel } from "@/components/design/fv-viz-panel";
import { RouteDiagramPreview } from "@/components/home/route-diagram-preview";
import { SummaryMetricsRow } from "@/components/kpi/summary-metrics-row";
import { corridorPreview } from "@/lib/corridor-preview";

type SimulateResponse = components["schemas"]["SimulateResponse"];
type CorridorCatalogEntry = components["schemas"]["CorridorCatalogEntry"];

type HomeScreenProps = {
  corridors: CorridorCatalogEntry[];
  chargerCount: number;
};

function previewOutputs(preview: ReturnType<typeof corridorPreview>): SimulateResponse {
  const distM = preview.distMi * 1609.344;
  return {
    segments: [
      {
        dist_m: 0,
        grade: 0,
        speed: 0,
        soc_pct: 100,
        energy_kwh: 0,
        charging_event: false,
      },
      {
        dist_m: distM,
        grade: preview.gradePct,
        speed: 55,
        soc_pct: 45,
        energy_kwh: preview.energyKwh,
        charging_event: false,
      },
    ],
    kpis: {
      total_kwh: preview.energyKwh,
      wh_per_mi: preview.distMi > 0 ? (preview.energyKwh * 1000) / preview.distMi : 0,
      regen_kwh: preview.regenKwh,
      total_time_s: 14400,
    },
    disclaimer: "",
    charging_stops: Array.from({ length: preview.stops }, (_, i) => ({
      station_id: `stop-${i}`,
      name: `Charger ${i + 1}`,
      lat: 34,
      lon: -117,
      power_kw: 350,
      arrival_soc_pct: 22,
      departure_soc_pct: 80,
      energy_added_kwh: 120,
      dwell_s: 1800,
      detour_s: 0,
    })),
    feasibility: {
      verdict: "feasible",
      tier: "public_hd",
      stop_count: preview.stops,
    },
  };
}

export function HomeScreen({ corridors, chargerCount }: HomeScreenProps) {
  const defaultKey =
    corridors.find((c) => c.corridor_key === "polb_cajon_pass")?.corridor_key ??
    corridors[0]?.corridor_key ??
    "";
  const [activeKey, setActiveKey] = useState(defaultKey);

  const activeCorridor = corridors.find((c) => c.corridor_key === activeKey);
  const preview = useMemo(
    () =>
      corridorPreview(
        activeKey,
        activeCorridor?.name ?? "Corridor",
      ),
    [activeCorridor?.name, activeKey],
  );

  const summaryOutputs = previewOutputs(preview);

  return (
    <RoutePlannerFrame maxWidthClass="max-w-[1240px]">
      <ScreenHeader
        title="FleetVolt Route"
        subtitle="EV FREIGHT MODELER v2.1 — POLB FOCUS"
        status={{
          text: `SoCal Charger Network — ${chargerCount} chargers loaded`,
          color: "#3f9b6b",
        }}
      />

      <div className="mt-5 grid grid-cols-[250px_minmax(0,1fr)_288px] gap-5">
        <aside className="flex flex-col gap-3.5">
          <div className="fv-section-label">SELECT CORRIDOR</div>
          <div className="flex flex-col gap-1.5">
            {corridors.map((corridor) => {
              const key = corridor.corridor_key!;
              const p = corridorPreview(key, corridor.name);
              const active = key === activeKey;
              return (
                <button
                  key={key}
                  type="button"
                  className={active ? "fv-corridor-row-active" : "fv-corridor-row"}
                  onClick={() => setActiveKey(key)}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-[13px] font-semibold">{p.short}</span>
                    <span className="font-mono text-[10px] opacity-75">
                      {p.distMi || "—"} MI
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] opacity-60">
                    {corridor.name}
                  </div>
                </button>
              );
            })}
          </div>

          <FvInsetCard className="font-mono text-[11px] text-[#3a3a3e]">
            <div className="fv-section-label mb-2.5">SCENARIO</div>
            <div className="flex justify-between border-b border-dashed border-black/10 py-1.5">
              <span className="text-[#8a8a92]">Departure</span>
              <span>06:00 PST</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-black/10 py-1.5">
              <span className="text-[#8a8a92]">Payload</span>
              <span>42,000 lb</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-black/10 py-1.5">
              <span className="text-[#8a8a92]">Weather</span>
              <span>Clear · 68°F</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#8a8a92]">Unit</span>
              <span>eCascadia 438</span>
            </div>
          </FvInsetCard>
        </aside>

        <section className="flex flex-col">
          <FvVizPanel
            title={`ROUTE ELEVATION & CHARGE PLAN — ${activeCorridor?.name ?? preview.short}`}
          >
            <div className="transition-transform duration-300 hover:scale-[1.012]">
              <RouteDiagramPreview title={activeCorridor?.name ?? preview.short} />
            </div>
          </FvVizPanel>
          <SummaryMetricsRow outputs={summaryOutputs} />
        </section>

        <aside className="flex flex-col gap-3">
          <div className="fv-section-label">SIMULATION PREVIEW</div>
          <div className="fv-feasibility-card">
            <div className="fv-feasibility-card-label">ENERGY USE</div>
            <div className="fv-feasibility-card-value">
              {preview.distMi > 0
                ? (preview.energyKwh / preview.distMi).toFixed(2)
                : "—"}
              <span className="ml-1 font-mono text-[11px] font-normal text-[#8a8a92]">
                kWh/mi
              </span>
            </div>
            <div className="mt-1 font-mono text-[9.5px] text-[#3f9b6b]">
              within battery envelope
            </div>
          </div>
          <div className="fv-feasibility-card">
            <div className="fv-feasibility-card-label">SAVINGS VS DIESEL</div>
            <div className="fv-feasibility-card-value">
              {preview.savingsPct || "—"}
              <span className="ml-1 font-mono text-[11px] font-normal text-[#8a8a92]">
                %
              </span>
            </div>
            <div className="mt-1 font-mono text-[9.5px] text-[#3f9b6b]">
              ton-mile basis
            </div>
          </div>
          <div className="fv-feasibility-card">
            <div className="fv-feasibility-card-label">CHARGE STOPS</div>
            <div className="fv-feasibility-card-value">{preview.stops}</div>
            <div className="mt-1 font-mono text-[9.5px] text-[#3f9b6b]">
              all ≥350 kW verified
            </div>
          </div>
          <Link
            href={`/planner?corridor=${encodeURIComponent(activeKey)}`}
            className="fv-btn-primary block text-center no-underline"
          >
            ▶ Run Physics Simulation
          </Link>
        </aside>
      </div>

      <AppActionBar />
      <div className="fv-footer-credit mt-3.5 text-right">
        POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
      </div>
    </RoutePlannerFrame>
  );
}
