import Link from "next/link";
import { ArrowRight, Map } from "lucide-react";

import { PrimaryButton } from "@/components/design/primary-button";
import { SecondaryButton } from "@/components/design/secondary-button";
import { StatusBadge } from "@/components/design/status-badge";
import { TechnicalLabel } from "@/components/design/technical-label";

export default function PlannerCompatibilityPage() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[var(--fv-paper)] p-4">
      <section className="w-full max-w-[720px] rounded-3xl border border-black/10 bg-white/70 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.12)] backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-black/10 bg-[var(--fv-surface)] p-3">
              <Map size={22} className="text-[var(--fv-accent)]" />
            </div>
            <div>
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
