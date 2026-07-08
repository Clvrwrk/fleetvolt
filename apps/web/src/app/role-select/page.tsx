"use client";

import Link from "next/link";
import { Truck, Users, Building2, ArrowRight, Shield, Check } from "lucide-react";
import { useWorkOSAuth } from "@/lib/auth";

export default function RoleSelectPage() {
  const { user, loading, signIn, signOut } = useWorkOSAuth();

  const roles = [
    { href: "/driver", icon: Truck, title: "Driver", desc: "Plan your route, find chargers, check amenities, and time your runs." },
    { href: "/fleet", icon: Users, title: "Fleet Manager", desc: "Manage your fleet, parking lots, routes, and driver assignments." },
    { href: "/caas", icon: Building2, title: "Charging-as-a-Service", desc: "Analyze charger gaps, deployment zones, and siting opportunities." },
    { href: "/planner", icon: ArrowRight, title: "Plan with AI", desc: "Ask any freight, charging, or planning question in natural language." },
  ];

  // Not authenticated — show sign-in CTA
  if (!loading && !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--fv-accent)]/10">
            <Shield size={32} className="text-[var(--fv-accent)]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[var(--fv-text)]">Choose your role</h1>
            <p className="text-sm text-[var(--fv-text-muted)]">
              FleetVolt secures every account with{" "}
              <span className="font-medium text-[var(--fv-text)]">WorkOS AuthKit</span> —
              enterprise-grade authentication trusted by leading SaaS platforms.
              Your data is encrypted, your sessions are protected, and your identity is verified.
            </p>
          </div>
          <button
            onClick={signIn}
            className="w-full px-6 py-3 rounded-lg bg-[var(--fv-accent)] text-white font-medium hover:bg-[var(--fv-accent-green)] transition-colors"
          >
            Sign in with WorkOS to continue
          </button>
          <div className="flex items-center justify-center gap-4 text-xs text-[var(--fv-text-muted)]">
            <span className="flex items-center gap-1"><Check size={12} /> SSO Ready</span>
            <span className="flex items-center gap-1"><Check size={12} /> MFA Supported</span>
            <span className="flex items-center gap-1"><Check size={12} /> SOC 2 Type II</span>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated — show role selection
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-[var(--fv-text)]">
            Welcome{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="text-[var(--fv-text-muted)]">Select how you&apos;ll use FleetVolt.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((r) => {
            const Icon = r.icon;
            return (
              <Link key={r.href} href={r.href} className="group flex items-start gap-4 p-6 rounded-xl bg-[var(--fv-surface)] border border-[var(--fv-stroke)] hover:border-[var(--fv-accent)] transition-colors">
                <div className="p-3 rounded-lg bg-[var(--fv-accent)]/10">
                  <Icon size={28} className="text-[var(--fv-accent)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--fv-text)] group-hover:text-[var(--fv-accent)]">{r.title}</h2>
                  <p className="text-sm text-[var(--fv-text-muted)] mt-1">{r.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="text-center mt-6">
          <button onClick={signOut} className="text-sm text-[var(--fv-text-muted)] hover:text-[var(--fv-text)]">
            Sign out ({user?.email})
          </button>
        </div>
      </div>
    </div>
  );
}
