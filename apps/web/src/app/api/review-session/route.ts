import { NextRequest, NextResponse } from "next/server";
import { canonicalAuthOrigin } from "@/lib/auth-origin";
import { safeReviewPath } from "@/lib/review-session";

export const runtime = "nodejs";

/**
 * Local-only visual handoff entrypoint. The route is inert unless the server
 * was explicitly launched in FleetVolt's E2E/review mode.
 */
export async function GET(request: NextRequest) {
  if (process.env.FLEETVOLT_E2E !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // In a container, request.url carries the internal listener (port 3000).
  // Preserve the host the reviewer actually used so the redirect stays on the
  // published Docker port, and so trusted-LAN review links keep their LAN host.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const requestHost = forwardedHost ?? request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const requestProtocol = forwardedProtocol ?? request.nextUrl.protocol.slice(0, -1);
  const reviewOrigin = requestHost
    ? `${requestProtocol}://${requestHost}`
    : canonicalAuthOrigin(request.url);

  const response = NextResponse.redirect(
    new URL(
      safeReviewPath(request.nextUrl.searchParams.get("next")),
      reviewOrigin,
    ),
  );
  response.cookies.set("fv_e2e", "1", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return response;
}
