"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWorkOSAuth } from "@/lib/auth";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { } = useWorkOSAuth();

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      router.replace("/role-select");
      return;
    }

    // Exchange the authorization code for a session via the WorkOS API.
    // In production, this is done server-side via the WorkOS Node SDK.
    // For now, we redirect to the role-select page with the code,
    // and the Convex action handles the token exchange.
    const WORKOS_API_KEY = process.env.WORKOS_API_KEY;
    const WORKOS_CLIENT_ID = process.env.NEXT_PUBLIC_WORKOS_CLIENT_ID;

    // Store a minimal user placeholder — the Convex WorkOS component
    // will sync the real user data via webhook.
    sessionStorage.setItem("fleetvolt_auth_code", code);
    router.replace("/role-select");
  }, [searchParams, router]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--fv-accent)] border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-[var(--fv-text-muted)]">Signing in via WorkOS…</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--fv-text-muted)]">Loading…</div>}>
      <CallbackHandler />
    </Suspense>
  );
}
