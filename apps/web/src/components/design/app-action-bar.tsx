"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/pulse", label: "Freight Pulse" },
  { href: "/unit", label: "Configure Truck Unit" },
  { href: "/load", label: "Configure Load" },
  { href: "/driver", label: "Driver Preferences" },
  { href: "/network", label: "Explore SoCal Chargers" },
  { href: "/planner", label: "Route Planner" },
] as const;

const KPI_STRIP = [
  { label: "ACTIVE CORRIDORS", value: "14" },
  { label: "AVG SAVINGS VS DIESEL", value: "62%" },
  { label: "CHARGERS MODELED", value: "1,847" },
  { label: "LAST SIMULATION", value: "2h AGO" },
] as const;

export function AppActionBar() {
  const pathname = usePathname();

  return (
    <footer className="fv-action-bar">
      <div className="fv-action-bar-actions">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`fv-btn-secondary no-underline ${pathname === item.href ? "ring-1 ring-[#4c8fb8]/40" : ""}`}
          >
            {item.label}
          </Link>
        ))}
        <Link href="/status" className="fv-btn-secondary no-underline opacity-70">
          Stack Status
        </Link>
      </div>
      <div className="hidden gap-5 font-mono xl:flex">
        {KPI_STRIP.map((kpi) => (
          <div key={kpi.label} className="text-right">
            <div className="text-[8.5px] tracking-wide text-[#9a9aa2]">
              {kpi.label}
            </div>
            <div className="text-base font-semibold text-[#1a1a1e]">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}
