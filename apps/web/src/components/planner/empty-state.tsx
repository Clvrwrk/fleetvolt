"use client";

// ── Phase 16 / Wave 5 / Task 5.1: Planner Empty State ──────────────────────
//
// Replaces the gray checkerboard with a guided empty state when no
// route/corridor is selected.
//
// Content:
//   1. Headline: "No Route Selected" (Inter 19px bold)
//   2. Context: corridor guidance (Inter 13px Slate)
//   3. Primary action: "Select Corridor" (PrimaryButton)
//   4. Faint truck SVG outline (Steel stroke, 0.5px)
//
// UX checks: EMPTY-1 (empty state with headline + context + next action)
// UX principle: Pixxen empty state pattern

import { FramedPanel } from "@/components/design/framed-panel";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { PrimaryButton } from "@/components/design/primary-button";
import { TechnicalLabel } from "@/components/design/technical-label";
import { Truck } from "lucide-react";

type PlannerEmptyStateProps = {
  /** Called when the user clicks "Select Corridor" */
  onSelectCorridor?: () => void;
};

export function PlannerEmptyState({ onSelectCorridor }: PlannerEmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <SkeuomorphicCard padding="lg" className="w-full max-w-[420px] text-center">
        {/* Faint truck SVG outline */}
        <div className="mb-4 flex justify-center">
          <svg
            width="80"
            height="48"
            viewBox="0 0 80 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            {/* Truck body outline */}
            <rect
              x="8"
              y="8"
              width="44"
              height="24"
              rx="2"
              stroke="var(--fv-steel)"
              strokeWidth="0.5"
              fill="none"
              opacity="0.4"
            />
            {/* Cab */}
            <path
              d="M52 14 L66 14 L72 20 L72 32 L52 32 Z"
              stroke="var(--fv-steel)"
              strokeWidth="0.5"
              fill="none"
              opacity="0.4"
            />
            {/* Wheels */}
            <circle cx="20" cy="36" r="4" stroke="var(--fv-steel)" strokeWidth="0.5" fill="none" opacity="0.4" />
            <circle cx="60" cy="36" r="4" stroke="var(--fv-steel)" strokeWidth="0.5" fill="none" opacity="0.4" />
            {/* Dashed route line */}
            <line
              x1="4"
              y1="44"
              x2="76"
              y2="44"
              stroke="var(--fv-steel)"
              strokeWidth="0.5"
              strokeDasharray="3 3"
              opacity="0.3"
            />
          </svg>
        </div>

        {/* Headline */}
        <h2 className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
          No Route Selected
        </h2>

        {/* Context */}
        <p className="mt-2 text-[13px] text-[var(--fv-slate)]">
          Choose a corridor to see the route visualization, charging stops, and
          energy profile.
        </p>

        {/* Primary action */}
        <div className="mt-5 flex justify-center">
          <PrimaryButton
            onClick={onSelectCorridor}
            className="flex items-center gap-2"
          >
            <Truck size={16} />
            Select Corridor
          </PrimaryButton>
        </div>

        {/* Technical label */}
        <div className="mt-4">
          <TechnicalLabel>CORRIDOR SELECTION REQUIRED</TechnicalLabel>
        </div>
      </SkeuomorphicCard>
    </div>
  );
}
