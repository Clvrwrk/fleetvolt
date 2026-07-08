"use client";

import { usePathname } from "next/navigation";
import { useUserRole, type FleetVoltRole } from "@/lib/auth";

// ── Phase 16 / Wave 3: useRoleNav ──────────────────────────────────────────
//
// Returns nav items filtered by the current user's role.
// Uses useUserRole() from src/lib/auth.ts to get the current role.
// Uses usePathname() to determine the active item.
//
// Nav items per role (from task spec):
//   Driver:         Dashboard, My Routes, Charging, Vehicle, System Status
//   Fleet Manager:  Dashboard, Routes, Vehicles, Load Config, Drivers, System Status
//   CaaS:           Dashboard, Charger Network, AI Planner, System Status
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
  { label: "My Routes", href: "/planner", icon: "Route" },
  { label: "Charging", href: "/planner", icon: "Zap" },
  { label: "Vehicle", href: "/unit", icon: "Truck" },
  { label: "System Status", href: "/status", icon: "Activity" },
];

const FLEET_MANAGER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/fleet", icon: "LayoutDashboard" },
  { label: "Routes", href: "/planner", icon: "Route" },
  { label: "Vehicles", href: "/unit", icon: "Truck" },
  { label: "Load Config", href: "/load", icon: "Package" },
  { label: "Drivers", href: "/driver", icon: "Users" },
  { label: "System Status", href: "/status", icon: "Activity" },
];

const CAAS_NAV: NavItem[] = [
  { label: "Dashboard", href: "/caas", icon: "LayoutDashboard" },
  { label: "Charger Network", href: "/hotspot", icon: "Map" },
  { label: "AI Planner", href: "/planner", icon: "Sparkles" },
  { label: "System Status", href: "/status", icon: "Activity" },
];

const NAV_BY_ROLE: Record<FleetVoltRole, NavItem[]> = {
  driver: DRIVER_NAV,
  fleet_manager: FLEET_MANAGER_NAV,
  caas: CAAS_NAV,
};

/**
 * useRoleNav — returns role-filtered nav items + active href detection.
 *
 * @returns { items: NavItem[], role: string | null, loading: boolean, activeHref: string | null }
 */
export function useRoleNav() {
  const { role, loading } = useUserRole();
  const pathname = usePathname();

  const items = role ? NAV_BY_ROLE[role] : [];

  // Active item detection: exact match or prefix match
  const activeHref =
    items.find((item) => {
      if (pathname === item.href) return true;
      if (pathname.startsWith(item.href + "/")) return true;
      return false;
    })?.href ?? null;

  return { items, role, loading, activeHref };
}
