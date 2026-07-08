"use client";

import { Truck, Users, Building2, Shield, Check } from "lucide-react";
import { useWorkOSAuth, type FleetVoltRole } from "@/lib/auth";
import { FramedPanel } from "@/components/design/framed-panel";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { TechnicalLabel } from "@/components/design/technical-label";

/**
 * Role-select page (Phase 16 / Wave 2 — Task 2.2)
 *
 * Shows 3 large clickable role cards BEFORE authentication. This replaces
 * the old "Sign in with WorkOS" button that was confusing for first-time
 * users. The entire card is the click target (Fitts's Law).
 *
 * When a card is clicked:
 *   1. The selected role is stored in localStorage ("fv_selected_role") so
 *      the callback page can read it after the WorkOS redirect.
 *   2. signIn(role) from useWorkOSAuth is called — this also sets a
 *      short-lived cookie "fv_selected_role" and passes the role in the
 *      WorkOS "state" param.
 *   3. WorkOS hosted login page opens; after auth the user is redirected
 *      to /callback where the role is read and the user is sent to their
 *      role-specific home page.
 *
 * UX laws:
 *   - Hick's Law: exactly 3 choices, nothing else
 *   - Fitts's Law: entire card is clickable, large target
 *   - Jakob's Law: role selection during signup (Notion, Asana, Slack)
 */

type RoleDef = {
  key: FleetVoltRole;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  desc: string;
};

const ROLES: RoleDef[] = [
  {
    key: "driver",
    icon: Truck,
    title: "Driver",
    desc: "Plan your route, find chargers, check amenities, and time your runs.",
  },
  {
    key: "fleet_manager",
    icon: Users,
    title: "Fleet Manager",
    desc: "Manage your fleet, parking lots, routes, and driver assignments.",
  },
  {
    key: "caas",
    icon: Building2,
    title: "Charging-as-a-Service",
    desc: "Analyze charger gaps, deployment zones, and siting opportunities.",
  },
];

export default function RoleSelectPage() {
  const { signIn } = useWorkOSAuth();

  const handleSelectRole = (role: FleetVoltRole) => {
    // 1. Store in localStorage for the callback page to read after redirect
    try {
      localStorage.setItem("fv_selected_role", role);
    } catch {
      // localStorage may be unavailable (private mode) — cookie + state
      // param set by signIn() are the primary transport.
    }
    // 2. signIn with role — sets cookie + WorkOS state param + redirects
    signIn(role);
  };

  return (
    <FramedPanel maxWidthClass="max-w-[760px]" padding="default">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="pt-6 text-center">
        <h1
          className="font-bold tracking-tight text-[var(--fv-graphite)]"
          style={{ fontSize: "19px" }}
        >
          Choose your role
        </h1>
        <p
          className="mx-auto mt-2 max-w-[420px] text-[var(--fv-slate)]"
          style={{ fontSize: "13px", lineHeight: "1.5" }}
        >
          Select how you&apos;ll use FleetVolt. You can change this later.
        </p>
      </div>

      {/* ── Role cards ──────────────────────────────────────────────── */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ROLES.map((role) => {
          const Icon = role.icon;
          return (
            <button
              key={role.key}
              type="button"
              onClick={() => handleSelectRole(role.key)}
              className="group no-underline transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fv-blueprint-blue)]"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              <SkeuomorphicCard
                padding="lg"
                className="h-full transition-colors duration-200 group-hover:border-[var(--fv-blueprint-blue)]"
              >
                <div className="flex h-full min-h-[180px] flex-col items-center gap-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--fv-blueprint-blue)]/10">
                    <Icon size={28} className="text-[var(--fv-blueprint-blue)]" />
                  </div>
                  <h2
                    className="font-semibold text-[var(--fv-graphite)] transition-colors group-hover:text-[var(--fv-blueprint-blue)]"
                    style={{ fontSize: "16px" }}
                  >
                    {role.title}
                  </h2>
                  <p
                    className="text-[var(--fv-slate)]"
                    style={{ fontSize: "12px", lineHeight: "1.45" }}
                  >
                    {role.desc}
                  </p>
                </div>
              </SkeuomorphicCard>
            </button>
          );
        })}
      </div>

      {/* ── Security note ──────────────────────────────────────────── */}
      <div className="mt-8 flex items-center justify-center gap-2 text-center">
        <Shield size={14} className="text-[var(--fv-steel)]" />
        <TechnicalLabel>
          PROTECTED BY WORKOS AUTHKIT — SSO READY · MFA SUPPORTED · SOC 2 TYPE II
        </TechnicalLabel>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="fv-footer-credit mt-4 text-center">
        <TechnicalLabel>
          POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
        </TechnicalLabel>
      </div>
    </FramedPanel>
  );
}
