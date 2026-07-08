"use client";

// ── Phase 16 / Wave 5 / Task 5.1: Planner page with empty state ────────────
//
// When no route/corridor is selected, the center area shows a PlannerEmptyState
// instead of the gray checkerboard. The corridor selector is in the left sidebar.
//
// Task 5.3 modifications:
//   - Role selector REMOVED (handled by sidebar now)
//   - Exactly ONE PrimaryButton: "Run Simulation"
//   - Chat input de-emphasized to SecondaryButton/pill style
//   - KPIs remain in right column (3 KpiCells max — Miller's Law)
//
// UX checks: EMPTY-1, VIS-1 (one primary CTA), VIS-2 (squint test), COG-1

import { useState, useRef } from "react";
import { FramedPanel } from "@/components/design/framed-panel";
import { TechnicalLabel } from "@/components/design/technical-label";
import { StatusBadge } from "@/components/design/status-badge";
import { KpiCell } from "@/components/design/kpi-cell";
import { PrimaryButton } from "@/components/design/primary-button";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { ChatPanel } from "@/components/planner/chat-panel";
import { PlannerEmptyState } from "@/components/planner/empty-state";
import { Truck, Zap, Play } from "lucide-react";

// Corridor options for the selector
const CORRIDORS = [
  { id: "polb-barstow", label: "POLB → Barstow", origin: "POLB", dest: "Barstow", distance: "128 mi" },
  { id: "polb-modesto", label: "POLB → Modesto", origin: "POLB", dest: "Modesto", distance: "90 mi" },
  { id: "sf-modesto", label: "SF → Modesto", origin: "Port of SF", dest: "Modesto", distance: "90 mi" },
];

export default function PlannerPage() {
  const [selectedCorridor, setSelectedCorridor] = useState<string | null>(null);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const corridorSelectRef = useRef<HTMLDivElement>(null);

  const activeCorridor = CORRIDORS.find((c) => c.id === selectedCorridor);

  function handleSelectCorridor() {
    // Focus/highlight the corridor selector in the left sidebar
    corridorSelectRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    corridorSelectRef.current?.focus();
  }

  function handleRunSimulation() {
    if (!selectedCorridor) {
      handleSelectCorridor();
      return;
    }
    setSimulationRunning(true);
    // Simulation would be triggered here — for now just toggle state
    setTimeout(() => setSimulationRunning(false), 2000);
  }

  return (
    <FramedPanel maxWidthClass="max-w-[1200px]">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-black/8 pb-4">
        <div className="flex items-baseline gap-3.5">
          <span className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
            Route Planner
          </span>
          <TechnicalLabel>AI-ASSISTED CORRIDOR SIMULATION</TechnicalLabel>
        </div>
        <StatusBadge variant="ok">
          Convex Backend Connected
        </StatusBadge>
      </div>

      {/* 3-column layout: left sidebar + center chat + right info */}
      <div className="mt-5 grid grid-cols-[200px_minmax(0,1fr)_240px] gap-5">
        {/* Left rail — corridor selector + context (role selector removed in Task 5.3) */}
        <aside className="flex flex-col gap-3.5">
          <div ref={corridorSelectRef} tabIndex={-1}>
            <TechnicalLabel className="mb-2 block">CORRIDOR</TechnicalLabel>
            <div className="flex flex-col gap-1.5">
              {CORRIDORS.map((c) => {
                const active = selectedCorridor === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCorridor(c.id)}
                    className={`fv-corridor-row text-[12px] font-semibold text-left transition-colors ${
                      active ? "ring-2 ring-[var(--fv-blueprint-blue)]" : ""
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="fv-inset-card font-mono text-[11px] text-[#3a3a3e]">
            <TechnicalLabel className="mb-2.5 block">CORRIDOR CONTEXT</TechnicalLabel>
            <div className="flex justify-between border-b border-dashed border-black/10 py-1.5">
              <span className="text-[#8a8a92]">Origin</span>
              <span>{activeCorridor?.origin ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-black/10 py-1.5">
              <span className="text-[#8a8a92]">Destination</span>
              <span>{activeCorridor?.dest ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-black/10 py-1.5">
              <span className="text-[#8a8a92]">Distance</span>
              <span>{activeCorridor?.distance ?? "—"}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#8a8a92]">Unit</span>
              <span>eCascadia 438</span>
            </div>
          </div>
        </aside>

        {/* Center — chat panel or empty state */}
        <section className="flex flex-col min-h-[500px]">
          {selectedCorridor ? (
            <ChatPanel />
          ) : (
            <PlannerEmptyState onSelectCorridor={handleSelectCorridor} />
          )}
        </section>

        {/* Right rail — simulation KPIs (3 max — Miller's Law) */}
        <aside className="flex flex-col gap-3">
          <TechnicalLabel>SIMULATION PREVIEW</TechnicalLabel>
          <KpiCell
            label="NET ENERGY"
            value={selectedCorridor ? "312" : "—"}
            unit="kWh"
          />
          <KpiCell
            label="CHARGE STOPS"
            value={selectedCorridor ? "2" : "—"}
          />
          <KpiCell
            label="SAVINGS VS DIESEL"
            value={selectedCorridor ? "62" : "—"}
            unit="%"
          />
          {selectedCorridor && (
            <div className="mt-1 font-mono text-[9.5px] text-[var(--fv-signal-green)]">
              within battery envelope
            </div>
          )}
        </aside>
      </div>

      {/* Primary action bar — exactly ONE PrimaryButton (Von Restorff) */}
      <div className="mt-5 flex justify-center">
        <PrimaryButton
          onClick={handleRunSimulation}
          disabled={simulationRunning}
          block
          className="flex items-center justify-center gap-2 max-w-[300px]"
        >
          <Play size={18} />
          {simulationRunning ? "Running..." : "Run Simulation"}
        </PrimaryButton>
      </div>

      {/* Footer */}
      <div className="fv-footer-credit mt-3.5 text-right">
        POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
      </div>
    </FramedPanel>
  );
}
