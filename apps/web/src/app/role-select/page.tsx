import Link from "next/link";
import { Truck, Users, Building2, ArrowRight } from "lucide-react";

export default function RoleSelectPage() {
  const roles = [
    { href: "/driver", icon: Truck, title: "Driver", desc: "Plan your route, find chargers, check amenities, and time your runs." },
    { href: "/fleet", icon: Users, title: "Fleet Manager", desc: "Manage your fleet, parking lots, routes, and driver assignments." },
    { href: "/caas", icon: Building2, title: "Charging-as-a-Service", desc: "Analyze charger gaps, deployment zones, and siting opportunities." },
    { href: "/planner", icon: ArrowRight, title: "Plan with AI", desc: "Ask any freight, charging, or planning question in natural language." },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <h1 className="text-3xl font-bold text-center mb-2 text-[var(--fv-text,#e0e0e8)]">Choose your role</h1>
        <p className="text-center text-[var(--fv-text-muted,#888)] mb-8">Select how you&apos;ll use FleetVolt to get the right tools and data.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((r) => {
            const Icon = r.icon;
            return (
              <Link key={r.href} href={r.href} className="group flex items-start gap-4 p-6 rounded-xl bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)] hover:border-[var(--fv-accent,#3b82f6)] transition-colors">
                <div className="p-3 rounded-lg bg-[var(--fv-accent,#3b82f6)]/10">
                  <Icon size={28} className="text-[var(--fv-accent,#3b82f6)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--fv-text,#e0e0e8)] group-hover:text-[var(--fv-accent,#3b82f6)]">{r.title}</h2>
                  <p className="text-sm text-[var(--fv-text-muted,#888)] mt-1">{r.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
