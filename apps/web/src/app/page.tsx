import Link from "next/link";
import { ArrowRight, Shield, Zap, MapPin, Truck, TrendingUp } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-3xl w-full text-center space-y-8">
        {/* What */}
        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--fv-text)]">
            Freight electrification,
            <br />
            <span className="text-[var(--fv-accent)]">planned with data.</span>
          </h1>
          <p className="text-lg text-[var(--fv-text-muted)] max-w-xl mx-auto">
            FleetVolt plans EV drayage routes, charging stops, and depot infrastructure
            for Class 8 trucks operating out of California ports.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3 py-4">
          <Link
            href="/role-select"
            className="group inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-[var(--fv-accent)] text-white font-medium hover:bg-[var(--fv-accent-green)] transition-colors"
          >
            Create my account
            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <p className="text-sm text-[var(--fv-text-muted)]">
            Secured by <Shield size={12} className="inline" /> WorkOS AuthKit
          </p>
        </div>

        {/* What / When / Where / How / Why */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-8 border-t border-[var(--fv-stroke)]/30">
          {[
            { icon: Zap, label: "What", text: "EV route planning, charger siting, fleet operations" },
            { icon: MapPin, label: "Where", text: "California ports — POLB, POLA, Oakland, SF" },
            { icon: Truck, label: "When", text: "Now — 2,867 DC-fast chargers mapped, 37 truck configs live" },
            { icon: TrendingUp, label: "How", text: "Physics-based simulation + live AFDC/NATD/OSM/CalTrans data" },
            { icon: Shield, label: "Why", text: "Defensible, data-grounded decisions for infrastructure investment" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="space-y-1.5 text-center">
                <Icon size={20} className="text-[var(--fv-accent)] mx-auto" />
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">
                  {item.label}
                </div>
                <p className="text-sm text-[var(--fv-text-secondary)] leading-snug">{item.text}</p>
              </div>
            );
          })}
        </div>

        {/* About */}
        <div className="pt-8 text-center">
          <p className="text-sm text-[var(--fv-text-muted)] max-w-lg mx-auto">
            FleetVolt is a physics-based EV drayage charging-stop planner. It simulates
            realistic POLB drayage and inland corridor scenarios, surfaces recommended
            charging stops with transparent assumptions, and identifies charger
            deployment zones for Charging-as-a-Service providers. All data is live —
            never fabricated, always labeled.
          </p>
        </div>
      </div>
    </div>
  );
}
