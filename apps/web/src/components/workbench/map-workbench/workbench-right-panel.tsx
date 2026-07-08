"use client";

import { AlertTriangle, ChevronRight, Clock, DollarSign, Route } from "lucide-react";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";

type WorkbenchRightPanelProps = {
  className?: string;
};

const resultCards = [
  { id: "eta", label: "ETA", value: "2h 34m", detail: "includes charger dwell", icon: Clock },
  { id: "energy", label: "Energy", value: "312 kWh", detail: "82% battery envelope", icon: Route },
  { id: "savings", label: "Diesel savings", value: "$184", detail: "per completed move", icon: DollarSign },
];

export function WorkbenchRightPanel({ className }: WorkbenchRightPanelProps) {
  return (
    <aside
      data-testid="workbench-right-panel"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden border-l border-black/10 bg-[var(--fv-paper)]/95 shadow-[inset_1px_0_0_rgba(255,255,255,0.55)]",
        className,
      )}
      aria-label="Workbench results"
    >
      <div className="border-b border-black/10 px-4 py-3">
        <TechnicalLabel>Results cards</TechnicalLabel>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--fv-graphite)]">
          Plan summary
        </h2>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {resultCards.map(({ id, label, value, detail, icon: Icon }) => (
          <article
            key={id}
            className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--fv-bg)] text-[var(--fv-accent)]">
                  <Icon size={16} />
                </span>
                <div>
                  <TechnicalLabel>{label}</TechnicalLabel>
                  <div className="text-lg font-bold text-[var(--fv-graphite)]">{value}</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-[var(--fv-steel)]" />
            </div>
            <p className="mt-2 text-xs text-[var(--fv-steel)]">{detail}</p>
          </article>
        ))}

        <article className="rounded-2xl border border-amber-300/70 bg-amber-50 p-3 text-amber-950 shadow-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <div>
              <TechnicalLabel className="text-amber-800">Provider warning</TechnicalLabel>
              <p className="mt-1 text-xs leading-5">
                Google route estimates are advisory until Class-8 truck routing provider
                validation is connected.
              </p>
            </div>
          </div>
        </article>
      </div>

      <div className="border-t border-black/10 p-4">
        <button className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-4 text-sm font-bold text-[var(--fv-graphite)] shadow-sm transition hover:border-[var(--fv-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]">
          Export plan card
        </button>
      </div>
    </aside>
  );
}
