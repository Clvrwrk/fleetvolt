"use client";

// ── Phase 16 / Wave 1: Authenticated Convex provider ─────────────────────────
//
// Swapped from plain ConvexProvider to ConvexProviderWithAuth. The useAuth
// bridge below fetches the WorkOS AuthKit JWT from the /api/auth/session
// endpoint and feeds it to the Convex client, enabling authenticated Convex
// queries (e.g., authKit.getAuthUser(ctx) in convex/users/queries.ts).
//
// The ConvexReactClient is instantiated at MODULE SCOPE (once), not inside the
// component body, to avoid reconnect storms on re-render (Pitfall #5).
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { ReactNode, useCallback, useMemo } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export { convex };

// useAuth bridge for ConvexProviderWithAuth.
//
// ConvexProviderWithAuth expects a useAuth() hook that returns:
//   { isLoading, isAuthenticated, fetchAccessToken }
//
// We determine auth state by checking for the presence of an auth cookie.
// When Convex requests an access token, we fetch it from the WorkOS token
// endpoint (or our own /api/auth/session route). For now, we use a simple
// cookie-presence check + fetch from the callback-set session.
//
// NOTE: The @convex-dev/workos-authkit component handles the actual JWT
// exchange via Convex actions. On the client side, the Convex client receives
// the JWT via this fetchAccessToken callback.
function useAuthFromWorkOS() {
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        // The WorkOS AuthKit component sets the session cookie via the callback
        // flow. Convex's setAuth uses this token to authenticate queries.
        // We fetch from our API route that returns the token.
        const res = await fetch("/api/auth/session", {
          headers: { "Content-Type": "application/json" },
          cache: forceRefreshToken ? "no-store" : "default",
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.token ?? null;
      } catch {
        return null;
      }
    },
    [],
  );

  // We can't know synchronously whether the user is authenticated without
  // checking cookies. We use the cookie presence as a heuristic — the actual
  // auth state is resolved by Convex when the token is fetched.
  const isAuthenticated =
    typeof document !== "undefined" &&
    (document.cookie.includes("fv_session") ||
      document.cookie.includes("__session") ||
      document.cookie.includes("wos-") ||
      document.cookie.includes("__authkit"));

  return useMemo(
    () => ({
      isLoading: false,
      isAuthenticated,
      fetchAccessToken,
    }),
    [isAuthenticated, fetchAccessToken],
  );
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useAuthFromWorkOS}>
      {children}
    </ConvexProviderWithAuth>
  );
}
