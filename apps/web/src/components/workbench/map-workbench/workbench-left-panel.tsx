"use client";

import { MapPin, Route, SlidersHorizontal, Zap } from "lucide-react";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";

type WorkbenchLeftPanelProps = {
  className?: string;
};

const quickRoutes = [
  { id: "polb-barstow", label: "POLB → Barstow", meta: "128 mi · I-710 / I-15" },
  { id: "oakland-tracy", label: "Oakland → Tracy", meta: "63 mi · I-580" },
  { id: "fontana-la", label: "Fontana → LA Basin", meta: "54 mi · I-10" },
];

const layerToggles = ["Route", "Chargers", "Parking", "Freight flow"];

export function WorkbenchLeftPanel({ className }: WorkbenchLeftPanelProps) {
  return (
    <aside
      data-testid="workbench-left-panel"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden border-r border-black/10 bg-[var(--fv-paper)]/95 shadow-[inset_-1px_0_0_rgba(255,255,255,0.55)]",
        className,
      )}
      aria-label="Workbench tools"
    >
      <div className="border-b border-black/10 px-4 py-3">
        <TechnicalLabel>Workbench tools</TechnicalLabel>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--fv-graphite)]">
          Plan inputs
        </h2>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <section className="space-y-2" aria-labelledby="route-builder-heading">
          <div className="flex items-center gap-2" id="route-builder-heading">
            <Route size={16} className="text-[var(--fv-accent)]" />
            <TechnicalLabel>Route builder</TechnicalLabel>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[var(--fv-steel)]">
              Origin
              <button className="mt-1 flex min-h-11 w-full items-center justify-between rounded-xl border border-black/10 bg-white px-3 text-left text-sm text-[var(--fv-graphite)] shadow-sm transition hover:border-[var(--fv-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]">
                <span>Choose port, yard, or address</span>
                <MapPin size={15} />
              </button>
            </label>
            <label className="block text-xs font-semibold text-[var(--fv-steel)]">
              Destination
              <button className="mt-1 flex min-h-11 w-full items-center justify-between rounded-xl border border-black/10 bg-white px-3 text-left text-sm text-[var(--fv-graphite)] shadow-sm transition hover:border-[var(--fv-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]">
                <span>Choose delivery point</span>
                <MapPin size={15} />
              </button>
            </label>
          </div>
        </section>

        <section className="space-y-2" aria-labelledby="quick-routes-heading">
          <TechnicalLabel>Quick corridors</TechnicalLabel>
          <div className="space-y-2" id="quick-routes-heading">
            {quickRoutes.map((route) => (
              <button
                key={route.id}
                className="min-h-11 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--fv-accent)] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
              >
                <span className="block text-sm font-semibold text-[var(--fv-graphite)]">{route.label}</span>
                <span className="block text-xs text-[var(--fv-steel)]">{route.meta}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2" aria-labelledby="layers-heading">
          <div className="flex items-center gap-2" id="layers-heading">
            <SlidersHorizontal size={16} className="text-[var(--fv-accent)]" />
            <TechnicalLabel>Layer slots</TechnicalLabel>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {layerToggles.map((layer) => (
              <button
                key={layer}
                className="min-h-11 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--fv-graphite)] shadow-sm transition hover:border-[var(--fv-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
              >
                {layer}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="border-t border-black/10 p-4">
        <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--fv-accent)] px-4 text-sm font-bold text-white shadow-sm transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]">
          <Zap size={16} />
          Calculate route
        </button>
      </div>
    </aside>
  );
}
