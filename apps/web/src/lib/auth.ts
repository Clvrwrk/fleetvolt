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

function getRedirectUri() {
  if (REDIRECT_URI) return REDIRECT_URI;
  if (typeof window !== "undefined") return `${window.location.origin}/callback`;
  return "";
}

function getAppUrl() {
  if (APP_URL) return APP_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

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
    api["users/queries"].getCurrentUser,
    {},
    // Skip the query until Convex auth is established
    { skip: !isAuthenticated },
  );

  // Query our userAccounts row for role/displayName/companyName
  const userAccount = useQuery(
    api["users/queries"].getUserAccount,
    {},
    { skip: !isAuthenticated },
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

    // Redirect to WorkOS hosted login
    const authUrl = new URL("https://auth.workos.com/user_management/authorize");
    authUrl.searchParams.set("client_id", WORKOS_CLIENT_ID || "");
    authUrl.searchParams.set("redirect_uri", getRedirectUri());
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("provider", "authkit");
    // Force AuthKit to show open account creation/onboarding for first-time users.
    // Existing users can still switch to sign-in inside AuthKit.
    authUrl.searchParams.set("screen_hint", "sign-up");
    // Pass selected role in state param for the callback to read
    if (selectedRole) {
      authUrl.searchParams.set("state", selectedRole);
    }
    window.location.href = authUrl.toString();
  }, []);

  const signOut = useCallback(() => {
    // Redirect to WorkOS logout endpoint — this clears the WorkOS session.
    // The Convex auth state is cleared automatically when the cookie is gone.
    const logoutUrl = new URL(
      "https://auth.workos.com/user_management/sessions/logout",
    );
    logoutUrl.searchParams.set("client_id", WORKOS_CLIENT_ID || "");
    // Clear our local role cookie
    document.cookie = "fv_selected_role=; path=/; max-age=0";
    window.location.href = logoutUrl.toString();
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
    api["users/queries"].getUserAccount,
    {},
    { skip: !isAuthenticated },
  );

  const loading = authLoading || (isAuthenticated && userAccount === undefined);
  const role: FleetVoltRole | null = userAccount?.role ?? null;

  return { role, loading };
}

export { WORKOS_CLIENT_ID, REDIRECT_URI, APP_URL };
