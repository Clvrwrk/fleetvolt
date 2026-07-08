"use client";

import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Info, Route, XCircle } from "lucide-react";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import type { WorkbenchResultCard } from "./types";

type WorkbenchRightPanelProps = {
  className?: string;
};

const initialCards: WorkbenchResultCard[] = [
  {
    id: "driver-awaiting-route",
    title: "Feasibility",
    summary: "Choose origin/destination, round trips, truck profile, payload, weather, and workday constraints, then calculate the day plan.",
    mode: "driver_day_plan",
    severity: "info",
    layerId: "route",
  },
  {
    id: "driver-awaiting-chargers",
    title: "Charge stops",
    summary: "Charge stop cards will use physics simulation results first, then nearest Class 8 chargers and five closest chargers as grounded fallbacks.",
    mode: "driver_day_plan",
    severity: "info",
    layerId: "chargers",
  },
  {
    id: "driver-awaiting-access",
    title: "Site access guidance",
    summary: "Parking and POI guidance is fetched near simulated stops when available; driveway/trailer sweep details stay labeled unavailable unless sourced.",
    mode: "driver_day_plan",
    severity: "info",
    layerId: "parking",
  },
];

function severityStyles(severity: WorkbenchResultCard["severity"]): string {
  switch (severity) {
    case "success":
      return "border-emerald-300/70 bg-emerald-50 text-emerald-950";
    case "warning":
      return "border-amber-300/70 bg-amber-50 text-amber-950";
    case "critical":
      return "border-red-300/70 bg-red-50 text-red-950";
    default:
      return "border-black/10 bg-white text-[var(--fv-graphite)]";
  }
}

function SeverityIcon({ severity }: { severity: WorkbenchResultCard["severity"] }) {
  if (severity === "success") return <CheckCircle2 size={16} className="text-emerald-700" />;
  if (severity === "warning") return <AlertTriangle size={16} className="text-amber-700" />;
  if (severity === "critical") return <XCircle size={16} className="text-red-700" />;
  return <Info size={16} className="text-[var(--fv-accent)]" />;
}

function ResultMetricList({ metrics }: { metrics?: WorkbenchResultCard["metrics"] }) {
  if (!metrics) return null;
  const entries = Object.entries(metrics).slice(0, 6);
  if (entries.length === 0) return null;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-xl border border-black/10 bg-white/65 p-2">
          <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--fv-steel)]">
            {key.replace(/([A-Z])/g, " $1")}
          </dt>
          <dd className="mt-1 text-xs font-bold text-[var(--fv-graphite)]">{value ?? "unavailable"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function WorkbenchRightPanel({ className }: WorkbenchRightPanelProps) {
  const resultCards = useMapWorkbenchStore((state) => state.resultCards);
  const providerWarnings = useMapWorkbenchStore((state) => state.providerWarnings);
  const routeGeometry = useMapWorkbenchStore((state) => state.routeGeometry);
  const cards = resultCards.length > 0 ? resultCards : initialCards;

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
        <TechnicalLabel>Driver result cards</TechnicalLabel>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--fv-graphite)]">
          Day-plan summary
        </h2>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {cards.map((card) => (
          <article
            key={card.id}
            className={cn("rounded-2xl border p-3 shadow-sm", severityStyles(card.severity))}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/75">
                  <SeverityIcon severity={card.severity} />
                </span>
                <div>
                  <TechnicalLabel>{card.layerId ?? "result"}</TechnicalLabel>
                  <div className="text-sm font-bold text-[var(--fv-graphite)]">{card.title}</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-[var(--fv-steel)]" />
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--fv-steel)]">{card.summary}</p>
            <ResultMetricList metrics={card.metrics} />
            {card.actions?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {card.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className="min-h-9 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-[var(--fv-graphite)] shadow-sm"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        ))}

        <article className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <Route size={17} className="mt-0.5 shrink-0 text-[var(--fv-accent)]" />
            <div>
              <TechnicalLabel>Route provider</TechnicalLabel>
              <p className="mt-1 text-xs leading-5 text-[var(--fv-steel)]">
                {routeGeometry
                  ? `${routeGeometry.provider.toUpperCase()} geometry · ${routeGeometry.coordinates.length} points · ${routeGeometry.distanceMeters ? `${Math.round(routeGeometry.distanceMeters / 1609.344)} mi` : "distance unavailable"}`
                  : "Awaiting route geometry from the driver day-plan run."}
              </p>
            </div>
          </div>
        </article>

        {(providerWarnings.length > 0 ? providerWarnings : ["Google route estimates are advisory until Class-8 truck routing provider validation is connected."]).map((warning) => (
          <article key={warning} className="rounded-2xl border border-amber-300/70 bg-amber-50 p-3 text-amber-950 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <div>
                <TechnicalLabel className="text-amber-800">Provider warning</TechnicalLabel>
                <p className="mt-1 text-xs leading-5">{warning}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="border-t border-black/10 p-4">
        <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-bold text-[var(--fv-graphite)] shadow-sm transition hover:border-[var(--fv-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]">
          <Clock size={16} />
          Export day-plan card
        </button>
      </div>
    </aside>
  );
}
