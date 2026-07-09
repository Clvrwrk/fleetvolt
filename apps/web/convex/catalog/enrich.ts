"use node";

/**
 * Firecrawl enrichment for HVIP catalog vehicle detail pages.
 * Scrapes hvipVehicleUrl → imageUrl (+ galleryUrls) and patches Convex rows.
 */
import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

const SKIP_IMAGE_RE =
  /favicon|icon|logo|divider|flag|weglot|wpforms|submit-spin|ready-buyer|fleet-icon|bottom-divider|\.svg($|\?)/i;

type FirecrawlPayload = {
  markdown?: string;
  html?: string;
  metadata?: Record<string, unknown>;
  links?: string[];
};

function pickImageUrl(payload: FirecrawlPayload): {
  imageUrl: string | null;
  galleryUrls: string[];
} {
  const meta = payload.metadata ?? {};
  const og =
    (typeof meta.ogImage === "string" && meta.ogImage) ||
    (typeof meta["og:image"] === "string" && meta["og:image"]) ||
    null;

  const fromHtml = Array.from(
    (payload.html ?? "").matchAll(/<img[^>]+src=["']([^"']+)["']/gi),
  ).map((m) => m[1]!);

  const fromMd = Array.from(
    (payload.markdown ?? "").matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g),
  ).map((m) => m[1]!);

  const candidates = [og, ...fromHtml, ...fromMd].filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u),
  );

  const galleryUrls: string[] = [];
  for (const url of candidates) {
    if (SKIP_IMAGE_RE.test(url)) continue;
    if (!galleryUrls.includes(url)) galleryUrls.push(url);
  }

  return {
    imageUrl: galleryUrls[0] ?? null,
    galleryUrls: galleryUrls.slice(0, 8),
  };
}

async function scrapeHvipPage(url: string, apiKey: string): Promise<FirecrawlPayload> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "html", "links"],
      onlyMainContent: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firecrawl ${res.status}: ${body.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    success?: boolean;
    data?: FirecrawlPayload;
    markdown?: string;
    html?: string;
    metadata?: Record<string, unknown>;
  };

  return json.data ?? {
    markdown: json.markdown,
    html: json.html,
    metadata: json.metadata,
  };
}

export const enrichBatch = internalAction({
  args: {
    rows: v.array(
      v.object({
        slug: v.string(),
        hvipVehicleUrl: v.string(),
      }),
    ),
  },
  returns: v.object({
    ok: v.number(),
    failed: v.number(),
    skipped: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY is not set on the Convex deployment");
    }

    let ok = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];
    const patches: Array<{
      slug: string;
      imageUrl: string | null;
      galleryUrls: string[];
      scrapedAt: number;
    }> = [];

    for (const row of args.rows) {
      if (!row.hvipVehicleUrl) {
        skipped += 1;
        continue;
      }
      try {
        const payload = await scrapeHvipPage(row.hvipVehicleUrl, apiKey);
        const media = pickImageUrl(payload);
        patches.push({
          slug: row.slug,
          imageUrl: media.imageUrl,
          galleryUrls: media.galleryUrls,
          scrapedAt: Date.now(),
        });
        if (media.imageUrl) ok += 1;
        else {
          skipped += 1;
          errors.push(`${row.slug}: no vehicle image found`);
        }
      } catch (error) {
        failed += 1;
        errors.push(
          `${row.slug}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (patches.length > 0) {
      await ctx.runMutation(internal.catalog.mutations.patchCatalogMediaBatch, {
        patches,
      });
    }

    return { ok, failed, skipped, errors: errors.slice(0, 40) };
  },
});

/**
 * Public kickoff: load catalog rows missing images and schedule Firecrawl batches.
 * Batch size kept small to respect Firecrawl rate limits.
 */
export const startImageEnrichment = action({
  args: {
    limit: v.optional(v.number()),
    batchSize: v.optional(v.number()),
    onlyMissing: v.optional(v.boolean()),
    offset: v.optional(v.number()),
  },
  returns: v.object({
    queued: v.number(),
    batches: v.number(),
    batchSize: v.number(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 188, 250);
    const batchSize = Math.min(Math.max(args.batchSize ?? 8, 1), 20);
    const onlyMissing = args.onlyMissing ?? true;
    const offset = Math.max(args.offset ?? 0, 0);

    const rows = await ctx.runQuery(internal.catalog.enrichQueries.listForEnrichment, {
      limit,
      onlyMissing,
      offset,
    });

    let batches = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      // Stagger batches so Firecrawl is not hammered.
      await ctx.scheduler.runAfter(i * 1500, internal.catalog.enrich.enrichBatch, {
        rows: chunk,
      });
      batches += 1;
    }

    return { queued: rows.length, batches, batchSize };
  },
});
