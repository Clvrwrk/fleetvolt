"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  type LucideIcon,
} from "lucide-react";
import { useRoleNav, type NavItem } from "./use-role-nav";

// ── Phase 16 / Wave 3: MobileTabBar ────────────────────────────────────────
//
// Bottom-fixed tab bar for mobile (< 768px). Shows first 4 role-specific
// nav items from useRoleNav().
//
// Each item: icon (24px) + label (Inter 10px) below.
// Touch targets: minimum 44px height (Fitts's Law / Apple HIG).
// Paper background, top border, Graphite active state.
//
// UX audit checks: NAV-1 (sidebar on desktop → bottom tab bar on mobile)
// UX principles: Fitts's Law (bottom of screen is closer to thumb),
//   Research §7.1 ("bottom tab bar for ≤5 items"),
//   §7.3 ("minimum 44pt touch target"), §7.2 ("icons alone are ambiguous")

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
};

function TabItem({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;

  return (
    <Link
      href={item.href}
      className="flex flex-1 flex-col items-center justify-center gap-0.5"
      style={{ minHeight: 44, paddingTop: 6, paddingBottom: 6 }}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
    >
      <Icon
        size={24}
        className={active ? "text-[var(--fv-graphite)]" : "text-[var(--fv-steel)]"}
        style={{ flexShrink: 0 }}
      />
      <span
        className="text-[10px] leading-none whitespace-nowrap"
        style={{
          fontFamily: "var(--font-inter), sans-serif",
          fontWeight: active ? 600 : 400,
          color: active ? "var(--fv-graphite)" : "var(--fv-steel)",
        }}
      >
        {item.label}
      </span>
    </Link>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const { items, activeHref } = useRoleNav();

  const fallbackItems: NavItem[] = [
    { label: "Home", href: "/", icon: "LayoutDashboard" },
    { label: "Briefing", href: "/briefing", icon: "Sparkles" },
    { label: "Sign in", href: "/role-select", icon: "Users" },
  ];

  // Show first 4 nav items (Research §7.1: "bottom tab bar for ≤5 items")
  const tabItems = (items.length > 0 ? items : fallbackItems).slice(0, 4);

  if (tabItems.length === 0) return null;

  return (
    <nav
      className="fv-mobile-commandbar fixed bottom-0 left-0 right-0 z-40 flex md:hidden"
      style={{
        background: "rgba(8, 11, 15, 0.96)",
        borderTop: "1px solid rgba(255,255,255,.1)",
        boxShadow: "0 -10px 30px rgba(0, 0, 0, 0.28)",
      }}
      aria-label="Mobile navigation"
    >
      {tabItems.map((item) => (
        <TabItem
          key={item.href}
          item={item}
          active={(activeHref || pathname) === item.href}
        />
      ))}
    </nav>
  );
}
