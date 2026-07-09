// Catalog-vehicle ingest mutations — batched, idempotent internalMutation that
// upserts HVIP catalog rows by slug (by_slug index). Mirrors trucks/carriers.
//
// Provenance: {source:"ESTIMATE", fetchedAt, usefulnessScore:8,
// matchMethod:"hvip_csv", method:"extracted", inputs:[...]} — official HVIP CSV
// extracted and enriched with physics-truck links; not direct measurement.
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const emissionsAnnual = v.union(
  v.object({
    milesPerYear: v.number(),
    diesel: v.object({
      co2eT: v.number(),
      noxKg: v.number(),
      pm25Kg: v.number(),
    }),
    bev: v.object({
      co2eT: v.number(),
      noxKg: v.number(),
      pm25Kg: v.number(),
    }),
    avoided: v.object({
      co2eT: v.number(),
      noxKg: v.number(),
      pm25Kg: v.number(),
      pctCo2e: v.number(),
    }),
  }),
  v.null(),
);

export const catalogFields = {
  slug: v.string(),
  oem: v.string(),
  model: v.string(),
  displayName: v.string(),
  vehicleClassLabel: v.string(),
  category: v.string(),
  technology: v.string(),
  packKwh: v.union(v.number(), v.null()),
  hvipIncentiveUsd: v.union(v.number(), v.null()),
  hvipVehicleUrl: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
  kwhPerMiCombined: v.union(v.number(), v.null()),
  kwhPerMiFullyLaden: v.union(v.number(), v.null()),
  kwhPerMiDrayage: v.union(v.number(), v.null()),
  peerKwhPerMiMin: v.union(v.number(), v.null()),
  peerKwhPerMiMax: v.union(v.number(), v.null()),
  annualEnergyCostUsd: v.union(v.number(), v.null()),
  emissionsAnnual,
  physicsTruckSlug: v.union(v.string(), v.null()),
  physicsTruckName: v.union(v.string(), v.null()),
  energyEstimatePending: v.boolean(),
  assumptionsHash: v.string(),
};

export const catalogRow = v.object(catalogFields);

export const upsertCatalogBatch = internalMutation({
  args: {
    rows: v.array(catalogRow),
    fetchedAt: v.number(),
    usefulnessScore: v.number(),
  },
  returns: v.object({
    inserted: v.number(),
    patched: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, { rows, fetchedAt, usefulnessScore }) => {
    let inserted = 0;
    let patched = 0;

    for (const r of rows) {
      const doc = {
        slug: r.slug,
        oem: r.oem,
        model: r.model,
        displayName: r.displayName,
        vehicleClassLabel: r.vehicleClassLabel,
        category: r.category,
        technology: r.technology,
        packKwh: r.packKwh,
        hvipIncentiveUsd: r.hvipIncentiveUsd,
        hvipVehicleUrl: r.hvipVehicleUrl,
        imageUrl: r.imageUrl,
        kwhPerMiCombined: r.kwhPerMiCombined,
        kwhPerMiFullyLaden: r.kwhPerMiFullyLaden,
        kwhPerMiDrayage: r.kwhPerMiDrayage,
        peerKwhPerMiMin: r.peerKwhPerMiMin,
        peerKwhPerMiMax: r.peerKwhPerMiMax,
        annualEnergyCostUsd: r.annualEnergyCostUsd,
        emissionsAnnual: r.emissionsAnnual,
        physicsTruckSlug: r.physicsTruckSlug,
        physicsTruckName: r.physicsTruckName,
        energyEstimatePending: r.energyEstimatePending,
        assumptionsHash: r.assumptionsHash,
        provenance: {
          source: "ESTIMATE" as const,
          fetchedAt,
          usefulnessScore,
          matchMethod: "hvip_csv",
          method: "extracted" as const,
          inputs: ["californiahvip_eligible_vehicles_csv", "data/trucks"],
        },
      };

      const existing = await ctx.db
        .query("catalogVehicles")
        .withIndex("by_slug", (q) => q.eq("slug", r.slug))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, doc);
        patched += 1;
      } else {
        await ctx.db.insert("catalogVehicles", doc);
        inserted += 1;
      }
    }

    return { inserted, patched, total: rows.length };
  },
});

/** Patch scrape-derived media fields without rewriting the full HVIP row. */
export const patchCatalogMediaBatch = internalMutation({
  args: {
    patches: v.array(
      v.object({
        slug: v.string(),
        imageUrl: v.union(v.string(), v.null()),
        galleryUrls: v.optional(v.array(v.string())),
        scrapedAt: v.optional(v.number()),
      }),
    ),
  },
  returns: v.object({
    patched: v.number(),
    missing: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, { patches }) => {
    let patched = 0;
    let missing = 0;

    for (const p of patches) {
      const existing = await ctx.db
        .query("catalogVehicles")
        .withIndex("by_slug", (q) => q.eq("slug", p.slug))
        .unique();

      if (!existing) {
        missing += 1;
        continue;
      }

      const next: {
        imageUrl: string | null;
        galleryUrls?: string[];
        scrapedAt?: number;
      } = {
        imageUrl: p.imageUrl,
      };
      if (p.galleryUrls !== undefined) next.galleryUrls = p.galleryUrls;
      if (p.scrapedAt !== undefined) next.scrapedAt = p.scrapedAt;

      await ctx.db.patch(existing._id, next);
      patched += 1;
    }

    return { patched, missing, total: patches.length };
  },
});
