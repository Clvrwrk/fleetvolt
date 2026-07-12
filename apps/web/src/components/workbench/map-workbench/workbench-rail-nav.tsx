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
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import { layersForMode } from "./role-layers";

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
  const mode = useMapWorkbenchStore((state) => state.mode);
  const activeLayers = useMapWorkbenchStore((state) => state.activeLayers);
  const toggleLayer = useMapWorkbenchStore((state) => state.toggleLayer);
  const iconLayers = layersForMode(mode).filter((layer) =>
    ["ports", "chargers", "parking", "pois", "fleet-yards", "class8-gaps", "carriers", "caas-zones"].includes(layer.id),
  );

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
        />
      </Link>

      <nav className="flex flex-col gap-0.5 px-3 py-3" aria-label="Role navigation">
        {loading && items.length === 0 ? (
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

        {iconLayers.length > 0 ? (
          <div className="mt-2 border-t border-white/10 pt-2" data-testid="rail-icon-layer-toggles">
            <div className="mb-1.5 px-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--fv-blueprint-blue)]">
              Visible icon sets
            </div>
            <div className="flex flex-wrap gap-1">
              {iconLayers.map((layer) => {
                const active = activeLayers.includes(layer.id);
                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => toggleLayer(layer.id)}
                    aria-pressed={active}
                    title={layer.hint}
                    className={cn(
                      "rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] transition",
                      active
                        ? "border-[var(--fv-blueprint-blue)] bg-[var(--fv-blueprint-blue)]/20 text-white"
                        : "border-white/10 bg-transparent text-[var(--fv-steel)]",
                    )}
                  >
                    {layer.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </nav>
    </div>
  );
}
