import { NextRequest } from "next/server";
import { authkit, handleAuthkitHeaders } from "@workos-inc/authkit-nextjs";

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

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default async function proxy(request: NextRequest) {
  const { session, headers } = await authkit(request);
  const { pathname } = request.nextUrl;

  // Local Playwright receives the real AuthKit request headers but bypasses
  // the external sign-in redirect. This never activates without the server
  // environment flag and the explicit e2e cookie.
  if (
    process.env.FLEETVOLT_E2E === "1" &&
    request.cookies.get("fv_e2e")?.value === "1"
  ) {
    return handleAuthkitHeaders(request, headers);
  }

  if (isProtected(pathname) && !session.user) {
    const welcomeUrl = new URL("/", request.url);
    welcomeUrl.searchParams.set("redirect", pathname);
    return handleAuthkitHeaders(request, headers, { redirect: welcomeUrl });
  }

  return handleAuthkitHeaders(request, headers);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf)$).*)",
  ],
};
