"use client";

// What's Missing panel — surfaces the derived gaps from the hotspotReport
// whatsMissing object: mobileEnergyOpportunity, zero-coverage flags, and the
// deferredToPhase13 markers (detour cost + environmental benefit — cited as
// "requires Phase-13 physics", NEVER fabricated as numbers).
// Part of the HotspotReportPanel (P15-02).
import { FvInsetCard } from "@/components/design/fv-inset-card";

export interface WhatsMissingProps {
  whatsMissing: {
    mobileEnergyOpportunity: boolean;
    opportunityThreshold: number;
    noClass8Charging: boolean;
    noParkingCapacity: boolean;
    noCarriersInRadius: boolean;
    deferredToPhase13: {
      detourCost: string;
      environmentalBenefit: string;
    };
  };
}

function FlagRow({ label, flag }: { label: string; flag: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className="font-mono text-sm"
        style={{
          color: flag ? "var(--color-accent-danger, #e74c3c)" : "var(--color-accent-success, #2ecc71)",
        }}
      >
        {flag ? "✕" : "✓"}
      </span>
      <span className="text-[var(--color-text-primary)]">{label}</span>
    </li>
  );
}

export function WhatsMissingPanel({ whatsMissing }: WhatsMissingProps) {
  return (
    <FvInsetCard className="p-4" data-testid="whats-missing-panel">
      <h3 className="mb-3 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        What&apos;s Missing
      </h3>

      {/* mobileEnergyOpportunity — the headline signal */}
      <div
        className="mb-3 rounded-lg border-2 p-3"
        style={{
          borderColor: whatsMissing.mobileEnergyOpportunity
            ? "var(--color-accent-warning, #f39c12)"
            : "var(--color-line-subtle)",
          backgroundColor: whatsMissing.mobileEnergyOpportunity
            ? "var(--color-accent-warning-bg, rgba(243,156,18,0.08))"
            : "transparent",
        }}
      >
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {whatsMissing.mobileEnergyOpportunity
            ? "⚡ Mobile-Energy Opportunity"
            : "No mobile-energy opportunity flag"}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {whatsMissing.mobileEnergyOpportunity
            ? `High modeled demand + zero Class-8 charging (threshold ≥ ${whatsMissing.opportunityThreshold})`
            : `Score below threshold (${whatsMissing.opportunityThreshold}) or Class-8 charging exists`}
        </p>
      </div>

      {/* Zero-coverage flags */}
      <ul className="mb-3 space-y-1">
        <FlagRow label="No Class-8 charging in radius" flag={whatsMissing.noClass8Charging} />
        <FlagRow label="No parking capacity" flag={whatsMissing.noParkingCapacity} />
        <FlagRow label="No carriers in radius" flag={whatsMissing.noCarriersInRadius} />
      </ul>

      {/* Deferred markers — Phase 13 physics, NOT computed here */}
      <div className="border-t pt-2" style={{ borderColor: "var(--color-line-subtle)" }}>
        <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
          Deferred Analysis
        </p>
        <p className="text-[11px] text-[var(--color-text-secondary)]">
          Detour cost: requires Phase-13 routing/physics (not computed)
        </p>
        <p className="text-[11px] text-[var(--color-text-secondary)]">
          Environmental benefit: requires Phase-13 physics + grid-emissions (not computed)
        </p>
      </div>
    </FvInsetCard>
  );
}
