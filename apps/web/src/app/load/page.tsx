"use client";

import { FramedPanel } from "@/components/design/framed-panel";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { TechnicalLabel } from "@/components/design/technical-label";
import { KpiCell } from "@/components/design/kpi-cell";
import { Package } from "lucide-react";

export default function LoadConfiguratorPage() {
  return (
    <FramedPanel className="p-6">
      <div className="mb-6">
        <TechnicalLabel>LOAD CONFIGURATOR</TechnicalLabel>
        <h1 className="text-lg font-bold mt-1 text-[var(--fv-text)]">Drayage Payload Model</h1>
      </div>
      <SkeuomorphicCard className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package size={16} className="text-[var(--fv-accent)]" />
          <span className="text-sm font-semibold text-[var(--fv-text)]">Container Payload Configuration</span>
        </div>
        <p className="text-sm text-[var(--fv-text-muted)] mb-4">
          Configure container type, payload weight, and axle load distribution.
          The physics engine uses these parameters for energy calculations.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCell label="CONTAINER" value="40 ft Dry" />
          <KpiCell label="PAYLOAD" value="40,000 lb" />
          <KpiCell label="GCW" value="80,000 lb" />
          <KpiCell label="AXLE DIST" value="Even" />
        </div>
      </SkeuomorphicCard>
    </FramedPanel>
  );
}
