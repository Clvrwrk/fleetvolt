import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  query,
  type QueryCtx,
} from "../_generated/server";
import { authKit } from "../auth";
import { haversineMeters } from "../lib/haversine";
import {
  buildRouteManifest,
  dedupeRecentRoutes,
  type RecentRouteCandidate,
} from "./catalogPolicy";

const ALPHA_PORTS = new Set(["POLB", "POLA", "OAK", "SF", "HUE", "SD"]);

const placeValidator = v.object({
  label: v.string(),
  latitude: v.number(),
  longitude: v.number(),
  kind: v.union(
    v.literal("address"),
    v.literal("port"),
    v.literal("charger"),
    v.literal("parking"),
    v.literal("fleet-yard"),
    v.literal("carrier"),
    v.literal("poi"),
    v.literal("geo-region"),
    v.literal("manual"),
  ),
  source: v.union(
    v.literal("fleetvolt"),
    v.literal("google"),
    v.literal("manual"),
  ),
  id: v.optional(v.string()),
});

type RoutePair = {
  generatorId: string;
  generatorName: string;
  portCode: string;
  origin: {
    label: string;
    latitude: number;
    longitude: number;
    kind: "address" | "port" | "charger" | "parking" | "fleet-yard" | "carrier" | "poi" | "geo-region" | "manual";
    source: "fleetvolt" | "google" | "manual";
    id?: string;
  };
  destination: {
    label: string;
    latitude: number;
    longitude: number;
    kind: "address" | "port" | "charger" | "parking" | "fleet-yard" | "carrier" | "poi" | "geo-region" | "manual";
    source: "fleetvolt" | "google" | "manual";
    id?: string;
  };
};

type CatalogStoredPlace = {
  label: string;
  latitude: number;
  longitude: number;
  kind: string;
  source: string;
  id?: string;
};

