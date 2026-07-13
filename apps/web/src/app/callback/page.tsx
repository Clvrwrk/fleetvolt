"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FramedPanel } from "@/components/design/framed-panel";
import { TechnicalLabel } from "@/components/design/technical-label";
import type { FleetVoltRole } from "@/lib/auth";

/* ── Role → home page map ──────────────────────────────────────────── */
const ROLE_HOME: Record<FleetVoltRole, string> = {
  driver: "/driver",
  fleet_manager: "/fleet",
  caas: "/caas",
};

/** Read the selected role from localStorage or the WorkOS "state" param. */
function getSelectedRole(stateParam: string | null): FleetVoltRole | null {
  // 1. Check the WorkOS state param (set by signIn(role) in auth.ts)
  if (
    stateParam === "driver" ||
    stateParam === "fleet_manager" ||
    stateParam === "caas"
  ) {
    return stateParam;
  }
  // 2. Check localStorage (set by the role-select page before redirect)
  try {
    const stored = localStorage.getItem("fv_selected_role");
    if (
      stored === "driver" ||
      stored === "fleet_manager" ||
      stored === "caas"
    ) {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  // 3. Check cookie (set by signIn(role) in auth.ts)
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)fv_selected_role=([^;]+)/);
    const val = match?.[1];
    if (
      val === "driver" ||
      val === "fleet_manager" ||
      val === "caas"
    ) {
      return val;
    }
  }
  return null;
}

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const upsertUserAccount = useMutation(api.userData.mutations.upsertMyUserAccount);

  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  useEffect(() => {
    // No auth code in URL — user navigated to /callback directly.
    if (!code) {
      router.replace("/role-select");
      return;
    }

    // If Convex auth is still loading, wait — the AuthKit component is
    // exchanging the authorization code for a session.
    if (authLoading) return;

    if (isAuthenticated) {
      // Session is established. Read the selected role, persist it to FleetVolt's
      // userAccounts table, then redirect to the role home. WorkOS owns auth;
      // FleetVolt owns product role/profile state.
      const role = getSelectedRole(stateParam);
      if (!role) {
        router.replace("/role-select");
        return;
      }
      void upsertUserAccount({ role, displayName: "FleetVolt User" })
        .catch((err) => {
          console.error("Failed to persist FleetVolt user account", err);
        })
        .finally(() => {
          localStorage.removeItem("fv_selected_role");
          document.cookie = "fv_selected_role=; path=/; max-age=0";
          router.replace(ROLE_HOME[role]);
        });
      return;
    }

    // Not authenticated and not loading — the code exchange may have failed
    // or the AuthKit component redirected here after setting the session.
    // Try reading the role and redirecting to the role home. If the middleware
    // doesn't see an auth cookie it will bounce back to /, which is fine.
    const role = getSelectedRole(stateParam);
    const home = role ? ROLE_HOME[role] : "/role-select";
    router.replace(home);
  }, [code, stateParam, authLoading, isAuthenticated, router, upsertUserAccount]);

  // ── Skeleton loading state (Graphite, not blue) ────────────────────
  return (
    <FramedPanel maxWidthClass="max-w-[480px]" padding="default">
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        {/* Graphite spinner */}
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--fv-graphite)] border-t-transparent"
          aria-label="Loading"
        />
        <div className="space-y-1.5">
          <p
            className="font-semibold text-[var(--fv-graphite)]"
            style={{ fontSize: "15px" }}
          >
            Signing in via WorkOS…
          </p>
          <TechnicalLabel>EXCHANGING AUTHORIZATION CODE</TechnicalLabel>
        </div>
      </div>
    </FramedPanel>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <FramedPanel maxWidthClass="max-w-[480px]" padding="default">
          <div className="flex flex-col items-center gap-6 py-12 text-center">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--fv-graphite)] border-t-transparent"
              aria-label="Loading"
            />
            <TechnicalLabel>INITIALIZING</TechnicalLabel>
          </div>
        </FramedPanel>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
