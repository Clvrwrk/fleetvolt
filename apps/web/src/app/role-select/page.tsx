"use client";

import Link from "next/link";
import { Truck, Users, Building2, ArrowRight, Shield, Check } from "lucide-react";
import { useWorkOSAuth } from "@/lib/auth";
import { FramedPanel } from "@/components/design/framed-panel";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { TechnicalLabel } from "@/components/design/technical-label";

export default function RoleSelectPage() {
  const { user, loading, signIn, signOut } = useWorkOSAuth();

  const roles = [
    { href: "/driver", icon: Truck, title: "Driver", desc: "Plan your route, find chargers, check amenities, and time your runs." },
    { href: "/fleet", icon: Users, title: "Fleet Manager", desc: "Manage your fleet, parking lots, routes, and driver assignments." },
    { href: "/caas", icon: Building2, title: "Charging-as-a-Service", desc: "Analyze charger gaps, deployment zones, and siting opportunities." },
    { href: "/planner", icon: ArrowRight, title: "Plan with AI", desc: "Ask any freight, charging, or planning question in natural language." },
  ];

  // Not authenticated — show sign-in CTA in framed container
  if (!loading && !user) {
    return (
      <FramedPanel maxWidthClass="max-w-[600px]">
        <div className="flex flex-col items-center gap-6 py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--fv-blueprint-blue)]/10">
            <Shield size={32} className="text-[var(--fv-blueprint-blue)]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
              Choose your role
            </h1>
            <p className="max-w-md text-sm text-[var(--fv-text-muted)]">
              FleetVolt secures every account with{" "}
              <span className="font-medium text-[var(--fv-graphite)]">WorkOS AuthKit</span> —
              enterprise-grade authentication. Your data is encrypted, your sessions are protected,
              and your identity is verified.
            </p>
          </div>
          <button onClick={signIn} className="fv-btn-primary w-full">
            Sign in with WorkOS to continue
          </button>
          <div className="flex items-center justify-center gap-4 font-mono text-[10px] text-[var(--fv-steel)]">
            <span className="flex items-center gap-1"><Check size={12} /> SSO READY</span>
            <span className="flex items-center gap-1"><Check size={12} /> MFA SUPPORTED</span>
            <span className="flex items-center gap-1"><Check size={12} /> SOC 2 TYPE II</span>
          </div>
        </div>
        <div className="fv-footer-credit mt-3 text-right">
          POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
        </div>
      </FramedPanel>
    );
  }

  // Authenticated — show role selection in framed container
  return (
    <FramedPanel maxWidthClass="max-w-[900px]">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-black/8 pb-4">
        <div className="flex items-baseline gap-3.5">
          <span className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
            Welcome{user?.firstName ? `, ${user.firstName}` : ""}
          </span>
          <TechnicalLabel>SELECT YOUR OPERATIONAL ROLE</TechnicalLabel>
        </div>
      </div>

      {/* Role cards */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.href}
              href={r.href}
              className="fv-card group no-underline transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--fv-blueprint-blue)]/10">
                  <Icon size={24} className="text-[var(--fv-blueprint-blue)]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[var(--fv-graphite)] group-hover:text-[var(--fv-blueprint-blue)]">
                    {r.title}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--fv-text-muted)]">{r.desc}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Sign out */}
      <div className="mt-6 text-center">
        <button
          onClick={signOut}
          className="fv-btn-secondary"
          style={{ width: "auto", padding: "8px 16px" }}
        >
          Sign out ({user?.email})
        </button>
      </div>

      <div className="fv-footer-credit mt-3.5 text-right">
        POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
      </div>
    </FramedPanel>
  );
}
