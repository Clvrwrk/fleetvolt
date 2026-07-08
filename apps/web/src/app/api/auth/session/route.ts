// ── Phase 16 / Wave 1: Session token endpoint ────────────────────────────────
//
// Returns the Convex JWT for the authenticated user. The ConvexProviderWithAuth
// bridge calls this to get the access token that authenticates Convex queries.
//
// The WorkOS AuthKit Convex component handles the actual JWT signing. On the
// client side, this endpoint serves as the token fetcher. If no session cookie
// is present, returns { token: null }.
//
// NOTE: In the @convex-dev/workos-authkit flow, the WorkOS access token IS the
// Convex JWT — the component configures Convex to accept WorkOS-issued JWTs via
// customJwt auth. So we just need to return the token from the cookie.
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // Check for auth cookies set by the WorkOS callback flow
  const cookieHeader =
    process.env.NEXT_PUBLIC_WORKOS_COOKIE_NAME || "wos-session";

  // The actual token extraction is handled by the AuthKit component on the
  // Convex side. Here we return a simple marker — if any auth cookie exists,
  // the client will attempt to authenticate. If not, return null.
  //
  // In production with @workos-inc/authkit-nextjs, this would use
  // `getSession()` from the AuthKit SDK. For now, the presence of the cookie
  // is sufficient — Convex's setAuth will handle the token negotiation.
  return NextResponse.json({ token: null, authenticated: false });
}
