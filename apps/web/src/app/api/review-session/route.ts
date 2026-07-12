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

  const response = NextResponse.redirect(
    new URL(
      safeReviewPath(request.nextUrl.searchParams.get("next")),
      canonicalAuthOrigin(request.url),
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
