"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileBarChart,
  LockKeyhole,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import { FleetVoltBrand } from "@/components/design/fleetvolt-brand";
import type { FleetVoltRole } from "@/lib/auth";
import { ALPHA_AUTH_BYPASS } from "@/lib/alpha-auth";

type RoleDef = {
  key: FleetVoltRole;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  index: string;
  title: string;
  eyebrow: string;
  desc: string;
  active: boolean;
};

const ROLES: RoleDef[] = [
  {
    key: "caas",
    icon: Building2,
    index: "01",
    title: "CaaS Intelligence",
    eyebrow: "ALPHA / ACTIVE LANE",
    desc: "Model freight corridors, expose Class 8 charging gaps, and produce an executive-ready opportunity briefing.",
    active: true,
  },
  {
    key: "fleet_manager",
    icon: Users,
    index: "02",
    title: "Fleet Manager",
    eyebrow: "COMING SOON",
    desc: "Manage trucks, depots, drivers, assignments, charging windows, and operating performance.",
    active: false,
  },
  {
    key: "driver",
    icon: Truck,
    index: "03",
    title: "Driver",
    eyebrow: "COMING SOON",
    desc: "Run a battery-aware day plan with Class 8 routing, charging, dwell, and amenity intelligence.",
    active: false,
  },
];

export default function RoleSelectPage() {
  return (
    <main id="main-content" tabIndex={-1} className="fv-role-shell">
      <div className="fv-command-grid" aria-hidden="true" />

      <header className="fv-role-topbar">
        <Link href="/" aria-label="Back to FleetVolt home">
          <FleetVoltBrand size="standard" />
        </Link>
        <div className="fv-role-system-state">
          <i aria-hidden="true" />
          SYSTEM READY / ALPHA 01
        </div>
      </header>

      <section className="fv-role-stage" aria-labelledby="role-title">
        <div className="fv-role-heading">
          <div>
            <span className="fv-command-kicker">FLEETVOLT ACCESS CONTROL / 001</span>
            <h1 id="role-title">Choose your operating lane.</h1>
          </div>
          <p>
            One platform. Three purpose-built command environments. CaaS Intelligence
            is open for the Monday Alpha; fleet and driver operations remain protected
            while their workflows are completed.
          </p>
        </div>

        <div className="fv-role-grid">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const content = (
              <>
                <span className="fv-role-card-index">{role.index}</span>
                <span className="fv-role-card-icon"><Icon size={25} /></span>
                <span className="fv-role-card-copy">
                  <span className="fv-role-card-status">{role.eyebrow}</span>
                  <strong>{role.title}</strong>
                  <span>{role.desc}</span>
                </span>
                <span className="fv-role-card-action" aria-hidden="true">
                  {role.active ? <ArrowRight size={19} /> : <LockKeyhole size={17} />}
                </span>
              </>
            );

            return role.active ? (
              <a
                key={role.key}
                href={ALPHA_AUTH_BYPASS ? "/caas" : `/api/auth/sign-in?role=${role.key}`}
                className="fv-role-card fv-role-card--active"
              >
                {content}
              </a>
            ) : (
              <div key={role.key} className="fv-role-card fv-role-card--locked" aria-disabled="true">
                {content}
              </div>
            );
          })}
        </div>

        <aside className="fv-role-briefing">
          <FileBarChart size={20} />
          <div>
            <span>NO LOGIN REQUIRED</span>
            <strong>Preview the full FleetVolt Executive Briefing</strong>
          </div>
          <Link href="/briefing">Open report <ArrowRight size={15} /></Link>
        </aside>

        <footer className="fv-role-security">
          <span><ShieldCheck size={14} /> {ALPHA_AUTH_BYPASS ? "ALPHA ACCESS OPEN / WORKOS READY FOR LAUNCH" : "WORKOS AUTHKIT / SSO READY / MFA SUPPORTED"}</span>
          <span>POWERED BY CLEVERWORK / ZERO EMISSION ADVISORS</span>
          <Link href="/"><ArrowLeft size={13} /> Return home</Link>
        </footer>
      </section>
    </main>
  );
}
