"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";
import { FleetVoltMapCanvas } from "./fleetvolt-map-canvas";
import { MobileWorkbenchSheet } from "./mobile-workbench-sheet";
import { WorkbenchLeftPanel } from "./workbench-left-panel";
import { WorkbenchRightPanel } from "./workbench-right-panel";
import { WorkbenchRailNav } from "./workbench-rail-nav";
import { WorkbenchBootstrap } from "./workbench-bootstrap";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import type { WorkbenchMode } from "./types";

type MapWorkbenchShellProps = {
  mode?: WorkbenchMode;
};

const modeLabel: Record<WorkbenchMode, string> = {
  driver_day_plan: "Driver day plan",
  fleet_contract_plan: "Fleet contract plan",
  caas_gap_map: "CaaS gap map",
};

const INPUTS_KEY = "fleetvolt_workbench_inputs_open";
const SUMMARY_KEY = "fleetvolt_workbench_summary_open";

/** Desktop tools column — matches prior panel legibility (~320px). */
const RAIL_WIDTH_CLASS = "w-80";

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

function AccordionSection({
  id,
  title,
  eyebrow,
  open,
  onToggle,
  children,
  grow,
}: {
  id: string;
  title: string;
  eyebrow: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** When true and open, section consumes remaining rail height. */
  grow?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col border-b border-white/10",
        open && grow ? "flex-1" : "shrink-0",
      )}
      data-accordion={id}
      data-open={open}
    >
      <button
        type="button"
        data-testid={`workbench-accordion-${id}`}
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full shrink-0 items-center gap-2 px-3 py-3 text-left transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--fv-blueprint-blue)]"
      >
        <span className="text-[var(--fv-blueprint-blue)]">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="min-w-0 flex-1">
          {/* Eyebrow = role/context (bold blue); title = toolbox name (bold white). */}
          <TechnicalLabel className="fv-workbench-eyebrow">
            {eyebrow}
          </TechnicalLabel>
          <span className="mt-0.5 block text-sm font-bold tracking-tight text-white">
            {title}
          </span>
        </span>
      </button>
      {open ? (
        <div className="min-h-0 flex-1 overflow-hidden border-t border-white/8 bg-[var(--fv-paper)] text-[var(--fv-graphite)]">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function MapWorkbenchShell({ mode = "driver_day_plan" }: MapWorkbenchShellProps) {
  // Spec: inputs expanded, summary collapsed on first load.
  const [inputsOpen, setInputsOpen] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    const store = useMapWorkbenchStore.getState();
    if (store.mode !== mode) store.reset(mode);
  }, [mode]);

  useEffect(() => {
    useMapWorkbenchStore.getState().hydrateLayerProfile(mode);
    const timeoutId = window.setTimeout(() => {
      setInputsOpen(readBool(INPUTS_KEY, true));
      setSummaryOpen(readBool(SUMMARY_KEY, false));
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [mode]);

  function toggleInputs() {
    setInputsOpen((prev) => {
      const next = !prev;
      writeBool(INPUTS_KEY, next);
      return next;
    });
  }

  function toggleSummary() {
    setSummaryOpen((prev) => {
      const next = !prev;
      writeBool(SUMMARY_KEY, next);
      return next;
    });
  }

  const inputsTitle =
    mode === "fleet_contract_plan"
      ? "Contract inputs"
      : mode === "caas_gap_map"
        ? "Gap / opportunity map"
        : "Day-plan inputs";
  const summaryTitle =
    mode === "fleet_contract_plan"
      ? "Contract-plan summary"
      : mode === "caas_gap_map"
        ? "Gap-map summary"
        : "Day-plan summary";

  return (
    <section
      data-testid="map-workbench-shell"
      data-workbench-mode={mode}
      data-inputs-open={mounted ? inputsOpen : true}
      data-summary-open={mounted ? summaryOpen : false}
      className="relative flex h-[calc(100dvh-3.5rem)] w-full min-h-0 min-w-0 overflow-hidden bg-[#dfe5df]"
    >
      <WorkbenchBootstrap mode={mode} />

      {/* Stacked left rail: role nav ABOVE → accordion tools BELOW (TOOL-RAIL.md) */}
      <aside
        data-testid="workbench-tool-rail"
        className={cn(
          "relative z-20 hidden h-full min-h-0 shrink-0 flex-col border-r border-white/10 bg-[var(--fv-graphite)] md:flex",
          RAIL_WIDTH_CLASS,
        )}
        aria-label="Workbench tools"
      >
        <WorkbenchRailNav />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AccordionSection
            id="inputs"
            eyebrow={
              mode === "driver_day_plan"
                ? "Driver mode"
                : mode === "fleet_contract_plan"
                  ? "Fleet mode"
                  : "CaaS mode"
            }
            title={inputsTitle}
            open={inputsOpen}
            onToggle={toggleInputs}
            grow={inputsOpen}
          >
            <WorkbenchLeftPanel
              mode={mode}
              className="h-full min-h-0 border-0 bg-transparent shadow-none"
              chrome="embedded"
            />
          </AccordionSection>

          <AccordionSection
            id="summary"
            eyebrow={
              mode === "driver_day_plan"
                ? "Driver result cards"
                : mode === "fleet_contract_plan"
                  ? "Fleet result cards"
                  : "CaaS opportunity cards"
            }
            title={summaryTitle}
            open={summaryOpen}
            onToggle={toggleSummary}
            grow={summaryOpen}
          >
            <WorkbenchRightPanel
              className="h-full min-h-0 border-0 bg-transparent shadow-none"
              chrome="embedded"
            />
          </AccordionSection>
        </div>
      </aside>

      {/* Map owns remaining viewport — must stay full-bleed (global main max-width does not apply). */}
      <main
        id="main-content"
        tabIndex={-1}
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden !max-w-none !m-0 !p-0"
        aria-label={`${modeLabel[mode]} map workbench`}
      >
        <div
          data-testid="fleetvolt-map-canvas-slot"
          className="absolute inset-0 overflow-hidden"
        >
          <FleetVoltMapCanvas mode={mode} className="h-full w-full" />
        </div>
      </main>

      <MobileWorkbenchSheet mode={mode} />
    </section>
  );
}