function requestHashFromGeometry(geometry: unknown): string | null {
  if (!geometry || typeof geometry !== "object") return null;
  const metadata = (geometry as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const hash = (metadata as { requestHash?: unknown }).requestHash;
  return typeof hash === "string" && hash.length > 0 ? hash : null;
}

function usableCoordinates(geometry: unknown): boolean {
  if (!geometry || typeof geometry !== "object") return false;
  const coordinates = (geometry as { coordinates?: unknown }).coordinates;
  return Array.isArray(coordinates) && coordinates.length >= 8;
}

function geometryResult(row: Doc<"routeGeometries">) {
  return {
    provider: row.provider,
    coordinates: row.coordinates,
    distanceMeters: row.distanceMeters,
    durationSeconds: row.durationSeconds,
    encodedPolyline: row.encodedPolyline,
    warnings: row.warnings,
    metadata: {
      ...(row.providerMetadata ?? {}),
      requestHash: row.requestHash,
      cacheStatus: "catalog-hit",
      freshness: row.expiresAt > Date.now() ? "fresh" : "stale",
      pulledAt: row.pulledAt,
      expiresAt: row.expiresAt,
      refreshCount: row.refreshCount,
    },
  };
}

async function catalogItem(
  ctx: QueryCtx,
  args: {
    id: string;
    label: string;
    origin: CatalogStoredPlace;
    destination: CatalogStoredPlace;
    requestHash: string;
    createdAt: number;
  },
) {
  const geometry = (await ctx.db
    .query("routeGeometries")
    .withIndex("by_requestHash", (q) =>
      q.eq("requestHash", args.requestHash),
    )
    .unique()) as Doc<"routeGeometries"> | null;
  if (!geometry || geometry.coordinates.length < 8) return null;
  const enrichment = (await ctx.db
    .query("routeEnrichments")
    .withIndex("by_requestHash", (q) =>
      q.eq("requestHash", args.requestHash),
    )
    .unique()) as Doc<"routeEnrichments"> | null;
  return {
    ...args,
    geometry: geometryResult(geometry),
    manifest: buildRouteManifest({
      distanceMeters: geometry.distanceMeters,
      enrichmentSnapshot: enrichment?.snapshot,
      enrichmentExpiresAt: enrichment?.expiresAt,
      now: Date.now(),
    }),
  };
}

export const resolveGeneratorRoute = internalQuery({
  args: {
    generatorId: v.string(),
    portCode: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<RoutePair | null> => {
    const generator = await ctx.db
      .query("trafficGenerators")
      .withIndex("by_generatorId", (q) =>
        q.eq("generatorId", args.generatorId),
      )
      .unique();
    if (!generator) return null;

    const requestedCode = args.portCode ?? generator.portCode;
    let port = requestedCode
      ? await ctx.db
          .query("ports")
          .withIndex("by_code", (q) => q.eq("code", requestedCode))
          .unique()
      : null;
    if (port && !ALPHA_PORTS.has(port.code)) port = null;

    if (!port) {
      const candidates = (await ctx.db.query("ports").collect()).filter((row) =>
        ALPHA_PORTS.has(row.code),
      );
      port =
        candidates
          .map((row) => ({
            row,
            distance: haversineMeters(row.location, generator.location),
          }))
          .sort((a, b) => a.distance - b.distance)[0]?.row ?? null;
    }
    if (!port) return null;

    return {
      generatorId: generator.generatorId,
      generatorName: generator.name,
      portCode: port.code,
      origin: {
        id: port.code,
        label: port.name,
        latitude: port.location.lat,
        longitude: port.location.lng,
        kind: "port",
        source: "fleetvolt",
      },
      destination: {
        id: generator.generatorId,
        label: generator.name,
        latitude: generator.location.lat,
        longitude: generator.location.lng,
        kind: "poi",
        source: "fleetvolt",
      },
    };
  },
});

export const upsertPromoted = internalMutation({
  args: {
    catalogId: v.string(),
    name: v.string(),
    sortOrder: v.number(),
    generatorId: v.string(),
    originPortCode: v.string(),
    origin: placeValidator,
    destination: placeValidator,
    requestHash: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("routeCatalogEntries")
      .withIndex("by_catalogId", (q) => q.eq("catalogId", args.catalogId))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        promoted: true,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("routeCatalogEntries", {
      ...args,
      promoted: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Intentionally accepts one generator only. Alpha catalog seeding must produce
 * one auditable PTV/cache receipt per invocation; no mass pull surface exists.
 */
export const precomputeFreightPoi = action({
  args: {
    generatorId: v.string(),
    portCode: v.optional(v.string()),
    name: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    catalogId: string;
    requestHash: string;
    pointCount: number;
    geometryCacheStatus: string;
    enrichmentCacheStatus: string;
  }> => {
    const pair = await ctx.runQuery(
      internal.routes.catalog.resolveGeneratorRoute,
      { generatorId: args.generatorId, portCode: args.portCode },
    );
    if (!pair) throw new Error(`No generator/port pair for ${args.generatorId}`);

    const geometry = await ctx.runAction(api.workbench.actions.routeGeometry, {
      origin: {
        latitude: pair.origin.latitude,
        longitude: pair.origin.longitude,
      },
      destination: {
        latitude: pair.destination.latitude,
        longitude: pair.destination.longitude,
      },
      provider: "ptv",
    });
    if (!usableCoordinates(geometry)) {
      throw new Error(`PTV returned no usable road geometry for ${pair.generatorName}`);
    }
    const requestHash = requestHashFromGeometry(geometry);
    if (!requestHash) throw new Error("Road geometry is missing its request hash");

    const intelligence = await ctx.runAction(api.routes.enrichment.forRoute, {
      requestHash,
    });
    const catalogId = `${pair.portCode.toLowerCase()}-${pair.generatorId}`;
    await ctx.runMutation(internal.routes.catalog.upsertPromoted, {
      catalogId,
      name: args.name ?? `${pair.portCode} → ${pair.generatorName}`,
      sortOrder: args.sortOrder ?? 100,
      generatorId: pair.generatorId,
      originPortCode: pair.portCode,
      origin: pair.origin,
      destination: pair.destination,
      requestHash,
    });
    return {
      catalogId,
      requestHash,
      pointCount: geometry.coordinates.length,
      geometryCacheStatus: String(geometry.metadata?.cacheStatus ?? "unknown"),
      enrichmentCacheStatus: String(
        intelligence.metadata?.cacheStatus ?? "unknown",
      ),
    };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const promotedRows = await ctx.db
      .query("routeCatalogEntries")
      .withIndex("by_promoted_sortOrder", (q) => q.eq("promoted", true))
      .collect();
    promotedRows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const preconfigured = (
      await Promise.all(
        promotedRows.map((row) =>
          catalogItem(ctx, {
            id: `preconfigured:${row.catalogId}`,
            label: row.name,
            origin: row.origin,
            destination: row.destination,
            requestHash: row.requestHash,
            createdAt: row.createdAt,
          }),
        ),
      )
    ).filter((row) => row !== null);

    const authUser = await authKit.getAuthUser(ctx);
    if (!authUser) return { preconfigured, recent: [] };

    const runs = await ctx.db
      .query("workbenchRuns")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", authUser.id))
      .order("desc")
      .take(30);
    const candidates: RecentRouteCandidate[] = runs.map((run) => ({
      origin: run.origin,
      destination: run.destination,
      requestHash: requestHashFromGeometry(run.routeGeometry) ?? undefined,
      createdAt: run.createdAt,
    }));
    const deduped = dedupeRecentRoutes(candidates);
    const recent = (
      await Promise.all(
        deduped.map((row) =>
          catalogItem(ctx, {
            id: `recent:${row.requestHash}`,
            label: `${row.origin.label} → ${row.destination.label}`,
            origin: {
              ...row.origin,
              kind: "manual" as const,
              source: "fleetvolt" as const,
            },
            destination: {
              ...row.destination,
              kind: "manual" as const,
              source: "fleetvolt" as const,
            },
            requestHash: row.requestHash!,
            createdAt: row.createdAt,
          }),
        ),
      )
    ).filter((row) => row !== null);
    return { preconfigured, recent };
  },
});

/** Auditable coverage gate for the default traffic-generator route catalog. */
export const trafficGeneratorCoverage = query({
  args: {},
  handler: async (ctx) => {
    const generators = await ctx.db.query("trafficGenerators").collect();
    const promoted = await ctx.db
      .query("routeCatalogEntries")
      .withIndex("by_promoted_sortOrder", (q) => q.eq("promoted", true))
      .collect();
    const promotedByGenerator = new Map(promoted.map((row) => [row.generatorId, row]));
    const results = await Promise.all(
      generators.map(async (generator) => {
        const entry = promotedByGenerator.get(generator.generatorId);
        if (!entry) {
          return {
            generatorId: generator.generatorId,
            name: generator.name,
            portCode: generator.portCode ?? null,
            state: "missing" as const,
          };
        }
        const geometry = await ctx.db
          .query("routeGeometries")
          .withIndex("by_requestHash", (q) => q.eq("requestHash", entry.requestHash))
          .unique();
        const valid = Boolean(
          geometry &&
            geometry.provider === "ptv" &&
            geometry.coordinates.length >= 8,
        );
        return {
          generatorId: generator.generatorId,
          name: generator.name,
          portCode: entry.originPortCode,
          state: valid ? ("verified-ptv" as const) : ("invalid" as const),
        };
      }),
    );
    return {
      totalGenerators: results.length,
      verifiedPtv: results.filter((row) => row.state === "verified-ptv").length,
      invalid: results.filter((row) => row.state === "invalid").length,
      missing: results.filter((row) => row.state === "missing").length,
      complete: results.every((row) => row.state === "verified-ptv"),
      gaps: results.filter((row) => row.state !== "verified-ptv"),
    };
  },
});
