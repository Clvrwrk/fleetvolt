"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { useWorkOSAuth } from "@/lib/auth";

// ── Phase 16 / Wave 1: AppShell ───────────────────────────────────────────────
//
// The new app chrome for ALL authenticated pages. Replaces the old NavHeader.
//
// Layout:
//   ┌──────────────────────────────────────────────────────┐
//   │ ┌────┐  Top Bar (56px)                                │
//   │ │ S  │  ┌─────────────────────────────────────────┐   │
//   │ │ i  │  │ Logo  │  Page Title  │  UserMenu       │   │
//   │ │ d  │  └─────────────────────────────────────────┘   │
//   │ │ e  │  ┌─────────────────────────────────────────┐   │
//   │ │ b  │  │                                         │   │
//   │ │ a  │  │           Content Area (children)       │   │
//   │ │ r  │  │                                         │   │
//   │ │    │  │                                         │   │
//   │ │56px│  └─────────────────────────────────────────┘   │
//   │ └────┘                                                │
//   └──────────────────────────────────────────────────────┘
//
// The sidebar is a 56px placeholder rail (Wave 3 fills it with the real
// Sidebar component — nav items, collapse toggle, etc.).
//
// Public routes (/, /role-select, /callback) bypass the AppShell entirely
// and render children without the sidebar/top bar.
//
// The top bar: 56px tall, Paper background with bottom border, logo left,
// page title center-left, UserMenu right.

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

function SidebarPlaceholder() {
  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen w-14 flex-col items-center border-r border-black/10 bg-[var(--fv-graphite)] py-3"
      aria-label="Sidebar (placeholder)"
    >
      {/* Compact logo — vertical version fits the narrow rail */}
      <Link href="/" className="flex items-center justify-center">
        <Image
          src="/fleetvolt-logo-vertical-light.svg"
          alt="FleetVolt"
          width={32}
          height={32}
          priority
        />
      </Link>
      {/* The real nav items will be rendered here by Wave 3's Sidebar component */}
      <div className="mt-6 flex flex-1 flex-col items-center gap-3">
        <div
          className="h-8 w-8 rounded-md bg-white/5"
          title="Nav items coming in Wave 3"
        />
        <div
          className="h-8 w-8 rounded-md bg-white/5"
          title="Nav items coming in Wave 3"
        />
        <div
          className="h-8 w-8 rounded-md bg-white/5"
          title="Nav items coming in Wave 3"
        />
      </div>
    </aside>
  );
}

function TopBar({ pageTitle }: { pageTitle: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-black/8 bg-[var(--fv-paper)] pl-20 pr-4">
      {/* Left: logo */}
      <Link href="/" className="flex items-center gap-2 no-underline">
        <Image
          src="/fleetvolt-logo-horizontal-light.svg"
          alt="FleetVolt"
          width={100}
          height={24}
          priority
        />
      </Link>

      {/* Center-left: page title */}
      <div className="ml-4 hidden items-center gap-2 md:flex">
        <span className="h-4 w-px bg-[var(--fv-steel)]/30" />
        <span className="text-[15px] font-semibold text-[var(--fv-graphite)]">
          {pageTitle}
        </span>
      </div>

      {/* Right: UserMenu */}
      <div className="flex items-center gap-3">
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
      <SidebarPlaceholder />
      {/* Shift content right by sidebar width (56px / w-14) */}
      <div className="pl-14">
        <TopBar pageTitle={pageTitle} />
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return <AppShellInner>{children}</AppShellInner>;
}
