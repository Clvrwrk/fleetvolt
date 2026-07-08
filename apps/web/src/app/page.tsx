import Link from "next/link";
import { FramedPanel } from "@/components/design/framed-panel";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { TechnicalLabel } from "@/components/design/technical-label";
import { KpiCell } from "@/components/design/kpi-cell";
import { StatusBadge } from "@/components/design/status-badge";
import { HomeRouteSvg } from "@/components/home/home-route-svg";

/**
 * Homepage — Screen 1 PRD: Framed Instrument with technical SVG, dimension
 * callouts, 3 action buttons, KPI strip, and metadata blocks.
 */
export default function HomePage() {
  return (
    <FramedPanel maxWidthClass="max-w-[1100px]">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-black/8 pb-4">
        <div className="flex items-baseline gap-3.5">
          <span className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
            FleetVolt Route
          </span>
          <span className="font-mono text-[11px] tracking-wide text-[var(--fv-steel)]">
            EV FREIGHT MODELER v2.1 — POLB FOCUS
          </span>
        </div>
        <StatusBadge variant="ok">
          SoCal Charger Network — Updated 4h ago
        </StatusBadge>
      </div>

      {/* Central technical SVG area */}
      <div className="mt-6">
        <SkeuomorphicCard padding="lg" className="bg-[var(--fv-surface-viz)]">
          <TechnicalLabel className="mb-2 block">
            ROUTE SCHEMATIC — POLB → BAKERSFIELD CORRIDOR
          </TechnicalLabel>
          <div className="transition-transform duration-300 hover:scale-[1.01]">
            <HomeRouteSvg />
          </div>
        </SkeuomorphicCard>
      </div>

      {/* Dimension callout strip */}
      <div className="mt-4 flex gap-4">
        <div className="flex-1" style={{ borderTop: "0.5px dashed var(--fv-steel)" }}>
          <div className="pt-1.5">
            <TechnicalLabel className="text-[9px]">TYPICAL DRAYAGE LEG</TechnicalLabel>
            <div className="font-mono text-[11px] font-semibold text-[var(--fv-slate)]">
              42 <span className="text-[var(--fv-steel)]">mi</span>
            </div>
          </div>
        </div>
        <div className="flex-1" style={{ borderTop: "0.5px dashed var(--fv-steel)" }}>
          <div className="pt-1.5">
            <TechnicalLabel className="text-[9px]">CAJON PASS GRADE</TechnicalLabel>
            <div className="font-mono text-[11px] font-semibold text-[var(--fv-slate)]">
              3.8<span className="text-[var(--fv-steel)]"> %</span>
            </div>
          </div>
        </div>
        <div className="flex-1" style={{ borderTop: "0.5px dashed var(--fv-steel)" }}>
          <div className="pt-1.5">
            <TechnicalLabel className="text-[9px]">NET ENERGY</TechnicalLabel>
            <div className="font-mono text-[11px] font-semibold text-[var(--fv-slate)]">
              312 <span className="text-[var(--fv-steel)]">kWh</span>
            </div>
          </div>
        </div>
        <div className="flex-1" style={{ borderTop: "0.5px dashed var(--fv-steel)" }}>
          <div className="pt-1.5">
            <TechnicalLabel className="text-[9px]">REGEN CREDIT</TechnicalLabel>
            <div className="font-mono text-[11px] font-semibold text-[var(--fv-slate)]">
              +47 <span className="text-[var(--fv-steel)]">kWh</span>
            </div>
          </div>
        </div>
        <div className="flex-1" style={{ borderTop: "0.5px dashed var(--fv-steel)" }}>
          <div className="pt-1.5">
            <TechnicalLabel className="text-[9px]">CHARGE STOPS</TechnicalLabel>
            <div className="font-mono text-[11px] font-semibold text-[var(--fv-slate)]">
              2 <span className="text-[var(--fv-steel)]">stops</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/planner"
          className="fv-btn-primary block text-center no-underline"
          style={{ width: "auto", padding: "14px 24px" }}
        >
          ▶ Start New Route Simulation
        </Link>
        <Link
          href="/unit"
          className="fv-btn-secondary no-underline inline-block"
        >
          Configure Truck Unit
        </Link>
        <Link
          href="/hotspot"
          className="fv-btn-secondary no-underline inline-block"
        >
          Explore SoCal Network
        </Link>
      </div>

      {/* KPI strip */}
      <div className="mt-6 flex gap-2.5">
        <KpiCell
          label="ACTIVE CORRIDORS"
          value="14"
          className="flex-1"
        />
        <KpiCell
          label="AVG SAVINGS VS DIESEL"
          value="62"
          unit="%"
          className="flex-1"
        />
        <KpiCell
          label="CHARGERS MODELED"
          value="1,847"
          className="flex-1"
        />
        <KpiCell
          label="TRUCK CONFIGS"
          value="37"
          className="flex-1"
        />
      </div>

      {/* Bottom action bar with KPIs */}
      <div className="fv-action-bar">
        <div className="fv-action-bar-actions">
          <Link href="/driver" className="fv-btn-secondary no-underline inline-block">
            Driver Preferences
          </Link>
          <Link href="/fleet" className="fv-btn-secondary no-underline inline-block">
            Fleet Management
          </Link>
          <Link href="/caas" className="fv-btn-secondary no-underline inline-block">
            Charging-as-a-Service
          </Link>
          <Link href="/role-select" className="fv-btn-secondary no-underline inline-block">
            Sign In
          </Link>
        </div>
        <div className="hidden gap-5 font-mono xl:flex">
          <div className="text-right">
            <div className="text-[8.5px] tracking-wide text-[var(--fv-text-muted)]">
              LAST SIMULATION
            </div>
            <div className="text-base font-semibold text-[var(--fv-graphite)]">
              2h AGO
            </div>
          </div>
        </div>
      </div>

      {/* Footer credit */}
      <div className="fv-footer-credit mt-3.5 text-right">
        POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
      </div>
    </FramedPanel>
  );
}
