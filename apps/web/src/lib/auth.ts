"use client";

import { useEffect, useState, useCallback } from "react";

// WorkOS AuthKit client-side helper.
// Uses the AuthKit JS SDK loaded via script tag, or falls back to
// redirect-based auth via the WorkOS hosted login page.

const WORKOS_CLIENT_ID = process.env.NEXT_PUBLIC_WORKOS_CLIENT_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI || `${window.location.origin}/callback`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

export function useWorkOSAuth() {
  const [user, setUser] = useState<null | { id: string; email: string; firstName?: string; lastName?: string }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session (stored by WorkOS callback)
    const stored = sessionStorage.getItem("fleetvolt_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch { /* invalid session */ }
    }
    setLoading(false);
  }, []);

  const signIn = useCallback(() => {
    // Redirect to WorkOS hosted login
    const authUrl = new URL("https://auth.workos.com/user_management/authorize");
    authUrl.searchParams.set("client_id", WORKOS_CLIENT_ID || "");
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("provider", "authkit");
    window.location.href = authUrl.toString();
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem("fleetvolt_user");
    setUser(null);
    // Optionally redirect to WorkOS logout
    const logoutUrl = new URL("https://auth.workos.com/user_management/sessions/logout");
    logoutUrl.searchParams.set("client_id", WORKOS_CLIENT_ID || "");
    window.location.href = logoutUrl.toString();
  }, []);

  return { user, loading, signIn, signOut };
}

export { WORKOS_CLIENT_ID, REDIRECT_URI, APP_URL };
