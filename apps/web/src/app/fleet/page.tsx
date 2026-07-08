"use client";

// ── Phase 16 / Wave 4 / Task 4.2: Fleet Manager Dashboard ──────────────────
//
// Replaces the 4-step fleet creation wizard with a desktop-first dashboard.
// Fleet Manager is desktop-first: KPI row + vehicle status table.
//
// Content:
//   1. KPI row (4 KpiCells): Total Vehicles, Active Routes, Charging Sessions, Avg Utilization
//   2. Vehicle Status table: max 5 rows, progressive disclosure ("Show all")
//   3. Fleet Overview card: empty state if no fleet → "Create Your Fleet" → /fleet/setup
//   4. Primary CTA: "Dispatch New Route" (PrimaryButton → /planner)
//
// The 4-step fleet creation wizard moved to /fleet/setup.
//
// UX checks: HOME-2, VIS-1 (one primary CTA), VIS-3 (F-pattern), COG-1, EMPTY-1
// UX principles: Miller's Law (4 KPIs), Von Restorff (one primary CTA), inverted pyramid

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkOSAuth } from "@/lib/auth";
import { FramedPanel } from "@/components/design/framed-panel";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { KpiCell } from "@/components/design/kpi-cell";
import { PrimaryButton } from "@/components/design/primary-button";
import { StatusBadge } from "@/components/design/status-badge";
import { TechnicalLabel } from "@/components/design/technical-label";
import { Truck, Users, Route, Zap, ArrowRight, Plus, TrendingUp } from "lucide-react";

const MAX_TABLE_ROWS = 5;

