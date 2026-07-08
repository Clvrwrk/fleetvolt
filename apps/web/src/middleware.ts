import { NextRequest, NextResponse } from "next/server";

// ── Phase 16 / Wave 1: Auth Boundary ──────────────────────────────────────────
//
// Next.js middleware enforcing the auth boundary. Unauthenticated users visiting
// protected routes are redirected to / (welcome page) with a ?redirect= param.
// Public routes (/, /role-select, /callback) pass through unconditionally.
//
// The session check is cookie-presence only — NOT JWT validation. The Convex
// AuthKit component + WorkOS handle the real token exchange server-side. This
// middleware is the first line of defense: it prevents unauthenticated users
// from seeing app chrome before the client-side auth flow even loads.
//
// We check for EITHER:
//   1. The WorkOS AuthKit cookie (convex uses `__session`-style cookie names
//      set by the auth flow), OR
//   2. A custom `fv_session` cookie (set by our callback flow as a marker).
//
// If neither is present AND the path is protected, redirect to / with 307.

const PROTECTED_PREFIXES = [
  "/planner",
  "/workbench",
  "/driver",
  "/fleet",
  "/caas",
  "/hotspot",
  "/unit",
  "/load",
  "/status",
  "/pulse",
] as const;

const PUBLIC_PATHS = new Set(["/", "/role-select", "/callback"]);

function isProtected(pathname: string): boolean {
  // Exact public paths are never protected
  if (PUBLIC_PATHS.has(pathname)) return false;
  // Check if path starts with any protected prefix
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

function hasAuthCookie(request: NextRequest): boolean {
  // Check for our custom session marker cookie
  if (request.cookies.get("fv_session")) return true;
  // Check for WorkOS AuthKit cookies — the component sets these via the
  // callback flow. The exact name varies by deployment but starts with "wos-"
  // or uses the Convex auth cookie name.
  if (request.cookies.get("__session")) return true;
  // WorkOS cookies
  const allCookies = request.cookies.getAll();
  return allCookies.some(
    (c) => c.name.startsWith("wos-") || c.name.startsWith("__authkit"),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  if (!hasAuthCookie(request)) {
    const welcomeUrl = new URL("/", request.url);
    welcomeUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(welcomeUrl, 307);
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except Next.js internals, API routes, and
  // static assets. The isProtected() function handles the actual path logic.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
