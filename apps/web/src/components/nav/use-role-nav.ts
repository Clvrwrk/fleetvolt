"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useUserRole, type FleetVoltRole } from "@/lib/auth";

// ── Phase 16 / Wave 3: useRoleNav ──────────────────────────────────────────
//
// Returns nav items filtered by the current user's role.
// Uses useUserRole() from src/lib/auth.ts to get the current role.
// Uses usePathname() to determine the active item.
//
// Nav items per role (from task spec):
//   Driver:         Dashboard, Day Plan, Vehicle, System Status
//   Fleet Manager:  Dashboard, Contract Plan, Vehicles, Load Config, Drivers, System Status
//   CaaS:           Dashboard, Gap Map, System Status
//   No role:        [] (empty — no nav)
//
// Each item: { label, href, icon }
// icon is a string matching a lucide-react icon name (mapped in the Sidebar).
//
// UX principles:
//   Hick's Law — fewer choices per role = faster decisions
//   Miller's Law — ≤7 items per role
//   Research §1.2 — "Never show nav items that a user's role doesn't permit"

export type NavItem = {
  label: string;
  href: string;
  icon: string;
};

const DRIVER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/driver", icon: "LayoutDashboard" },
  { label: "Day Plan", href: "/driver/day-plan", icon: "Route" },
  { label: "Vehicle", href: "/unit", icon: "Truck" },
  { label: "Catalog", href: "/catalog", icon: "BookOpen" },
  { label: "System Status", href: "/status", icon: "Activity" },
];

export const FLEET_MANAGER_NAV: NavItem[] = [
  { label: "My Fleets", href: "/fleet#fleets", icon: "LayoutDashboard" },
  { label: "My Drivers", href: "/fleet#drivers", icon: "Users" },
  { label: "My Routes", href: "/fleet#routes", icon: "Route" },
  { label: "My Parking", href: "/fleet#parking", icon: "MapPin" },
  { label: "Due for Maint", href: "/fleet#maintenance", icon: "Wrench" },
  { label: "CaaS Contracts", href: "/fleet/contract-plan", icon: "FileText" },
  { label: "Catalog", href: "/catalog", icon: "BookOpen" },
];

const CAAS_NAV: NavItem[] = [
  { label: "Freight Map", href: "/caas", icon: "Map" },
  { label: "Fleet Catalog", href: "/catalog", icon: "BookOpen" },
  { label: "Summary KPIs", href: "/caas?view=summary", icon: "LayoutDashboard" },
  { label: "System Status", href: "/status", icon: "Activity" },
];

const NAV_BY_ROLE: Record<FleetVoltRole, NavItem[]> = {
  driver: DRIVER_NAV,
  fleet_manager: FLEET_MANAGER_NAV,
  caas: CAAS_NAV,
};

function isFleetRoute(pathname: string): boolean {
  return pathname === "/fleet" || pathname.startsWith("/fleet/");
}

function isCaasRoute(pathname: string): boolean {
  return pathname === "/caas" || pathname.startsWith("/caas/");
}

/**
 * useRoleNav — returns role-filtered nav items + active href detection.
 *
 * On /fleet* and /caas* routes, falls back to role nav when role is still null
 * so the sidebar is never empty for those dashboards.
 *
 * @returns { items: NavItem[], role: string | null, loading: boolean, activeHref: string | null }
 */
export function useRoleNav() {
  const { role, loading } = useUserRole();
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const sync = () => setHash(window.location.hash.replace(/^#/, ""));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  let items: NavItem[] = role ? NAV_BY_ROLE[role] : [];
  // Role dashboards must show menus even when role is unset in local/dev.
  if (items.length === 0 && isFleetRoute(pathname)) {
    items = FLEET_MANAGER_NAV;
  } else if (items.length === 0 && isCaasRoute(pathname)) {
    items = CAAS_NAV;
  }

  // Active item detection: hash targets on /fleet, else exact/prefix match.
  let activeHref: string | null = null;
  for (const item of items) {
    const [path, itemHash] = item.href.split("#");
    if (itemHash) {
      if (
        pathname === path &&
        (hash === itemHash || (!hash && itemHash === "fleets"))
      ) {
        activeHref = item.href;
        break;
      }
      continue;
    }
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      activeHref = item.href;
      break;
    }
  }

  return { items, role, loading, activeHref };
}
