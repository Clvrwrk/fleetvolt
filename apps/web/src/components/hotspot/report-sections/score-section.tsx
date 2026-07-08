"use client";

// Score section — renders score as a large number, the label "modeled"
// (NEVER "observed"), the four proxy inputs from HOTSPOT_SCORE_INPUTS, and
// components (parking/truck/faf/carrier normalized 0-1) as small bars.
// Part of the HotspotReportPanel (P15-02).
import { FvInsetCard } from "@/components/design/fv-inset-card";
import { scoreToColor } from "@/lib/hotspot-zoom";

// The four proxy input names — the honesty label carried on every score.
// Inlined here (matching convex/hotspots/score.ts HOTSPOT_SCORE_INPUTS) so
// the UI always shows them even without importing server code.
const PROXY_INPUTS = [
  "NATD_parking_capacity",
  "Caltrans_5axle_truckAADT",
  "FAF_zone061_flow",
  "POLB_carrier_concentration",
] as const;

export interface ScoreComponents {
  parking: number;
  truck: number;
  faf: number;
  carrier: number;
}

export interface ScoreSectionProps {
  score: {
    score: number;
    method: "modeled";
    inputs: string[];
    components: ScoreComponents | null | unknown;
    source: "persisted" | "inline";
    hotspotId: string | null;
    title: string | null;
  };
}

function ComponentBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-xs text-[var(--color-text-secondary)]">
        {label}
      </span>
      <div
        className="h-2 flex-1 rounded-full"
        style={{ backgroundColor: "var(--color-line-subtle)" }}
      >
        <div
          className="h-2 rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: scoreToColor(value),
          }}
        />
      </div>
      <span className="w-8 text-right text-xs text-[var(--color-text-secondary)]">
        {pct}%
      </span>
    </div>
  );
}

export function ScoreSection({ score }: ScoreSectionProps) {
  const color = scoreToColor(score.score);
  const components = score.components as ScoreComponents | null;
  return (
    <FvInsetCard className="p-4" data-testid="score-section">
      <h3 className="mb-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        Hotspot Demand Score
      </h3>
      <div className="mb-3 flex items-baseline gap-3">
        <span
          className="text-4xl font-bold"
          style={{ color }}
        >
          {score.score.toFixed(3)}
        </span>
        <span className="rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-white" style={{ backgroundColor: color }}>
          modeled
        </span>
      </div>

      <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
        Composite of four proxy inputs:
      </p>
      <ul className="mb-3 space-y-1">
        {PROXY_INPUTS.map((name) => (
          <li
            key={name}
            className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[var(--color-text-primary)]"
          >
            {name}
          </li>
        ))}
      </ul>

      {components && (
        <div className="space-y-2">
          <ComponentBar label="Parking" value={components.parking} />
          <ComponentBar label="Truck AADT" value={components.truck} />
          <ComponentBar label="FAF Flow" value={components.faf} />
          <ComponentBar label="Carriers" value={components.carrier} />
        </div>
      )}

      <p className="mt-2 text-[10px] text-[var(--color-text-secondary)]">
        Source: {score.source}
        {score.title ? ` · ${score.title}` : ""}
      </p>
    </FvInsetCard>
  );
}
