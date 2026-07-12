"use client";

import { useState } from "react";
import { ChevronUp } from "lucide-react";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";
import type { WorkbenchMode } from "./types";
import { WorkbenchLeftPanel } from "./workbench-left-panel";
import { WorkbenchRightPanel } from "./workbench-right-panel";

type MobileWorkbenchSheetProps = {
  mode: WorkbenchMode;
  className?: string;
};

type SheetStep = "tools" | "results";

const mobileSteps: Array<{ id: SheetStep; label: string }> = [
  { id: "tools", label: "Tools" },
  { id: "results", label: "Results" },
];

export function MobileWorkbenchSheet({ mode, className }: MobileWorkbenchSheetProps) {
  const [activeStep, setActiveStep] = useState<SheetStep>("tools");

  return (
    <section
      data-testid="mobile-workbench-sheet"
      className={cn(
        "fixed inset-x-0 bottom-14 z-20 rounded-t-3xl border border-black/10 bg-[var(--fv-paper)] shadow-[0_-18px_48px_rgba(22,26,32,0.22)] md:hidden",
        className,
      )}
      aria-label="Mobile workbench controls"
    >
      <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-black/20" aria-hidden="true" />
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <TechnicalLabel>Workbench</TechnicalLabel>
          <h2 className="text-base font-semibold text-[var(--fv-graphite)]">Plan on map</h2>
        </div>
        <ChevronUp size={20} className="text-[var(--fv-steel)]" />
      </div>

      <div className="grid grid-cols-2 gap-2 px-4" role="tablist" aria-label="Workbench mobile steps">
        {mobileSteps.map((step) => {
          const isActive = activeStep === step.id;
          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveStep(step.id)}
              className={cn(
                "min-h-11 rounded-xl border px-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]",
                isActive
                  ? "border-[var(--fv-accent)] bg-[var(--fv-accent)] text-white"
                  : "border-black/10 bg-white text-[var(--fv-graphite)]",
              )}
            >
              {step.label}
            </button>
          );
        })}
      </div>

      <div className="max-h-[46dvh] overflow-y-auto px-3 py-3">
        {activeStep === "tools" ? (
          <WorkbenchLeftPanel
            mode={mode}
            chrome="embedded"
            testId="mobile-workbench-left-panel"
            panelId="mobile-workbench-left-panel"
            className="h-auto min-h-0 w-full border-0 bg-transparent shadow-none"
          />
        ) : (
          <WorkbenchRightPanel
            chrome="embedded"
            testId="mobile-workbench-right-panel"
            panelId="mobile-workbench-right-panel"
            className="h-auto min-h-0 w-full border-0 bg-transparent shadow-none"
          />
        )}
      </div>
    </section>
  );
}
