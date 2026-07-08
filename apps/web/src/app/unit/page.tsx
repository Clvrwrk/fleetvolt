"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FramedPanel } from "@/components/design/framed-panel";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { TechnicalLabel } from "@/components/design/technical-label";
import { KpiCell } from "@/components/design/kpi-cell";
import { Truck } from "lucide-react";

export default function UnitConfiguratorPage() {
  const trucks = useQuery(api.trucks.queries.list) ?? [];

  return (
    <FramedPanel className="p-6">
      <div className="mb-6">
        <TechnicalLabel>UNIT CONFIGURATOR</TechnicalLabel>
        <h1 className="text-lg font-bold mt-1 text-[var(--fv-text)]">Class 8 BEV Tractor Specs</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {trucks.slice(0, 9).map((t: Record<string, unknown>) => (
          <SkeuomorphicCard key={String(t.name)} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Truck size={16} className="text-[var(--fv-accent)]" />
              <span className="text-sm font-semibold text-[var(--fv-text)]">{String(t.name ?? "Unknown")}</span>
            </div>
            <KpiCell label="BATTERY" value={`${t.batteryUsableKwh ?? t.batteryNameplateKwh ?? "—"} kWh`} />
            <KpiCell label="STREET EFF." value={`${((t.streetEfficiencyKwhPerMi as Record<string, number>)?.typical) ?? "—"} kWh/mi`} />
          </SkeuomorphicCard>
        ))}
      </div>
    </FramedPanel>
  );
}
