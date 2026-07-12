"use client";

import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { ReactNode, useCallback, useMemo } from "react";
import {
  AuthKitProvider,
  useAccessToken,
  useAuth,
} from "@workos-inc/authkit-nextjs/components";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export { convex };

/** Official WorkOS AuthKit → Convex token bridge. */
function useAuthFromAuthKit() {
  const { user, loading: isLoading } = useAuth();
  const { getAccessToken, refresh } = useAccessToken();
  const isAuthenticated = Boolean(user);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken?: boolean } = {}) => {
      if (!user) return null;
      try {
        return forceRefreshToken
          ? ((await refresh()) ?? null)
          : ((await getAccessToken()) ?? null);
      } catch (error) {
        console.error("[auth] Failed to get WorkOS access token", error);
        return null;
      }
    },
    [getAccessToken, refresh, user],
  );

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated,
      fetchAccessToken,
    }),
    [fetchAccessToken, isAuthenticated, isLoading],
  );
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <AuthKitProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromAuthKit}>
        {children}
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  );
}
