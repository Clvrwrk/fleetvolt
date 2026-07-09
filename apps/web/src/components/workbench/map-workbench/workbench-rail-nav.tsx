"use client";

import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Route,
  Truck,
  Activity,
  Users,
  Package,
  Map,
  type LucideIcon,
} from "lucide-react";
import { useRoleNav, type NavItem } from "@/components/nav/use-role-nav";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Route,
  Truck,
  Activity,
  Users,
  Package,
  Map,
};

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
  return (
    <Link
      href={item.href}
      title={item.label}
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-lg px-2 text-[12px] font-medium transition",
        active
          ? "bg-white/10 text-[var(--fv-paper)]"
          : "text-[var(--fv-slate)] hover:bg-white/5 hover:text-[var(--fv-fog)]",
      )}
    >
      <Icon size={16} className={active ? "text-[var(--fv-blueprint-blue)]" : undefined} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/** Compact role nav stacked at the top of the workbench tool rail (above tools). */
export function WorkbenchRailNav() {
  const { items, loading, activeHref } = useRoleNav();

  return (
    <div className="shrink-0 border-b border-white/10">
      {/* Logo owns the top of the rail — full width, standout brand mark. */}
      <Link
        href="/"
        className="flex w-full items-center justify-center border-b border-white/10 px-3 py-6 no-underline"
        aria-label="FleetVolt home"
        data-testid="workbench-rail-logo"
      >
        <Image
          src="/fleetvolt-logo-horizontal-light.svg"
          alt="FleetVolt"
          width={320}
          height={72}
          priority
          className="h-16 w-full object-contain object-left sm:h-[4.5rem]"
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </Link>

      <nav className="flex flex-col gap-0.5 px-3 py-3" aria-label="Role navigation">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-white/5" />
            ))}
          </>
        ) : items.length > 0 ? (
          items.map((item) => (
            <RailLink key={item.href} item={item} active={activeHref === item.href} />
          ))
        ) : (
          <p className="px-1 text-[11px] leading-4 text-[var(--fv-steel)]">
            Role tools load after your account role is available.
          </p>
        )}
      </nav>
    </div>
  );
}
