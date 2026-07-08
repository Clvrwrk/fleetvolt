"use client";

import { useState } from "react";
import { BarChart3, ChevronUp, SlidersHorizontal } from "lucide-react";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";

type MobileWorkbenchSheetProps = {
  className?: string;
};

type SheetStep = "tools" | "results";

const mobileSteps: Array<{ id: SheetStep; label: string }> = [
  { id: "tools", label: "Tools" },
  { id: "results", label: "Results" },
];

export function MobileWorkbenchSheet({ className }: MobileWorkbenchSheetProps) {
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

      <div className="max-h-[34dvh] overflow-y-auto px-4 py-3">
        {activeStep === "tools" ? (
          <div className="grid grid-cols-2 gap-2">
            <button className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold text-[var(--fv-graphite)] shadow-sm">
              <SlidersHorizontal size={16} />
              Layers
            </button>
            <button className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--fv-accent)] px-3 text-sm font-bold text-white shadow-sm">
              Calculate
            </button>
            <button className="col-span-2 min-h-11 rounded-xl border border-black/10 bg-white px-3 text-left text-sm text-[var(--fv-graphite)] shadow-sm">
              POLB → Barstow quick corridor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[
              ["ETA", "2h 34m"],
              ["Energy", "312 kWh"],
              ["Stops", "2"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-black/10 bg-white p-3 text-center shadow-sm">
                <BarChart3 size={15} className="mx-auto mb-1 text-[var(--fv-accent)]" />
                <TechnicalLabel>{label}</TechnicalLabel>
                <div className="mt-1 text-sm font-bold text-[var(--fv-graphite)]">{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
