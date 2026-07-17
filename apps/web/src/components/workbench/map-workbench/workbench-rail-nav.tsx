"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Route,
  Truck,
  Activity,
  Users,
  Package,
  Map,
  BookOpen,
  Layers3,
  Crosshair,
  PanelsTopLeft,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRoleNav, type NavItem } from "@/components/nav/use-role-nav";
import { FleetVoltBrand } from "@/components/design/fleetvolt-brand";
import { cn } from "@/lib/utils";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import { layersForMode } from "./role-layers";

type DrawerKey = "layers" | "mode" | "opportunity";
const DRAWER_MS = 360;

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Route,
  Truck,
  Activity,
  Users,
  Package,
  Map,
  BookOpen,
};

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
  return (
    <Link
      href={item.href}
      title={item.label}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-lg px-2 text-base font-medium transition",
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

type WorkbenchRailNavProps = {
  modePanel: ReactNode;
  opportunityPanel: ReactNode;
};

function modeCopy(mode: ReturnType<typeof useMapWorkbenchStore.getState>["mode"]) {
  if (mode === "fleet_contract_plan") {
    return {
      modeEyebrow: "Fleet mode",
      modeTitle: "Contract inputs",
      modeDescription: "Build the fleet, depot, route, and operating assumptions used by the contract plan.",
      opportunityEyebrow: "Fleet result cards",
      opportunityTitle: "Contract-plan summary",
      opportunityDescription: "Review the calculated operating evidence, warnings, and export-ready result cards.",
    };
  }
  if (mode === "caas_gap_map") {
    return {
      modeEyebrow: "CaaS mode",
      modeTitle: "Gap / opportunity map",
      modeDescription: "Build a route, select the truck profile, and calculate Class 8 charging opportunities.",
      opportunityEyebrow: "CaaS opportunity cards",
      opportunityTitle: "Gap-map summary",
      opportunityDescription: "Review route evidence, charger gaps, carrier targets, and deployment assumptions.",
    };
  }
  return {
    modeEyebrow: "Driver mode",
    modeTitle: "Day-plan inputs",
    modeDescription: "Build the driver route, truck profile, timing, and charging constraints.",
    opportunityEyebrow: "Driver result cards",
    opportunityTitle: "Day-plan summary",
    opportunityDescription: "Review the calculated route, charging stops, warnings, and operating plan.",
  };
}

/** Compact role nav stacked at the top of the workbench tool rail (above tools). */
export function WorkbenchRailNav({ modePanel, opportunityPanel }: WorkbenchRailNavProps) {
  const { items, loading, activeHref } = useRoleNav();
  const mode = useMapWorkbenchStore((state) => state.mode);
  const activeLayers = useMapWorkbenchStore((state) => state.activeLayers);
  const toggleLayer = useMapWorkbenchStore((state) => state.toggleLayer);
  const caasGeoLevel = useMapWorkbenchStore((state) => state.caasGeoLevel);
  const setCaasGeoLevel = useMapWorkbenchStore((state) => state.setCaasGeoLevel);
  const iconLayers = layersForMode(mode).filter((layer) =>
    ["ports", "chargers", "parking", "pois", "fleet-yards", "class8-gaps", "carriers"].includes(layer.id),
  );
  const layerItems = layersForMode(mode);
  const copy = modeCopy(mode);
  const visibleNavItems = items.filter(
    (item) => !/summary kpis|system status/i.test(item.label),
  );
  const [drawer, setDrawer] = useState<DrawerKey | null>(null);
  const [visible, setVisible] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  function openDrawer(next: DrawerKey) {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setDrawer(next);
    window.requestAnimationFrame(() => setVisible(true));
  }

  function closeDrawer() {
    setVisible(false);
    closeTimer.current = window.setTimeout(() => setDrawer(null), DRAWER_MS);
  }

  function toggleDrawer(next: DrawerKey) {
    if (drawer === next && visible) closeDrawer();
    else openDrawer(next);
  }

  return (
    <div className="shrink-0 border-b border-white/10">
      {/* Logo owns the top of the rail — full width, standout brand mark. */}
      <Link
        href="/"
        className="flex w-full items-center justify-center border-b border-white/10 px-3 py-6 no-underline"
        aria-label="FleetVolt home"
        data-testid="workbench-rail-logo"
      >
        <FleetVoltBrand size="rail" className="w-full" />
      </Link>

      <nav className="flex flex-col gap-0.5 px-3 py-3" aria-label="Role navigation">
        {loading && visibleNavItems.length === 0 ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-white/5" />
            ))}
          </>
        ) : visibleNavItems.length > 0 ? (
          visibleNavItems.map((item) => (
            <RailLink key={item.href} item={item} active={activeHref === item.href} />
          ))
        ) : (
          <p className="px-1 text-[11px] leading-4 text-[var(--fv-steel)]">
            Role tools load after your account role is available.
          </p>
        )}

        {iconLayers.length > 0 ? (
          <div className="mt-2 space-y-2 border-t border-white/10 pt-3" data-testid="workbench-stack-menu">
            <div className="px-1 font-mono text-base font-bold uppercase tracking-[0.12em] text-[var(--fv-blueprint-blue)]">
              Workbench control
            </div>
            <button
              type="button"
              data-testid="workbench-drawer-trigger-layers"
              onClick={() => toggleDrawer("layers")}
              aria-expanded={drawer === "layers" && visible}
              className="flex min-h-12 w-full items-center justify-between rounded-lg border border-white/15 bg-white/[0.04] px-3 text-left text-base font-bold text-white transition hover:border-[var(--fv-blueprint-blue)] hover:bg-[var(--fv-blueprint-blue)]/10"
            >
              <span className="flex items-center gap-2"><Layers3 size={19} /> Map layers</span>
              <span className="text-[var(--fv-blueprint-blue)]">{activeLayers.length} on</span>
            </button>
            <button
              type="button"
              data-testid="workbench-drawer-trigger-mode"
              onClick={() => toggleDrawer("mode")}
              aria-expanded={drawer === "mode" && visible}
              className="flex min-h-16 w-full items-center justify-between rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-left text-base font-bold text-white transition hover:border-[var(--fv-blueprint-blue)] hover:bg-[var(--fv-blueprint-blue)]/10"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Crosshair size={19} className="shrink-0" />
                <span>
                  <span className="block uppercase text-[var(--fv-blueprint-blue)]">{copy.modeEyebrow}</span>
                  <span className="block leading-5">{copy.modeTitle}</span>
                </span>
              </span>
            </button>
            <button
              type="button"
              data-testid="workbench-drawer-trigger-opportunity"
              onClick={() => toggleDrawer("opportunity")}
              aria-expanded={drawer === "opportunity" && visible}
              className="flex min-h-16 w-full items-center justify-between rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-left text-base font-bold text-white transition hover:border-[var(--fv-blueprint-blue)] hover:bg-[var(--fv-blueprint-blue)]/10"
            >
              <span className="flex min-w-0 items-center gap-2">
                <PanelsTopLeft size={19} className="shrink-0" />
                <span>
                  <span className="block uppercase text-[var(--fv-blueprint-blue)]">{copy.opportunityEyebrow}</span>
                  <span className="block leading-5">{copy.opportunityTitle}</span>
                </span>
              </span>
            </button>
          </div>
        ) : null}
      </nav>

      {(["layers", "mode", "opportunity"] as const).map((drawerKey) => {
        const isActive = drawer === drawerKey && visible;
        const eyebrow =
          drawerKey === "layers"
            ? "Filter control · layers"
            : drawerKey === "mode"
              ? copy.modeEyebrow
              : copy.opportunityEyebrow;
        const title =
          drawerKey === "layers"
            ? "Limit the map view"
            : drawerKey === "mode"
              ? copy.modeTitle
              : copy.opportunityTitle;
        const description =
          drawerKey === "layers"
            ? "Toggle only the evidence you need. Your selections are saved as the next-session default."
            : drawerKey === "mode"
              ? copy.modeDescription
              : copy.opportunityDescription;
        return (
        <section
          key={drawerKey}
          data-testid={`workbench-${drawerKey}-drawer`}
          className={cn(
            "fixed left-80 top-14 z-[70] flex max-h-[calc(100dvh-4.5rem)] w-[min(64rem,calc(100vw-20rem))] flex-col overflow-hidden border border-[var(--fv-blueprint-blue)]/40 bg-[#0b1016]/[0.98] text-white shadow-[0_24px_80px_rgba(0,0,0,0.58)] backdrop-blur-xl transition-[transform,opacity] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transform-none motion-reduce:transition-none",
            drawerKey === "layers" ? "h-fit" : "h-[calc(100dvh-4.5rem)]",
            isActive ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-12 opacity-0",
          )}
          aria-label={`${title} controls`}
          aria-hidden={!isActive}
          inert={!isActive}
        >
          <header className="flex items-start justify-between gap-5 border-b border-white/15 px-6 py-5">
            <div>
              <div className="font-mono text-base font-bold uppercase tracking-[0.16em] text-[var(--fv-blueprint-blue)]">
                {eyebrow}
              </div>
              <h2 className="mt-1 text-2xl font-bold uppercase">{title}</h2>
              <p className="mt-2 max-w-3xl text-base leading-6 text-[var(--fv-slate)]">
                {description}
              </p>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/20 text-white transition hover:border-[var(--fv-blueprint-blue)] hover:text-[var(--fv-blueprint-blue)]"
              aria-label={`Close ${title} drawer`}
            >
              <X size={22} />
            </button>
          </header>

          {drawerKey === "layers" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {layerItems.map((layer) => {
                const active = activeLayers.includes(layer.id);
                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => toggleLayer(layer.id)}
                    aria-pressed={active}
                    title={layer.hint}
                    className={cn(
                      "flex min-h-24 items-center justify-between gap-4 border-b border-r border-white/15 px-5 py-4 text-left transition",
                      active ? "bg-[var(--fv-blueprint-blue)]/20" : "bg-[#101821] hover:bg-white/[0.06]",
                    )}
                  >
                    <span>
                      <span className="block text-base font-bold uppercase">{layer.label}</span>
                      <span className="mt-1 block text-base leading-5 text-[var(--fv-slate)]">{layer.hint}</span>
                    </span>
                    <span aria-hidden className={cn("h-6 w-11 shrink-0 rounded-full border p-0.5 transition", active ? "border-[var(--fv-blueprint-blue)] bg-[var(--fv-blueprint-blue)]" : "border-white/30 bg-white/10")}>
                      <span className={cn("block h-4 w-4 rounded-full bg-white transition-transform", active && "translate-x-5")} />
                    </span>
                  </button>
                );
              })}
              {mode === "caas_gap_map" ? (
                <div className="col-span-2 border-b border-white/15 bg-[#0d141c] px-5 py-4 md:col-span-3 xl:col-span-4">
                  <div className="text-base font-bold uppercase text-[var(--fv-blueprint-blue)]">Geographic overlay</div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {(["air-district", "county", "zip"] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setCaasGeoLevel(level)}
                        aria-pressed={caasGeoLevel === level}
                        className={cn(
                          "min-h-12 rounded-lg border px-4 text-base font-bold uppercase transition",
                          caasGeoLevel === level
                            ? "border-[var(--fv-blueprint-blue)] bg-[var(--fv-blueprint-blue)]/20 text-white"
                            : "border-white/20 text-[var(--fv-slate)] hover:text-white",
                        )}
                      >
                        {level.replace("-", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
          </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden bg-[var(--fv-paper)] text-[var(--fv-graphite)]">
              {drawerKey === "mode" ? modePanel : opportunityPanel}
            </div>
          )}
        </section>
        );
      })}
    </div>
  );
}
