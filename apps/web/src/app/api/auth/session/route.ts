import { NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";

export const runtime = "nodejs";

export async function GET() {
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
