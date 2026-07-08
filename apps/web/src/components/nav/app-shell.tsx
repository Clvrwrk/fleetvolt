"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { useWorkOSAuth } from "@/lib/auth";
import { Sidebar } from "./sidebar";
import { PageHeader } from "./page-header";
import { MobileTabBar } from "./mobile-tab-bar";

// ── Phase 16 / Wave 3: AppShell integrated with Sidebar, PageHeader, MobileTabBar ─
//
// The new app chrome for ALL authenticated pages. Replaces the old NavHeader.
//
// Layout:
//   ┌──────────────────────────────────────────────────────┐
//   │ ┌────┐  Top Bar (56px)                                │
//   │ │ S  │  ┌─────────────────────────────────────────┐   │
//   │ │ i  │  │ PageHeader (title+breadcrumb) │ UserMenu│   │
//   │ │ d  │  └─────────────────────────────────────────┘   │
//   │ │ e  │  ┌─────────────────────────────────────────┐   │
//   │ │ b  │  │                                         │   │
//   │ │ a  │  │           Content Area (children)       │   │
//   │ │ r  │  │                                         │   │
//   │ │    │  │                                         │   │
//   │ │260px│ └─────────────────────────────────────────┘   │
//   │ └────┘                                                │
//   └──────────────────────────────────────────────────────┘
//
// Sidebar: 260px expanded, 56px collapsed (Wave 3). PageHeader in top bar.
// MobileTabBar: bottom-fixed on <768px screens.
//
// Public routes (/, /role-select, /callback) bypass the AppShell entirely
// and render children without the sidebar/top bar.

const PUBLIC_ROUTES = new Set(["/", "/role-select", "/callback"]);

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  // /callback may have query params but pathname won't include them
  if (pathname.startsWith("/callback")) return true;
  return false;
}

/** Map pathname to a human-readable page title for the top bar. */
function getPageTitle(pathname: string): string {
  const map: Record<string, string> = {
    "/planner": "Route Planner",
    "/driver": "Driver Dashboard",
    "/fleet": "Fleet Dashboard",
    "/caas": "CaaS Dashboard",
    "/hotspot": "Hotspot Analysis",
    "/pulse": "Network Pulse",
    "/unit": "Truck Unit",
    "/load": "Load Management",
    "/status": "System Status",
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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-black/8 bg-[var(--fv-paper)] px-4">
      <PageHeader title={pageTitle} />
      {/* Right: UserMenu */}
      <div className="flex shrink-0 items-center gap-3">
        <UserMenu />
      </div>
    </header>
  );
}

/** "Sign In" button shown in top bar when unauthenticated on protected routes. */
function SignInButton() {
  const { signIn } = useWorkOSAuth();
  return (
    <button
      onClick={() => signIn()}
      className="fv-btn-primary"
      style={{ padding: "6px 16px", fontSize: "13px", width: "auto" }}
    >
      Sign In
    </button>
  );
}

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, loading } = useWorkOSAuth();

  // Public routes render without the shell
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  const pageTitle = getPageTitle(pathname);

  return (
    <div className="min-h-screen bg-[var(--fv-bg)]">
      <Sidebar />
      {/* Content shifts right to accommodate sidebar width */}
      <div className="md:pl-[260px] pl-14">
        <TopBar pageTitle={pageTitle} />
        <main className="min-h-[calc(100vh-3.5rem)] pb-14 md:pb-0">{children}</main>
      </div>
      {/* Bottom tab bar for mobile */}
      <MobileTabBar />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return <AppShellInner>{children}</AppShellInner>;
}
