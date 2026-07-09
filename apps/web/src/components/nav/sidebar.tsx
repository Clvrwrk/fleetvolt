"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Route,
  Zap,
  Truck,
  Activity,
  Users,
  Package,
  Map,
  Sparkles,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useRoleNav, type NavItem } from "./use-role-nav";

// ── Phase 16 / Wave 3: Sidebar ─────────────────────────────────────────────
//
// 260px wide expanded, 56px collapsed (icon-only).
// Graphite background (#141416), Paper text.
// Active item: Graphite gradient background with Paper text (Brand Bible:
//   "Selected = Graphite inversion").
// Inactive items: transparent background, Slate text, hover: translateY(-1px) lift.
// Collapse state persisted in localStorage key "fleetvolt_sidebar_collapsed".
//
// Brand Bible: "Hover: translateY(-1/-2px) lift, 0.15-0.18s ease. No color
// swaps, no glows."
//
// UX principles:
//   Jakob's Law — left sidebar is the SaaS standard
//   Fitts's Law — persistent, large targets (≥40px)
//   Research §1.1 — "240-280px wide, collapsible to ~48px"

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Route,
  Zap,
  Truck,
  Activity,
  Users,
  Package,
  Map,
  Sparkles,
  BookOpen,
};

const STORAGE_KEY = "fleetvolt_sidebar_collapsed";
const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 56;

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function NavItemLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`
        group relative flex items-center gap-3 rounded-lg transition-all
        duration-[150ms] ease-[cubic-bezier(0.4,0,0.2,1)]
        ${collapsed ? "justify-center" : "px-3"}
        ${active
          ? "bg-gradient-to-br from-white/10 to-white/5 text-[var(--fv-paper)]"
          : "text-[var(--fv-slate)] hover:-translate-y-px hover:text-[var(--fv-fog)]"
        }
        ${collapsed ? "mx-auto h-10 w-10" : "h-10 w-full"}
      `}
      style={{ minHeight: 40 }}
    >
      {/* Active accent bar on left edge */}
      {active && (
        <span
          className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full"
          style={{
            width: 3,
            background: "var(--fv-blueprint-blue)",
          }}
        />
      )}
      <Icon
        size={18}
        className={active ? "text-[var(--fv-blueprint-blue)]" : ""}
        style={{ flexShrink: 0 }}
      />
      {!collapsed && (
        <span className="text-[13px] font-medium tracking-tight whitespace-nowrap">
          {item.label}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const { items, loading, activeHref } = useRoleNav();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load persisted collapse state after mount (avoids hydration mismatch)
  useEffect(() => {
    setCollapsed(getInitialCollapsed());
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // localStorage might be unavailable — silently ignore
    }
  };

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/8"
      style={{
        width,
        background: "var(--fv-graphite)",
        transition: "width 200ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      aria-label="Primary navigation"
    >
      {/* Logo at top */}
      <div
        className="flex h-14 shrink-0 items-center border-b border-white/8"
        style={{ padding: collapsed ? "0 14px" : "0 20px" }}
      >
        <Link href="/" className="flex items-center no-underline">
          {collapsed ? (
            // Compact: icon-only logo (vertical variant fits 56px)
            <Image
              src="/fleetvolt-logo-vertical-light.svg"
              alt="FleetVolt"
              width={28}
              height={28}
              priority
            />
          ) : (
            // Expanded: horizontal light logo on dark Graphite bg
            <Image
              src="/fleetvolt-logo-horizontal-light.svg"
              alt="FleetVolt"
              width={130}
              height={28}
              priority
              style={{ filter: "brightness(0) invert(1)" }}
            />
          )}
        </Link>
      </div>

      {/* Nav items */}
      <nav
        className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden py-3"
        style={{ padding: collapsed ? "0 8px" : "0 12px" }}
      >
        {loading ? (
          // Skeleton placeholders while role loads
          <>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-10 rounded-lg bg-white/5 animate-pulse"
                style={{
                  margin: collapsed ? "0 auto" : undefined,
                  width: collapsed ? 40 : "100%",
                }}
              />
            ))}
          </>
        ) : items.length > 0 ? (
          items.map((item) => (
            <NavItemLink
              key={item.href}
              item={item}
              active={activeHref === item.href}
              collapsed={collapsed}
            />
          ))
        ) : null}
      </nav>

      {/* Collapse toggle at bottom */}
      <div
        className="shrink-0 border-t border-white/8"
        style={{ padding: collapsed ? "8px" : "8px 12px" }}
      >
        <button
          onClick={toggleCollapsed}
          className={`
            flex items-center gap-2 rounded-lg text-[var(--fv-steel)] transition-all
            duration-[150ms] ease-[cubic-bezier(0.4,0,0.2,1)]
            hover:-translate-y-px hover:text-[var(--fv-fog)]
            ${collapsed ? "h-9 w-9 justify-center mx-auto" : "h-9 w-full px-3"}
          `}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
          style={{ minHeight: 36 }}
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <>
              <ChevronLeft size={16} />
              <span className="text-[11px] font-mono uppercase tracking-wider">
                Collapse
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
