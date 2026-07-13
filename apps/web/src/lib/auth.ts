"use client";

import { useCallback, useMemo } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// ── Phase 16 / Wave 1: Session-based auth (replaces sessionStorage) ──────────
//
// useWorkOSAuth now uses Convex AuthKit's auth state (useConvexAuth) to
// determine authentication status, and queries the WorkOS user + userAccounts
// row from Convex. No sessionStorage. No localStorage for auth tokens.
//
// The ConvexClientProvider must wrap the app in ConvexProviderWithAuth (with
// useAuthFromAuthKit bridge) for useConvexAuth() to work. See
// ConvexClientProvider.tsx.
//
// Role storage:
//   - The selected role is stored in a short-lived cookie "fv_selected_role"
//     by the role-select page before redirecting to WorkOS.
//   - After callback, the role is read and persisted to userAccounts via
//     the Convex upsertUserAccount mutation (Wave 2 callback rewrite).
//   - useUserRole() below queries userAccounts to return the current role.

const WORKOS_CLIENT_ID = process.env.NEXT_PUBLIC_WORKOS_CLIENT_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export type FleetVoltRole = "driver" | "fleet_manager" | "caas";

export type AuthUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
};

export function useWorkOSAuth() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();

  // Query the WorkOS user from the AuthKit component (null if not authenticated)
  const workosUser = useQuery(
    api.users.queries.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );

  // Query our userAccounts row for role/displayName/companyName
  const userAccount = useQuery(
    api.users.queries.getUserAccount,
    isAuthenticated ? {} : "skip",
  );

  const loading = authLoading || (isAuthenticated && workosUser === undefined);

  const user: AuthUser | null = useMemo(() => {
    if (!workosUser) return null;
    return {
      id: workosUser.id,
      email: workosUser.email,
      firstName: workosUser.firstName ?? undefined,
      lastName: workosUser.lastName ?? undefined,
      profilePictureUrl: workosUser.profilePictureUrl ?? undefined,
    };
  }, [workosUser]);

  const role: FleetVoltRole | null = useMemo(() => {
    if (!userAccount) return null;
    return userAccount.role;
  }, [userAccount]);

  const displayName: string | null = useMemo(() => {
    if (!userAccount && !user) return null;
    if (userAccount?.displayName) return userAccount.displayName;
    if (user?.firstName) {
      return user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName;
    }
    return user?.email ?? null;
  }, [userAccount, user]);

  const signIn = useCallback((selectedRole?: FleetVoltRole) => {
    // If a role was selected, store it in a short-lived cookie so the callback
    // can read it after WorkOS redirect
    if (selectedRole) {
      document.cookie = `fv_selected_role=${selectedRole}; path=/; max-age=600; SameSite=Lax`;
    }

    // Use the official WorkOS AuthKit Next.js server route so PKCE/CSRF cookies
    // are set and the callback can establish the app session. Manual client-side
    // AuthKit URLs do not create the verifier cookie and cause redirect loops.
    const signInUrl = new URL("/api/auth/sign-in", window.location.origin);
    if (selectedRole) signInUrl.searchParams.set("role", selectedRole);
    window.location.href = signInUrl.toString();
  }, []);

  const signOut = useCallback(() => {
    // Clear our local role cookie and use the official AuthKit sign-out route
    // so the encrypted WorkOS session cookie is removed correctly.
    document.cookie = "fv_selected_role=; path=/; max-age=0";
    window.location.href = "/api/auth/sign-out";
  }, []);

  return {
    user,
    loading,
    isAuthenticated,
    role,
    displayName,
    userAccount,
    signIn,
    signOut,
  };
}

// ── useUserRole hook ─────────────────────────────────────────────────────────
//
// Returns the current user's role from the userAccounts table via Convex.
// Returns { role, loading } where role is "driver" | "fleet_manager" | "caas" | null.
//
// This is a standalone hook that can be used without the full useWorkOSAuth
// (e.g., in the Sidebar or AppShell where only the role is needed).

export function useUserRole() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const userAccount = useQuery(
    api.users.queries.getUserAccount,
    isAuthenticated ? {} : "skip",
  );

  const loading = authLoading || (isAuthenticated && userAccount === undefined);
  const role: FleetVoltRole | null = userAccount?.role ?? null;

  return { role, loading };
}

export { WORKOS_CLIENT_ID, REDIRECT_URI, APP_URL };
