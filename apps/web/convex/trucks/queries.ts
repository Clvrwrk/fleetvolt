// Truck-config queries (P14-TRUCKS) — the thin, unauth read surface for the
// enriched truck database. Returns all truck configs with their street metadata
// (efficiency, range, battery-health guidance) so the UI can display real-world
// performance alongside the physics-simulation params.
import { query } from "../_generated/server";

/**
 * List all truck configs with enriched street metadata. Returns all presets
 * ordered by name. Each row carries the full config (physics params + street
 * efficiency + battery-health guidance + range + sources/confidence).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const trucks = await ctx.db.query("truckConfigs").collect();
    return trucks.sort((a, b) => a.name.localeCompare(b.name));
  },
});
