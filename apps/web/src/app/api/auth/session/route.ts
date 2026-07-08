import { NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";

export const runtime = "nodejs";

export async function GET() {
  // Playwright / local e2e: skip WorkOS withAuth (requires AuthKit middleware coverage).
  if (process.env.FLEETVOLT_E2E === "1") {
    return NextResponse.json({ accessToken: null, authenticated: false });
  }
  const session = await withAuth({ ensureSignedIn: false });
  if (!session.user || !session.accessToken) {
    return NextResponse.json({ token: null, authenticated: false });
  }
  return NextResponse.json({
    token: session.accessToken,
    authenticated: true,
    user: session.user,
  });
}
