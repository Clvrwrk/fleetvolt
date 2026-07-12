"use client";

import type { ReactNode } from "react";

// ── Phase 16 / Wave 3: PageHeader ───────────────────────────────────────────
//
// Shows in the top bar of AppShell.
// Displays: current page title (Inter 16px semibold) + optional breadcrumb trail.
// Breadcrumb format: "Fleet › Drivers › Add Driver"
//   — JetBrains Mono 10px Steel, separated by "›"
//
// Props:
//   title: string — page title in Inter 16px semibold
//   breadcrumbs?: string[] — breadcrumb trail (e.g. ["Fleet", "Drivers", "Add Driver"])
//
// UX audit checks addressed: NAV-3 (breadcrumbs/page title showing current location)
// UX principles: Research §A4 ("Add wayfinding before adding more links"),
//   Jakob's Law (breadcrumbs are standard in SaaS)

export interface PageHeaderProps {
  title: string;
  breadcrumbs?: string[];
  actions?: ReactNode;
}

export function PageHeader({ title, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-1 items-center justify-between gap-3 overflow-hidden">
      {/* Left: title + breadcrumbs */}
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {/* Breadcrumb trail */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1 whitespace-nowrap overflow-hidden"
          >
            {breadcrumbs.map((crumb, i) => (
              <span
                key={i}
                className="flex items-center gap-1 whitespace-nowrap"
              >
                {i > 0 && (
                  <span
                    className="text-[10px]"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      color: "var(--fv-steel)",
                    }}
                  >
                    ›
                  </span>
                )}
                <span
                  className="text-[10px]"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    color: "var(--fv-steel)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
        )}

        {/* Page title */}
        <h1
          className="truncate text-[16px] font-semibold leading-tight"
          style={{
            fontFamily: "var(--font-arcline), var(--font-inter), sans-serif",
            color: "var(--fv-graphite)",
          }}
        >
          {title}
        </h1>
      </div>

      {/* Right: optional actions slot */}
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
