// Port queries backing the Wave 2 map (FLOW-02, SHELL-06).
// Thin, unauthenticated (D-06) — no ctx.auth anywhere.
import { query } from "./_generated/server";
import { v } from "convex/values";

/** All ports (POLA/POLB/HUE/OAK/SF/SD) for AdvancedMarker rendering. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("ports").collect();
  },
});

/** Single port by its short code, via the by_code index. */
export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    return await ctx.db
      .query("ports")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
  },
});
