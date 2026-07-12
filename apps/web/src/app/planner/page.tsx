import Link from "next/link";
import { ArrowRight, Map } from "lucide-react";

import { PrimaryButton } from "@/components/design/primary-button";
import { SecondaryButton } from "@/components/design/secondary-button";
import { StatusBadge } from "@/components/design/status-badge";
import { TechnicalLabel } from "@/components/design/technical-label";

export default function PlannerCompatibilityPage() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[var(--fv-bg)] p-4">
      <section className="w-full min-w-0 max-w-[720px] rounded-sm border border-white/12 bg-[#121820]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur sm:p-6">
        <div className="flex min-w-0 flex-col items-start justify-between gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-sm border border-[#42a5d9]/30 bg-[#42a5d9]/10 p-3">
              <Map size={22} className="text-[var(--fv-accent)]" />
            </div>
            <div className="min-w-0">
              <TechnicalLabel>PLANNER MOVED</TechnicalLabel>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--fv-graphite)]">
                Open the map workbench
              </h1>
            </div>
          </div>
          <StatusBadge variant="warn">Compatibility</StatusBadge>
        </div>

        <p className="mt-4 text-sm leading-6 text-[var(--fv-text-muted)]">
          The centered AI planner has been replaced as the primary planning surface. Use the full-viewport workbench to plan routes, inspect layers, and turn results into map cards.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/workbench?mode=caas_gap_map" className="flex-1 no-underline">
            <PrimaryButton block className="flex items-center justify-center gap-2">
              Open Gap Map
              <ArrowRight size={16} />
            </PrimaryButton>
          </Link>
          <Link href="/driver/day-plan" className="flex-1 no-underline">
            <SecondaryButton className="flex w-full items-center justify-center gap-2">
              Driver Day Plan
            </SecondaryButton>
          </Link>
        </div>
      </section>
    </div>
  );
}
