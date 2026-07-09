import { ConvexHttpClient } from "convex/browser";
import { handleAuth } from "@workos-inc/authkit-nextjs";
import { api } from "../../../../../convex/_generated/api";

const ROLE_HOME: Record<string, string> = {
  driver: "/driver",
  fleet_manager: "/fleet",
  caas: "/caas",
};

function roleFromState(state?: string): "driver" | "fleet_manager" | "caas" {
  if (state === "driver" || state === "fleet_manager" || state === "caas") return state;
  return "driver";
}

export const GET = handleAuth({
  returnPathname: "/driver",
  async onSuccess({ user, state }) {
    const role = roleFromState(state);
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      console.warn("[auth/callback] NEXT_PUBLIC_CONVEX_URL missing; skipping user upsert");
      return;
    }
    try {
      const client = new ConvexHttpClient(convexUrl);
      await client.mutation(api["userData/mutations"].upsertUserAccountFromWorkOS, {
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
  onError(error) {
    console.error("[auth/callback] handleAuth failed", error);
    return undefined;
  },
});
