"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Settings, LogOut, CircleUser } from "lucide-react";
import { useWorkOSAuth, type FleetVoltRole } from "@/lib/auth";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { cn } from "@/lib/utils";

// ── Phase 16 / Wave 1: UserMenu ──────────────────────────────────────────────
//
// Top-right user identity component for every authenticated page.
// Shows: [Avatar] [Name] [Role Badge]
// Click → dropdown: Settings (link), Sign Out (calls signOut)
//
// Role badge colors (Brand Bible):
//   Driver         → Blueprint Blue  #4C8FB8
//   Fleet Manager  → Signal Green    #3F9B6B
//   CaaS           → Caution Amber   #B8874C
//
// Avatar: 36px circle. If user has a profilePictureUrl, show it.
// Otherwise, show initials on a role-colored background.
//
// Dropdown: SkeuomorphicCard panel. Closes on click-outside or Escape.

const ROLE_COLORS: Record<FleetVoltRole, string> = {
  driver: "var(--fv-blueprint-blue)",
  fleet_manager: "var(--fv-signal-green)",
  caas: "var(--fv-caution-amber)",
};

const ROLE_LABELS: Record<FleetVoltRole, string> = {
  driver: "Driver",
  fleet_manager: "Fleet Manager",
  caas: "CaaS",
};

function getInitials(firstName?: string | null, lastName?: string | null, email?: string): string {
  if (firstName) {
    const last = lastName ? lastName.charAt(0) : "";
    return (firstName.charAt(0) + last).toUpperCase();
  }
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  return "?";
}

export function UserMenu() {
  const { user, loading, isAuthenticated, displayName, role, signOut } =
    useWorkOSAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open]);

  const handleSignOut = useCallback(() => {
    setOpen(false);
    signOut();
  }, [signOut]);

  // Loading state — skeleton avatar
  if (loading) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-full bg-[var(--fv-fog)] animate-pulse" />
        <div className="hidden sm:flex flex-col gap-1">
          <div className="h-3 w-20 rounded bg-[var(--fv-fog)] animate-pulse" />
          <div className="h-2.5 w-14 rounded bg-[var(--fv-fog)] animate-pulse" />
        </div>
      </div>
    );
  }

  // Logged out — return null (layout shows Sign In button instead)
  if (!isAuthenticated || !user) {
    return null;
  }

  const initials = getInitials(user.firstName, user.lastName, user.email);
  const roleColor = role ? ROLE_COLORS[role] : "var(--fv-steel)";
  const roleLabel = role ? ROLE_LABELS[role] : null;
  const name =
    displayName ||
    (user.firstName
      ? user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName
      : user.email);

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger: avatar + name + role badge */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-[var(--fv-fog)]"
        aria-label="User menu"
        aria-expanded={open}
      >
        {/* Avatar */}
        {user.profilePictureUrl ? (
          <img
            src={user.profilePictureUrl}
            alt={name || "User"}
            className="h-9 w-9 rounded-full object-cover border border-[var(--fv-steel)]/30"
          />
        ) : (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold text-white"
            style={{ background: roleColor }}
          >
            {initials}
          </div>
        )}

        {/* Name + role (hidden on mobile) */}
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-[13px] font-medium text-[var(--fv-graphite)]">
            {name}
          </span>
          {roleLabel && (
            <span
              className="text-[10px] font-mono font-semibold uppercase tracking-wider"
              style={{ color: roleColor }}
            >
              {roleLabel}
            </span>
          )}
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 min-w-[200px]">
          <SkeuomorphicCard padding="sm" className="!p-1.5">
            {/* User info header */}
            <div className="flex items-center gap-2.5 border-b border-[var(--fv-steel)]/15 px-2 py-2 pb-2.5 mb-1">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ background: roleColor }}
              >
                {initials}
              </div>
              <div className="flex flex-col leading-tight overflow-hidden">
                <span className="text-[12px] font-medium text-[var(--fv-graphite)] truncate">
                  {name}
                </span>
                <span className="text-[10px] text-[var(--fv-steel)] truncate font-mono">
                  {user.email}
                </span>
              </div>
            </div>

            {/* Menu items */}
            <button
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-[13px] text-[var(--fv-graphite)] transition-colors hover:bg-[var(--fv-fog)]"
              onClick={() => setOpen(false)}
            >
              <Settings size={15} className="text-[var(--fv-steel)]" />
              Settings
            </button>

            <button
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-[13px] text-[var(--fv-graphite)] transition-colors hover:bg-[var(--fv-fog)]"
              onClick={handleSignOut}
            >
              <LogOut size={15} className="text-[var(--fv-steel)]" />
              Sign Out
            </button>
          </SkeuomorphicCard>
        </div>
      )}
    </div>
  );
}
