"use client";

// ── Phase 16 / Wave 4 / Task 4.3: CaaS Dashboard ───────────────────────────
//
// Adds: welcome header + role badge, KPI row at top, PrimaryButton CTA.
// Keeps existing hotspot/county content below the KPI row.
// Registration/setup flow moves to /caas/setup.
//
// UX checks: HOME-2, VIS-1, VIS-3 (F-pattern), COG-1 (4 KPIs)
// UX principles: Miller's Law (4 KPIs), Von Restorff (one primary CTA)

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkOSAuth } from "@/lib/auth";
import { FramedPanel } from "@/components/design/framed-panel";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { TechnicalLabel } from "@/components/design/technical-label";
import { KpiCell } from "@/components/design/kpi-cell";
import { PrimaryButton } from "@/components/design/primary-button";
import { StatusBadge } from "@/components/design/status-badge";
import { ArrowRight, Zap } from "lucide-react";
import { SkeletonContent } from "@/components/design/skeleton-card";

export default function CaasPage() {
  const { displayName, loading } = useWorkOSAuth();

  const hotspots = useQuery(api.hotspots.queries.listModeledHotspots, {});
  const geoRegions = useQuery(api.geo.queries.listGeoRegions, {});

  const greeting = displayName ? `Welcome, ${displayName}` : "CaaS Dashboard";

  const counties = (geoRegions ?? []).filter((r: { level: string }) => r.level === "county");
  const corridorCounties = (counties as { fips: string; name: string; aggregateScore?: number; airDistrict?: string }[])
    .filter((c) => ["06037", "06065", "06071", "06001", "06013", "06041", "06067", "06081", "06085", "06095"].includes(c.fips));

  const topScore = hotspots ? Math.max(...hotspots.map((h: { score: number | undefined }) => h.score ?? 0)).toFixed(3) : "—";

  // Derived KPIs
  const totalChargersModeled = hotspots?.length ?? 0;
  const class8GapSites = hotspots ? hotspots.filter((h: { score: number | undefined }) => (h.score ?? 0) > 0.7).length : 0;
  const activeDeploymentZones = 0; // No CaaS company created yet
  const avgCorridorScore = corridorCounties.length > 0
    ? (corridorCounties.reduce((sum, c) => sum + (c.aggregateScore ?? 0), 0) / corridorCounties.length).toFixed(3)
    : "—";

  // ── Loading state — skeleton screens (Task 6.1) ──────────────────────
  if (loading) {
    return (
      <FramedPanel maxWidthClass="max-w-[1100px]">
        <SkeletonContent kpiCount={4} cardLines={6} />
      </FramedPanel>
    );
  }

  return (
    <FramedPanel maxWidthClass="max-w-[1100px]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-black/8 pb-4">
        <div className="flex items-baseline gap-3.5">
          <span className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
            {greeting}
          </span>
          <StatusBadge variant="warn">CaaS</StatusBadge>
        </div>
        <Link href="/caas/setup" className="text-xs text-[var(--fv-steel)] hover:text-[var(--fv-accent)]">
          CaaS settings →
        </Link>
      </div>

      {/* ── KPI Row (4 cells — Miller's Law) ─────────────────────────────── */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <KpiCell label="TOTAL CHARGERS MODELED" value={totalChargersModeled} />
        <KpiCell label="CLASS-8 GAP SITES" value={class8GapSites} />
        <KpiCell label="ACTIVE DEPLOYMENT ZONES" value={activeDeploymentZones} />
        <KpiCell label="AVG CORRIDOR SCORE" value={avgCorridorScore} />
      </div>

      {/* ── Two-column data panels (existing content preserved) ──────────── */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hotspots */}
        <SkeuomorphicCard padding="lg">
          <TechnicalLabel className="mb-3 block">MODELED DWELL HOTSPOTS</TechnicalLabel>
          <div className="space-y-2">
            {(hotspots ?? []).slice(0, 8).map((h: { _id: string; title: string; score: number | undefined; location?: { lat: number; lng: number } }) => (
              <div
                key={h._id}
                className="flex items-center justify-between rounded-lg border border-black/5 bg-[var(--fv-surface)] p-2.5"
              >
                <div>
                  <div className="text-sm text-[var(--fv-graphite)]">{h.title}</div>
                  {h.location && (
                    <div className="font-mono text-[10px] text-[var(--fv-steel)]">
                      {h.location.lat.toFixed(3)}, {h.location.lng.toFixed(3)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--fv-surface-muted)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(h.score ?? 0) * 100}%`,
                        background: "linear-gradient(90deg, var(--fv-caution-amber), var(--fv-alert-red))",
                      }}
                    />
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-[var(--fv-slate)]">
                    {(h.score ?? 0).toFixed(3)}
                  </span>
                </div>
              </div>
            ))}
            {hotspots?.length === 0 && (
              <div className="py-4 text-center font-mono text-[10px] text-[var(--fv-steel)]">
                No hotspots modeled yet.
              </div>
            )}
          </div>
        </SkeuomorphicCard>

        {/* County scores */}
        <SkeuomorphicCard padding="lg">
          <TechnicalLabel className="mb-3 block">COUNTY AGGREGATE SCORES</TechnicalLabel>
          <div className="space-y-2">
            {corridorCounties.map((c) => (
              <div
                key={c.fips}
                className="flex items-center justify-between rounded-lg border border-black/5 bg-[var(--fv-surface)] p-2.5"
              >
                <div>
                  <div className="text-sm text-[var(--fv-graphite)]">{c.name}</div>
                  {c.airDistrict && (
                    <div className="font-mono text-[10px] text-[var(--fv-steel)]">{c.airDistrict}</div>
                  )}
                </div>
                <span className="font-mono text-[11px] font-semibold text-[var(--fv-slate)]">
                  {c.aggregateScore?.toFixed(3) ?? "—"}
                </span>
              </div>
            ))}
            {corridorCounties.length === 0 && (
              <div className="py-4 text-center font-mono text-[10px] text-[var(--fv-steel)]">
                No county data loaded.
              </div>
            )}
          </div>
        </SkeuomorphicCard>
      </div>

      {/* ── Primary CTA: launch gap map workbench (Von Restorff) ─────────── */}
      <SkeuomorphicCard padding="lg" className="mt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-[var(--fv-graphite)]">
              Analyze charger gaps on the map
            </div>
            <p className="mt-1 text-sm text-[var(--fv-text-muted)]">
              Open a full-viewport gap map for route-based Class-8 gaps, target carriers,
              parking context, and mobile charger positioning.
            </p>
          </div>
          <Link href="/caas/gap-map" className="no-underline inline-block">
            <PrimaryButton className="flex items-center gap-2">
              <Zap size={16} />
              Find Charger Gaps
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