export default function FleetDashboardPage() {
  const { displayName, loading } = useWorkOSAuth();
  const [showAllVehicles, setShowAllVehicles] = useState(false);

  const greeting = displayName ? `Welcome, ${displayName}` : "Fleet Dashboard";

  // Query fleet data — using a placeholder fleetId for now
  // In production, this would come from the user's associated fleet
  const fleetOverview = useQuery(api.fleet.queries.getFleetOverview, {
    fleetId: "demo-fleet", // Will be replaced with real fleet association
  });

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <FramedPanel maxWidthClass="max-w-[1100px]">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 rounded bg-[var(--fv-surface-muted)]" />
          <div className="flex gap-2.5">
            <div className="h-20 flex-1 rounded-lg bg-[var(--fv-surface-muted)]" />
            <div className="h-20 flex-1 rounded-lg bg-[var(--fv-surface-muted)]" />
            <div className="h-20 flex-1 rounded-lg bg-[var(--fv-surface-muted)]" />
            <div className="h-20 flex-1 rounded-lg bg-[var(--fv-surface-muted)]" />
          </div>
          <div className="h-64 rounded-lg bg-[var(--fv-surface-muted)]" />
        </div>
      </FramedPanel>
    );
  }

  // ── Derived data ──────────────────────────────────────────────────────
  const drivers = fleetOverview?.drivers ?? [];
  const routes = fleetOverview?.routes ?? [];
  const parkingLots = fleetOverview?.parkingLots ?? [];
  const hasFleet = fleetOverview?.company != null;

  const totalVehicles = drivers.length;
  const activeRoutes = routes.length;
  const chargingSessions = 0; // No charging session tracking yet
  const avgUtilization = totalVehicles > 0
    ? Math.round((activeRoutes / totalVehicles) * 100)
    : 0;

  // Vehicle rows from drivers (each driver may have an assigned truck)
  const vehicleRows = drivers.map((d: { driverName: string; driverId: string; assignedTruckSlug?: string; status?: string }) => ({
    model: d.assignedTruckSlug ?? "Unassigned",
    soc: "—",
    status: d.status === "active" ? "ready" : "offline",
    driver: d.driverName,
    route: "—",
  }));

  const visibleVehicles = showAllVehicles
    ? vehicleRows
    : vehicleRows.slice(0, MAX_TABLE_ROWS);

  return (
    <FramedPanel maxWidthClass="max-w-[1100px]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-black/8 pb-4">
        <div className="flex items-baseline gap-3.5">
          <span className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
            {greeting}
          </span>
          <StatusBadge variant="ok">Fleet Manager</StatusBadge>
        </div>
        <Link href="/fleet/setup" className="text-xs text-[var(--fv-steel)] hover:text-[var(--fv-accent)]">
          Fleet settings →
        </Link>
      </div>

      {/* ── KPI Row (4 cells — Miller's Law) ─────────────────────────────── */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <KpiCell label="TOTAL VEHICLES" value={totalVehicles} />
        <KpiCell label="ACTIVE ROUTES" value={activeRoutes} />
        <KpiCell label="CHARGING SESSIONS" value={chargingSessions} />
        <KpiCell label="AVG UTILIZATION" value={avgUtilization} unit="%" />
      </div>

      {/* ── Empty state: no fleet created ──────────────────────────────── */}
      {!hasFleet && (
        <SkeuomorphicCard padding="lg" className="mt-5">
          <div className="py-8 text-center">
            <p className="text-base font-medium text-[var(--fv-graphite)]">
              No fleet created yet
            </p>
            <p className="mt-1 text-sm text-[var(--fv-text-muted)]">
              Set up your fleet to start managing vehicles, drivers, and routes.
            </p>
            <Link href="/fleet/setup" className="no-underline inline-block mt-4">
              <PrimaryButton className="flex items-center gap-2">
                <Plus size={16} />
                Create Your Fleet
              </PrimaryButton>
            </Link>
          </div>
        </SkeuomorphicCard>
      )}

      {/* ── Vehicle Status Table ────────────────────────────────────────── */}
      {hasFleet && (
        <SkeuomorphicCard padding="lg" className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-[var(--fv-accent)]" />
              <TechnicalLabel>VEHICLE STATUS</TechnicalLabel>
            </div>
            {totalVehicles > MAX_TABLE_ROWS && (
              <button
                onClick={() => setShowAllVehicles(!showAllVehicles)}
                className="text-xs text-[var(--fv-accent)] hover:underline"
              >
                {showAllVehicles ? "Show less" : `Show all (${totalVehicles})`}
              </button>
            )}
          </div>

          {totalVehicles === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-[var(--fv-text-muted)]">
                No vehicles in fleet yet. Add drivers with assigned trucks to populate this table.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="fv-table w-full">
                <thead>
                  <tr>
                    <th>TRUCK MODEL</th>
                    <th>BATTERY SoC</th>
                    <th>STATUS</th>
                    <th>ASSIGNED DRIVER</th>
                    <th>ASSIGNED ROUTE</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleVehicles.map((v, i) => (
                    <tr key={i}>
                      <td>{v.model}</td>
                      <td className="font-mono">{v.soc}</td>
                      <td>
                        <StatusBadge variant={v.status === "ready" ? "ok" : "neutral"}>
                          {v.status}
                        </StatusBadge>
                      </td>
                      <td>{v.driver}</td>
                      <td>{v.route}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SkeuomorphicCard>
      )}

      {/* ── Fleet Summary + Primary CTA ────────────────────────────────── */}
      {hasFleet && (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeuomorphicCard padding="lg" className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-[var(--fv-accent)]" />
              <TechnicalLabel>FLEET OVERVIEW</TechnicalLabel>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold text-[var(--fv-graphite)]">{drivers.length}</p>
                <p className="text-xs text-[var(--fv-text-muted)]">Drivers</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--fv-graphite)]">{routes.length}</p>
                <p className="text-xs text-[var(--fv-text-muted)]">Routes</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--fv-graphite)]">{parkingLots.length}</p>
                <p className="text-xs text-[var(--fv-text-muted)]">Parking Lots</p>
              </div>
            </div>
          </SkeuomorphicCard>

          <SkeuomorphicCard padding="lg">
            <div className="flex items-center gap-2 mb-3">
              <Route size={16} className="text-[var(--fv-accent)]" />
              <TechnicalLabel>DISPATCH</TechnicalLabel>
            </div>
            <p className="text-sm text-[var(--fv-text-muted)] mb-3">
              Plan a new route with AI-powered charger analysis.
            </p>
            <Link href="/planner" className="no-underline block">
              <PrimaryButton block className="flex items-center justify-center gap-2">
                <ArrowRight size={16} />
                Dispatch New Route
              </PrimaryButton>
            </Link>
          </SkeuomorphicCard>
        </div>
      )}

      <div className="fv-footer-credit mt-3.5 text-right">
        POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
      </div>
    </FramedPanel>
  );
}
