"use client";

/**
 * CaaS landing — map-first workbench (freight overview → gated gap analysis).
 * KPI summary remains available via ?view=summary.
 */
import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkOSAuth } from "@/lib/auth";
import { MapWorkbenchShell } from "@/components/workbench/map-workbench/map-workbench-shell";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { TechnicalLabel } from "@/components/design/technical-label";
import { KpiCell } from "@/components/design/kpi-cell";
import { PrimaryButton } from "@/components/design/primary-button";
import { StatusBadge } from "@/components/design/status-badge";
import { SkeletonContent } from "@/components/design/skeleton-card";
import { ArrowLeft, Map, Zap } from "lucide-react";

function CaasSummaryView() {
  const { displayName, loading } = useWorkOSAuth();
  const hotspots = useQuery(api.hotspots.queries.listModeledHotspots, {});
  const geoRegions = useQuery(api.geo.queries.listGeoRegions, {});

  const greeting = displayName ? `Welcome, ${displayName}` : "CaaS Dashboard";
  const counties = (geoRegions ?? []).filter(
    (r: { level: string }) => r.level === "county",
  );
  const corridorCounties = (
    counties as {
      fips: string;
      name: string;
      aggregateScore?: number;
      airDistrict?: string;
    }[]
  ).filter((c) =>
    [
      "06037",
      "06065",
      "06071",
      "06001",
      "06013",
      "06041",
      "06067",
      "06081",
      "06085",
      "06095",
    ].includes(c.fips),
  );

  const totalChargersModeled = hotspots?.length ?? 0;
  const class8GapSites = hotspots
    ? hotspots.filter((h: { score: number | undefined }) => (h.score ?? 0) > 0.7)
        .length
    : 0;
  const avgCorridorScore =
    corridorCounties.length > 0
      ? (
          corridorCounties.reduce(
            (sum, c) => sum + (c.aggregateScore ?? 0),
            0,
          ) / corridorCounties.length
        ).toFixed(3)
      : "—";

  if (loading) {
    return (
      <div className="min-h-[calc(100dvh-3.5rem)] w-full max-w-none bg-[var(--fv-bg)] px-5 py-5 md:px-8">
        <SkeletonContent kpiCount={4} cardLines={6} />
      </div>
    );
  }

  return (
    <div
      data-testid="caas-summary"
      className="min-h-[calc(100dvh-3.5rem)] w-full max-w-none bg-[var(--fv-bg)]"
    >
      <div className="border-b border-black/8 bg-[var(--fv-paper)] px-5 py-5 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3.5">
            <h1 className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
              {greeting}
            </h1>
            <StatusBadge variant="warn">CaaS</StatusBadge>
          </div>
          <Link
            href="/caas"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--fv-steel)] hover:text-[var(--fv-accent)]"
          >
            <Map size={14} />
            Open freight map
          </Link>
        </div>
      </div>

      <div className="px-5 py-5 md:px-8">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <KpiCell label="TOTAL CHARGERS MODELED" value={totalChargersModeled} />
          <KpiCell label="CLASS-8 GAP SITES" value={class8GapSites} />
          <KpiCell label="ACTIVE DEPLOYMENT ZONES" value={0} />
          <KpiCell label="AVG CORRIDOR SCORE" value={avgCorridorScore} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeuomorphicCard padding="lg">
            <TechnicalLabel className="mb-3 block">
              MODELED DWELL HOTSPOTS
            </TechnicalLabel>
            <div className="space-y-2">
              {(hotspots ?? [])
                .slice(0, 8)
                .map(
                  (h: {
                    _id: string;
                    title: string;
                    score: number | undefined;
                    location?: { lat: number; lng: number };
                  }) => (
                    <div
                      key={h._id}
                      className="flex items-center justify-between rounded-lg border border-black/5 bg-[var(--fv-surface)] p-2.5"
                    >
                      <div>
                        <div className="text-sm text-[var(--fv-graphite)]">
                          {h.title}
                        </div>
                        {h.location ? (
                          <div className="font-mono text-[10px] text-[var(--fv-steel)]">
                            {h.location.lat.toFixed(3)},{" "}
                            {h.location.lng.toFixed(3)}
                          </div>
                        ) : null}
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-[var(--fv-slate)]">
                        {(h.score ?? 0).toFixed(3)}
                      </span>
                    </div>
                  ),
                )}
            </div>
          </SkeuomorphicCard>

          <SkeuomorphicCard padding="lg">
            <TechnicalLabel className="mb-3 block">
              COUNTY AGGREGATE SCORES
            </TechnicalLabel>
            <div className="space-y-2">
              {corridorCounties.map((c) => (
                <div
                  key={c.fips}
                  className="flex items-center justify-between rounded-lg border border-black/5 bg-[var(--fv-surface)] p-2.5"
                >
                  <div>
                    <div className="text-sm text-[var(--fv-graphite)]">
                      {c.name}
                    </div>
                    {c.airDistrict ? (
                      <div className="font-mono text-[10px] text-[var(--fv-steel)]">
                        {c.airDistrict}
                      </div>
                    ) : null}
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-[var(--fv-slate)]">
                    {c.aggregateScore?.toFixed(3) ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </SkeuomorphicCard>
        </div>

        <SkeuomorphicCard padding="lg" className="mt-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-[var(--fv-graphite)]">
                Find charger gaps on the map
              </div>
              <p className="mt-1 max-w-xl text-sm text-[var(--fv-text-muted)]">
                Opens the west-coast freight map. Gap analysis unlocks after you
                set truck, point A, point B, and driver profile.
              </p>
            </div>
            <Link href="/caas" className="no-underline">
              <PrimaryButton className="flex items-center gap-2">
                <Zap size={16} />
                Open map
              </PrimaryButton>
            </Link>
          </div>
        </SkeuomorphicCard>

        <div className="mt-4">
          <Link
            href="/caas/setup"
            className="inline-flex items-center gap-1 text-xs text-[var(--fv-steel)] hover:text-[var(--fv-accent)]"
          >
            <ArrowLeft size={12} />
            CaaS settings
          </Link>
        </div>
      </div>
    </div>
  );
}

function CaasPageInner() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const showSummary = view === "summary";

  const shell = useMemo(
    () =>
      showSummary ? (
        <CaasSummaryView />
      ) : (
        <MapWorkbenchShell mode="caas_gap_map" />
      ),
    [showSummary],
  );

  return shell;
}

export default function CaasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center text-sm text-[var(--fv-text-muted)]">
          Loading CaaS map…
        </div>
      }
    >
      <CaasPageInner />
    </Suspense>
  );
}
