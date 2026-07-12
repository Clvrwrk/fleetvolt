"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { Sidebar } from "./sidebar";
import { PageHeader } from "./page-header";
import { MobileTabBar } from "./mobile-tab-bar";

// ── Phase 16 / Wave 3: AppShell integrated with Sidebar, PageHeader, MobileTabBar ─
//
// The new app chrome for ALL authenticated pages. Replaces the old NavHeader.
//
// Layout (dashboards / non-workbench):
//   ┌──────────────────────────────────────────────────────┐
//   │ ┌────┐  Top Bar (56px)                                │
//   │ │ S  │  ┌─────────────────────────────────────────┐   │
//   │ │ i  │  │ PageHeader (title+breadcrumb) │ UserMenu│   │
//   │ │ d  │  └─────────────────────────────────────────┘   │
//   │ │ e  │  ┌─────────────────────────────────────────┐   │
//   │ │ b  │  │           Content Area (children)       │   │
//   │ │ a  │  │                                         │   │
//   │ │ r  │  │                                         │   │
//   │ │260px│ └─────────────────────────────────────────┘   │
//   │ └────┘                                                │
//   └──────────────────────────────────────────────────────┘
//
// Map workbench routes (Phase 17 — see TOOL-RAIL.md):
//   Global Sidebar is HIDDEN. Left chrome is the workbench tool rail
//   (role nav above, accordion tools below) inside MapWorkbenchShell.
//
// Sidebar: 260px expanded, 56px collapsed (Wave 3). PageHeader in top bar.
// MobileTabBar: bottom-fixed on <768px screens (hidden on map-first routes).
//
// Public routes (/, /role-select, /callback) bypass the AppShell entirely
// and render children without the sidebar/top bar.

const PUBLIC_ROUTES = new Set(["/", "/briefing", "/role-select", "/callback", "/design-system"]);

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  // /callback may have query params but pathname won't include them
  if (pathname.startsWith("/callback")) return true;
  return false;
}

/** Map pathname to a human-readable page title for the top bar. */
function getPageTitle(pathname: string): string {
  const map: Record<string, string> = {
    "/workbench": "Map Workbench",
    "/planner": "Route Planner",
    "/driver": "Driver Dashboard",
    "/fleet": "Fleet",
    "/caas": "CaaS Dashboard",
    "/hotspot": "Hotspot Analysis",
    "/pulse": "Network Pulse",
    "/unit": "Truck Unit",
    "/load": "Load Management",
    "/status": "System Status",
    "/catalog": "Vehicle Catalog",
    "/design-system": "Enterprise Design System",
  };
  // Exact match first
  if (map[pathname]) return map[pathname];
  // Try prefix match (e.g., /driver/routes → "Driver Dashboard")
  for (const [prefix, title] of Object.entries(map)) {
    if (pathname.startsWith(prefix + "/") || pathname === prefix) return title;
  }
  return "FleetVolt";
}

function TopBar({ pageTitle }: { pageTitle: string }) {
  return (
    <header className="fv-command-topbar sticky top-0 z-30 flex h-14 items-center gap-3 px-4">
      <PageHeader title={pageTitle} />
      {/* Right: UserMenu */}
      <div className="flex shrink-0 items-center gap-3">
        <UserMenu />
      </div>
    </header>
  );
}

function isMapWorkbenchRoute(pathname: string): boolean {
  if (pathname === "/workbench" || pathname.startsWith("/workbench/")) return true;
  if (pathname === "/driver/day-plan" || pathname.startsWith("/driver/day-plan/")) return true;
  if (pathname === "/fleet/contract-plan" || pathname.startsWith("/fleet/contract-plan/")) return true;
  if (pathname === "/caas/gap-map" || pathname.startsWith("/caas/gap-map/")) return true;
  // /caas is map-first. Its optional summary view retains this compact chrome
  // so the global layout does not depend on search params during hydration.
  if (pathname === "/caas") return true;
  return false;
}

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Public routes render without the shell
  if (isPublicRoute(pathname)) {
    return (
      <>
        <a className="fv-skip-link" href="#main-content">
          Skip to main content
        </a>
        {children}
      </>
    );
  }

  const pageTitle = getPageTitle(pathname);
  // Map workbench owns its own stacked left tool rail — hide global Sidebar.
  const mapFirst = isMapWorkbenchRoute(pathname);

  return (
    <div className={mapFirst ? "min-h-screen bg-[var(--fv-bg)]" : "fv-enterprise-shell min-h-screen"}>
      <a className="fv-skip-link" href="#main-content">
        Skip to main content
      </a>
      {!mapFirst ? <Sidebar /> : null}
      <div className={mapFirst ? "pl-0" : "fv-shell-content pl-0 md:pl-[260px]"}>
        <TopBar pageTitle={pageTitle} />
        {mapFirst ? (
          <div className="fv-app-main fv-app-main--map min-h-[calc(100dvh-3.5rem)] min-w-0 w-full max-w-none p-0">
            {children}
          </div>
        ) : (
          <main
            id="main-content"
            tabIndex={-1}
            className="fv-app-main min-h-[calc(100dvh-3.5rem)] min-w-0 w-full max-w-none p-0 pb-14 md:pb-0"
          >
            {children}
          </main>
        )}
      </div>
      {!mapFirst ? <MobileTabBar /> : null}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return <AppShellInner>{children}</AppShellInner>;
}
