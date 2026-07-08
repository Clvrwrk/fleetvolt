"use client";

// ── Phase 16 / Wave 4 / Task 4.1: Driver Dashboard ──────────────────────────
//
// Replaces the 6-step registration wizard with a mobile-first dashboard.
// Driver is the mobile-first persona: single column on mobile, 2-col on desktop.
//
// Content:
//   1. Today's Route card — assigned route info or empty state
//   2. Vehicle Status card — assigned truck or empty state
//   3. Charging card — nearest Class-8 chargers or empty state
//   4. Quick Actions — "Start Navigation" (primary), "Find Chargers" (secondary)
//
// The 6-step registration wizard moved to /driver/setup.
//
// UX checks: HOME-2 (role-specific home), VIS-1 (one primary CTA), EMPTY-1
// UX principles: Fitts's Law (full-width primary CTA on mobile), mobile-first layout

import Link from "next/link";
import { useWorkOSAuth } from "@/lib/auth";
import { FramedPanel } from "@/components/design/framed-panel";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { KpiCell } from "@/components/design/kpi-cell";
import { PrimaryButton } from "@/components/design/primary-button";
import { SecondaryButton } from "@/components/design/secondary-button";
import { StatusBadge } from "@/components/design/status-badge";
import { TechnicalLabel } from "@/components/design/technical-label";
import { Route, Zap, Truck, Navigation } from "lucide-react";

export default function DriverDashboardPage() {
  const { displayName, loading } = useWorkOSAuth();

  const greeting = displayName ? `Welcome, ${displayName}` : "Driver Dashboard";

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <FramedPanel maxWidthClass="max-w-[800px]">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 rounded bg-[var(--fv-surface-muted)]" />
          <div className="h-32 rounded-lg bg-[var(--fv-surface-muted)]" />
          <div className="h-32 rounded-lg bg-[var(--fv-surface-muted)]" />
          <div className="h-32 rounded-lg bg-[var(--fv-surface-muted)]" />
        </div>
      </FramedPanel>
    );
  }

  return (
    <FramedPanel maxWidthClass="max-w-[800px]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-black/8 pb-4">
        <div className="flex items-baseline gap-3.5">
          <span className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
            {greeting}
          </span>
          <StatusBadge variant="ok">Driver</StatusBadge>
        </div>
        <Link href="/driver/setup" className="text-xs text-[var(--fv-steel)] hover:text-[var(--fv-accent)]">
          Complete profile →
        </Link>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        <KpiCell label="ROUTE DISTANCE" value="—" unit="mi" />
        <KpiCell label="EST. ENERGY" value="—" unit="kWh" />
        <KpiCell label="BATTERY SoC" value="—" unit="%" />
      </div>

      {/* ── Cards: single column on mobile, 2-col on desktop ───────────── */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Today's Route card ────────────────────────────────────────── */}
        <SkeuomorphicCard padding="lg">
          <div className="mb-3 flex items-center gap-2">
            <Route size={16} className="text-[var(--fv-accent)]" />
            <TechnicalLabel>TODAY&apos;S ROUTE</TechnicalLabel>
          </div>
          <div className="py-4 text-center">
            <p className="text-sm font-medium text-[var(--fv-graphite)]">
              No route assigned yet
            </p>
            <p className="mt-1 text-xs text-[var(--fv-text-muted)]">
              Check with your fleet manager for today&apos;s assignment.
            </p>
          </div>
        </SkeuomorphicCard>

        {/* ── Vehicle Status card ──────────────────────────────────────── */}
        <SkeuomorphicCard padding="lg">
          <div className="mb-3 flex items-center gap-2">
            <Truck size={16} className="text-[var(--fv-accent)]" />
            <TechnicalLabel>VEHICLE STATUS</TechnicalLabel>
          </div>
          <div className="py-4 text-center">
            <p className="text-sm font-medium text-[var(--fv-graphite)]">
              No vehicle assigned
            </p>
            <p className="mt-1 text-xs text-[var(--fv-text-muted)]">
              Your assigned truck will appear here with battery and charging status.
            </p>
          </div>
        </SkeuomorphicCard>

        {/* ── Charging card (spans full width on desktop) ─────────────── */}
        <SkeuomorphicCard padding="lg" className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Zap size={16} className="text-[var(--fv-accent)]" />
            <TechnicalLabel>NEARBY CHARGING</TechnicalLabel>
          </div>
          <div className="py-4 text-center">
            <p className="text-sm font-medium text-[var(--fv-graphite)]">
              Select a route to see nearby chargers
            </p>
            <p className="mt-1 text-xs text-[var(--fv-text-muted)]">
              Class-8 capable chargers along your route will appear here.
            </p>
          </div>
        </SkeuomorphicCard>
      </div>

      {/* ── Quick Actions: primary + secondary ─────────────────────────── */}
      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <Link href="/planner" className="flex-1 no-underline">
          <PrimaryButton block className="flex items-center justify-center gap-2">
            <Navigation size={16} />
            Start Navigation
          </PrimaryButton>
        </Link>
        <Link href="/planner" className="flex-1 no-underline">
          <SecondaryButton className="w-full flex items-center justify-center gap-2">
            <Zap size={16} />
            Find Chargers
          </SecondaryButton>
        </Link>
      </div>

      <div className="fv-footer-credit mt-3.5 text-right">
        POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
      </div>
    </FramedPanel>
  );
}
