import Link from "next/link";
import { Truck, Users, Building2, ArrowRight } from "lucide-react";
import { FramedPanel } from "@/components/design/framed-panel";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { TechnicalLabel } from "@/components/design/technical-label";
import { KpiCell } from "@/components/design/kpi-cell";

/**
 * Welcome / landing page (Phase 16 / Wave 2 — Task 2.1)
 *
 * Unauthenticated users visiting fleetvolt.network see this page.
 * It renders WITHOUT the AppShell (public route — AppShell bypasses
 * "/", "/role-select", "/callback").
 *
 * Structure (top → bottom):
 *   1. Hero headline + subtitle
 *   2. Three role cards (display-only — clicking "Get Started" goes to /role-select)
 *   3. Single primary CTA "Get Started" → /role-select  (Von Restorff: one CTA)
 *   4. KPI strip (credibility row)
 *   5. Footer credit
 *
 * UX laws:
 *   - Hick's Law: 3 role choices max
 *   - Von Restorff: single "Get Started" CTA stands out
 *   - Jakob's Law: layout matches Vercel/Linear/Stripe welcome pages
 */
export default function HomePage() {
  return (
    <FramedPanel maxWidthClass="max-w-[860px]" padding="default">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div className="text-center pt-6 pb-2">
        <h1
          className="font-bold tracking-tight text-[var(--fv-graphite)]"
          style={{ fontSize: "26px", lineHeight: "1.2" }}
        >
          Plan EV Freight Routes with AI
        </h1>
        <p
          className="mx-auto mt-3 max-w-[520px] text-[var(--fv-slate)]"
          style={{ fontSize: "13px", lineHeight: "1.55" }}
        >
          Physics-based charging-stop planner for California ports. Energy
          modeling, charger gaps, route optimization — grounded in real data.
        </p>
      </div>

      {/* ── Role cards (display-only — not clickable on this page) ──── */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RoleCard
          icon={Truck}
          title="Driver"
          desc="Plan your route, find chargers, check amenities, time your runs."
        />
        <RoleCard
          icon={Users}
          title="Fleet Manager"
          desc="Manage your fleet, parking lots, routes, and driver assignments."
        />
        <RoleCard
          icon={Building2}
          title="Charging-as-a-Service"
          desc="Analyze charger gaps, deployment zones, and siting opportunities."
        />
      </div>

      {/* ── Single primary CTA (Von Restorff) ──────────────────────── */}
      <div className="mt-8 flex justify-center">
        <Link
          href="/role-select"
          className="fv-btn-primary inline-flex items-center gap-2 no-underline"
          style={{ padding: "14px 36px", fontSize: "15px", width: "auto" }}
        >
          Get Started
          <ArrowRight size={18} />
        </Link>
      </div>

      {/* ── KPI strip (credibility row) ─────────────────────────────── */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCell label="TRUCK CONFIGS" value="37" className="flex-1" />
        <KpiCell label="CHARGERS" value="2,867" className="flex-1" />
        <KpiCell label="CARRIERS" value="1,823" className="flex-1" />
        <KpiCell
          label="AVG SAVINGS VS DIESEL"
          value="62"
          unit="%"
          className="flex-1"
        />
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <div className="fv-footer-credit mt-6 text-center">
        <TechnicalLabel>
          POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
        </TechnicalLabel>
      </div>
    </FramedPanel>
  );
}

/* ── RoleCard sub-component ──────────────────────────────────────────── */

type RoleCardProps = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  desc: string;
};

function RoleCard({ icon: Icon, title, desc }: RoleCardProps) {
  return (
    <SkeuomorphicCard padding="lg" className="text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--fv-blueprint-blue)]/10">
          <Icon size={28} className="text-[var(--fv-blueprint-blue)]" />
        </div>
        <h2
          className="font-semibold text-[var(--fv-graphite)]"
          style={{ fontSize: "16px" }}
        >
          {title}
        </h2>
        <p
          className="text-[var(--fv-slate)]"
          style={{ fontSize: "12px", lineHeight: "1.45" }}
        >
          {desc}
        </p>
      </div>
    </SkeuomorphicCard>
  );
}
