"use client";

// ── Phase 16 / Wave 4 / Task 4.3: CaaS Setup Page ───────────────────────────
//
// Placeholder setup page for CaaS companies. Currently the CaaS dashboard
// shows hotspot data without requiring a company. This page exists for
// future company/deployment zone registration flows.
//
// For now it's a simple placeholder that links back to the dashboard.

import Link from "next/link";
import { FramedPanel } from "@/components/design/framed-panel";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { PrimaryButton } from "@/components/design/primary-button";
import { TechnicalLabel } from "@/components/design/technical-label";
import { StatusBadge } from "@/components/design/status-badge";
import { Building2 } from "lucide-react";

export default function CaasSetupPage() {
  return (
    <FramedPanel maxWidthClass="max-w-[640px]">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-black/8 pb-4">
        <div className="flex items-baseline gap-3.5">
          <span className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
            CaaS Setup
          </span>
          <TechnicalLabel>CHARGING-AS-A-SERVICE PROFILE</TechnicalLabel>
        </div>
        <StatusBadge variant="neutral">Not Configured</StatusBadge>
      </div>

      <SkeuomorphicCard padding="lg" className="mt-6">
        <div className="py-8 text-center">
          <Building2 size={48} className="mx-auto text-[var(--fv-steel)]" />
          <p className="mt-4 text-base font-medium text-[var(--fv-graphite)]">
            Set Up CaaS Profile
          </p>
          <p className="mt-1 text-sm text-[var(--fv-text-muted)]">
            Configure your Charging-as-a-Service company to manage deployment zones,
            track charger gaps, and plan infrastructure investments.
          </p>
          <p className="mt-3 text-xs text-[var(--fv-text-muted)]">
            The CaaS dashboard is already functional with live hotspot data.
            Company registration will be available here in a future update.
          </p>
          <Link href="/caas" className="no-underline inline-block mt-4">
            <PrimaryButton>
              Back to Dashboard
            </PrimaryButton>
          </Link>
        </div>
      </SkeuomorphicCard>

      <div className="fv-footer-credit mt-3.5 text-right">
        POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
      </div>
    </FramedPanel>
  );
}
