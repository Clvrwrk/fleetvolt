// Convex query — fetch a simulation by inputsHash for export.
// Reads from the simulations table (persisted in 13-02).

import { query } from "../_generated/server";
import { v } from "convex/values";

export const getSimulationForExport = query({
  args: { inputsHash: v.string() },
  handler: async (ctx, { inputsHash }) => {
    const row = await ctx.db
      .query("simulations")
      .withIndex("by_inputsHash", (q) => q.eq("inputsHash", inputsHash))
      .first();

    if (!row) {
      return null;
    }

    return {
      _id: row._id,
      inputsHash: row.inputsHash,
      status: row.status,
      physicsVersion: row.physicsVersion ?? null,
      chargerVersion: row.chargerVersion ?? null,
      inputs: row.inputs ?? null,
      results: row.results ?? null,
    };
  },
});
