// User account queries (Phase 16 / Wave 1).
//
// These queries bridge the WorkOS AuthKit component (which stores synced WorkOS
// users in its own `users` table) with our application-level `userAccounts`
// table (which stores role, displayName, companyName).
//
// • getCurrentUser()     — returns the WorkOS-authenticated user from the
//                          AuthKit component, or null if not authenticated.
// • getUserAccount()     — returns the userAccounts row for the authenticated
//                          user, matching by WorkOS subject ID.
//
import { query } from "../_generated/server";
import { authKit } from "../auth";

/** Get the authenticated WorkOS user (from AuthKit component) or null. */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authKit.getAuthUser(ctx);
  },
});

/** Get the userAccounts row for the authenticated user, or null. */
export const getUserAccount = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authKit.getAuthUser(ctx);
    if (!authUser) return null;

    const account = await ctx.db
      .query("userAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", authUser.id))
      .first();

    return account ?? null;
  },
});
