import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { handleAuth } from "@workos-inc/authkit-nextjs";
import { api } from "../../../../../convex/_generated/api";
import { browserRequestOrigin } from "@/lib/auth-origin";

function roleFromState(state?: string): "driver" | "fleet_manager" | "caas" {
  if (state === "driver" || state === "fleet_manager" || state === "caas") return state;
  return "driver";
}

export async function GET(request: NextRequest) {
  const browserOrigin = browserRequestOrigin(
    request.url,
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    request.headers.get("x-forwarded-proto"),
  );

  return handleAuth({
    baseURL: browserOrigin,
    async onSuccess({ user, state }) {
      const role = roleFromState(state);
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
      if (!convexUrl) {
        console.warn("[auth/callback] NEXT_PUBLIC_CONVEX_URL missing; skipping user upsert");
        return;
      }
      try {
        const client = new ConvexHttpClient(convexUrl);
        await client.mutation(api.userData.mutations.upsertUserAccountFromWorkOS, {
          userId: user.id,
          role,
          email: user.email,
          displayName:
            [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
        });
      } catch (err) {
        // Never fail the WorkOS session over a Convex profile upsert.
        console.error("[auth/callback] upsertUserAccountFromWorkOS failed", err);
      }
    },
    onError({ error }) {
      console.error("[auth/callback] handleAuth failed", error);
      const retryUrl = new URL("/", browserOrigin);
      retryUrl.searchParams.set("auth_error", "callback_failed");
      return NextResponse.redirect(retryUrl);
    },
  })(request);
}
