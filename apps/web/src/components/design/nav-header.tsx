"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/planner", label: "Planner" },
  { href: "/driver", label: "Driver" },
  { href: "/fleet", label: "Fleet" },
  { href: "/caas", label: "CaaS" },
  { href: "/hotspot", label: "Network" },
] as const;

/**
 * NavHeader — skeuomorphic pill nav bar (Brand Guide §05 + §06).
 * Paper pill on Fog background. Logo + nav links + status indicator.
 */
export function NavHeader() {
  const pathname = usePathname();

  return (
    <header className="fv-nav-header sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-2 no-underline">
        <Image
          src="/fleetvolt-logo-horizontal-light.svg"
          alt="FleetVolt"
          width={120}
          height={28}
          priority
        />
      </Link>
      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="fv-nav-header-link"
              data-active={active}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
