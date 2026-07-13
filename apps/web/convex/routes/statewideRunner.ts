import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import {
  action,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { haversineMeters } from "../lib/haversine";
import {
  AdminEnvelopeError,
  verifyAndConsumeAdminEnvelope,
  type AdminKeyRing,
  type AdminSignedEnvelope,
} from "./adminSignedEnvelopePolicy";
import {
  classifyDesignatedCoverage,
  coverageSummary,
  nextEligiblePair,
  sortDesignatedPairs,
  type AttemptReceipt,
  type DesignatedRoutePair,
  type PromotedRouteEvidence,
  type ProviderLease,
} from "./statewideRunnerPolicy";

const DESIGNATED_ROUTE_COUNT = 69;
const PROVIDER_LEASE_MS = 120_000;
const ALLOWED_PORTS = new Set(["POLA", "POLB", "OAK", "SD", "HUE", "SF"]);

const envelopeValidator = v.object({
  keyId: v.string(),
  issuedAt: v.number(),
  expiresAt: v.number(),
  nonce: v.string(),
  operation: v.string(),
  bodyHash: v.string(),
  signature: v.string(),
});

type DatabaseCtx = QueryCtx | MutationCtx;

type StartBody = { runId: string };
type ClaimBody = { runId: string; leaseOwner: string };
type RecordBody = {
  runId: string;
  pairKey: string;
  attempt: number;
  leaseOwner: string;
  status: "succeeded" | "failed";
  providerCall: boolean;
  cacheStatus?: string;
  errorCode?: string;
  errorSummary?: string;
};
type CoverageBody = { runId: string };

type ConsumeNonceArgs = {
  nonceDigest: string;
  keyId: string;
  operation: string;
  bodyHash: string;
  issuedAt: number;
  expiresAt: number;
  consumedAt: number;
};

const consumeNonceRef = makeFunctionReference<
  "mutation",
  ConsumeNonceArgs,
  boolean
>("routes/statewideRunner:consumeNonce");
const startOrResumeRef = makeFunctionReference<
  "mutation",
  StartBody & { now: number },
  unknown
>("routes/statewideRunner:startOrResumeInternal");
const claimNextRef = makeFunctionReference<
  "mutation",
  ClaimBody & { now: number },
  unknown
>("routes/statewideRunner:claimNextInternal");
const recordAttemptRef = makeFunctionReference<
  "mutation",
  RecordBody & { now: number },
  unknown
>("routes/statewideRunner:recordAttemptInternal");
const coverageRef = makeFunctionReference<
  "query",
  CoverageBody & { now: number },
  unknown
>("routes/statewideRunner:coverageInternal");

function boundedText(value: string | undefined, max: number): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function requireAdminKeyRing(): AdminKeyRing {
  const currentKeyId = process.env.FLEETVOLT_ADMIN_CURRENT_KEY_ID;
  const currentSecret = process.env.FLEETVOLT_ADMIN_CURRENT_SIGNING_KEY;
  const activatedAt = Number(process.env.FLEETVOLT_ADMIN_CURRENT_ACTIVATED_AT);
  if (!currentKeyId || !currentSecret || !Number.isSafeInteger(activatedAt)) {
    throw new AdminEnvelopeError("key-config-invalid");
  }

  const previousKeyId = process.env.FLEETVOLT_ADMIN_PREVIOUS_KEY_ID;
  const previousSecret = process.env.FLEETVOLT_ADMIN_PREVIOUS_SIGNING_KEY;
  const previousOverlapExpiresAt = Number(
    process.env.FLEETVOLT_ADMIN_PREVIOUS_OVERLAP_EXPIRES_AT,
  );
  const previous =
    previousKeyId &&
    previousSecret &&
    Number.isSafeInteger(previousOverlapExpiresAt)
      ? {
          keyId: previousKeyId,
          secret: previousSecret,
          overlapExpiresAt: previousOverlapExpiresAt,
        }
      : undefined;

  return {
    current: { keyId: currentKeyId, secret: currentSecret, activatedAt },
    ...(previous ? { previous } : {}),
    revokedKeyIds: (process.env.FLEETVOLT_ADMIN_REVOKED_KEY_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

export async function runAuthenticatedAdminOperation<T>(args: {
  envelope: AdminSignedEnvelope;
  operation: string;
  body: unknown;
  keyRing: AdminKeyRing;
  now: number;
  consumeNonce: (nonceDigest: string, expiresAt: number) => Promise<boolean>;
  invoke: () => Promise<T>;
}): Promise<T> {
  await verifyAndConsumeAdminEnvelope({
    envelope: args.envelope,
    expectedOperation: args.operation,
    expectedBody: args.body,
    keyRing: args.keyRing,
    now: args.now,
    consumeNonce: args.consumeNonce,
  });
  return await args.invoke();
}

async function authenticatedAction<T>(args: {
  ctx: ActionCtx;
  envelope: AdminSignedEnvelope;
  operation: string;
  body: unknown;
  invoke: (now: number) => Promise<T>;
}): Promise<T> {
  const now = Date.now();
  return await runAuthenticatedAdminOperation({
    envelope: args.envelope,
    operation: args.operation,
    body: args.body,
    keyRing: requireAdminKeyRing(),
    now,
    consumeNonce: async (nonceDigest, expiresAt) =>
      await args.ctx.runMutation(consumeNonceRef, {
        nonceDigest,
        keyId: args.envelope.keyId,
        operation: args.operation,
        bodyHash: args.envelope.bodyHash,
        issuedAt: args.envelope.issuedAt,
        expiresAt,
        consumedAt: now,
      }),
    invoke: async () => await args.invoke(now),
  });
}

async function designatedPairs(ctx: DatabaseCtx): Promise<DesignatedRoutePair[]> {
  const [generators, ports] = await Promise.all([
    ctx.db.query("trafficGenerators").collect(),
    ctx.db.query("ports").collect(),
  ]);
  const eligiblePorts = ports.filter((port) => ALLOWED_PORTS.has(port.code));
  if (generators.length !== DESIGNATED_ROUTE_COUNT || eligiblePorts.length === 0) {
    throw new Error("Statewide designated-route source inventory is incomplete");
  }

  return sortDesignatedPairs(
    generators.map((generator) => {
      const explicit = generator.portCode
        ? eligiblePorts.find((port) => port.code === generator.portCode)
        : undefined;
      const nearest = explicit
        ? undefined
        : [...eligiblePorts].sort(
            (left, right) =>
              haversineMeters(left.location, generator.location) -
                haversineMeters(right.location, generator.location) ||
              left.code.localeCompare(right.code),
          )[0];
      const port = explicit ?? nearest;
      if (!port) throw new Error("A designated generator has no eligible port");
      return { generatorId: generator.generatorId, portCode: port.code };
    }),
  );
}

async function promotedEvidence(ctx: DatabaseCtx): Promise<PromotedRouteEvidence[]> {
  const promotions = (
    await ctx.db.query("routeCatalogEntries").collect()
  ).filter((row) => row.promoted);
  return await Promise.all(
    promotions.map(async (promotion) => {
      const geometry = await ctx.db
        .query("routeGeometries")
        .withIndex("by_requestHash", (query) =>
          query.eq("requestHash", promotion.requestHash),
        )
        .unique();
      return {
        generatorId: promotion.generatorId,
        originPortCode: promotion.originPortCode,
        requestHash: promotion.requestHash,
        ...(geometry
          ? {
              geometry: {
                requestHash: geometry.requestHash,
                provider: geometry.provider,
                coordinates: geometry.coordinates,
                freshness: {
                  requestHash: geometry.requestHash,
                  pulledAt: geometry.pulledAt,
                  expiresAt: geometry.expiresAt,
                },
              },
            }
          : {}),
      };
    }),
  );
}

async function coverageState(ctx: DatabaseCtx, now: number) {
  const pairs = await designatedPairs(ctx);
  const rows = classifyDesignatedCoverage(
    pairs,
    await promotedEvidence(ctx),
    now,
  );
  return { pairs, rows, summary: coverageSummary(rows) };
}

async function patchRunCoverage(
  ctx: MutationCtx,
  runId: string,
  now: number,
) {
  const run = await ctx.db
    .query("statewideRouteRuns")
    .withIndex("by_runId", (query) => query.eq("runId", runId))
    .unique();
  if (!run) throw new Error("Statewide route run does not exist");
  const coverage = await coverageState(ctx, now);
  await ctx.db.patch(run._id, {
    totalPairs: coverage.summary.expected,
    verifiedPairs:
      coverage.summary.freshVerified + coverage.summary.cacheOwned,
    missingPairs: coverage.summary.missing,
    invalidPairs: coverage.summary.invalid,
    duplicatePairs: coverage.summary.duplicate,
    status: coverage.summary.complete ? "complete" : "running",
    updatedAt: now,
  });
  return coverage;
}

export const consumeNonce = internalMutation({
  args: {
    nonceDigest: v.string(),
    keyId: v.string(),
    operation: v.string(),
    bodyHash: v.string(),
    issuedAt: v.number(),
    expiresAt: v.number(),
    consumedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("consumedAdminNonces")
      .withIndex("by_nonceDigest", (query) =>
        query.eq("nonceDigest", args.nonceDigest),
      )
      .unique();
    if (existing) return false;
    await ctx.db.insert("consumedAdminNonces", args);
    return true;
  },
});

export const startOrResumeInternal = internalMutation({
  args: { runId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("statewideRouteRuns")
      .withIndex("by_runId", (query) => query.eq("runId", args.runId))
      .unique();
    if (!existing) {
      await ctx.db.insert("statewideRouteRuns", {
        runId: args.runId,
        status: "running",
        totalPairs: DESIGNATED_ROUTE_COUNT,
        verifiedPairs: 0,
        missingPairs: DESIGNATED_ROUTE_COUNT,
        invalidPairs: 0,
        duplicatePairs: 0,
        providerCalls: 0,
        cacheHits: 0,
        failures: 0,
        createdAt: args.now,
        updatedAt: args.now,
      });
    } else if (existing.status !== "complete") {
      await ctx.db.patch(existing._id, { status: "running", updatedAt: args.now });
    }
    const coverage = await patchRunCoverage(ctx, args.runId, args.now);
    return { runId: args.runId, ...coverage.summary };
  },
});

export const claimNextInternal = internalMutation({
  args: { runId: v.string(), leaseOwner: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("statewideRouteRuns")
      .withIndex("by_runId", (query) => query.eq("runId", args.runId))
      .unique();
    if (!run) throw new Error("Statewide route run does not exist");

    const coverage = await coverageState(ctx, args.now);
    const attempts = await ctx.db.query("statewideRouteAttempts").collect();
    let expiredLeaseCount = 0;
    for (const attempt of attempts) {
      if (attempt.status === "claimed" && attempt.leaseUntil <= args.now) {
        await ctx.db.patch(attempt._id, {
          status: "failed",
          errorCode: "lease-expired",
          errorSummary: "Provider lease expired before a result receipt was recorded",
          completedAt: args.now,
          updatedAt: args.now,
        });
        attempt.status = "failed";
        attempt.errorCode = "lease-expired";
        attempt.errorSummary =
          "Provider lease expired before a result receipt was recorded";
        attempt.completedAt = args.now;
        attempt.updatedAt = args.now;
        expiredLeaseCount += 1;
      }
    }
    if (expiredLeaseCount > 0) {
      await ctx.db.patch(run._id, {
        activePairKey: undefined,
        activeLeaseOwner: undefined,
        activeLeaseUntil: undefined,
        failures: run.failures + expiredLeaseCount,
        updatedAt: args.now,
      });
    }
    const receipts: AttemptReceipt[] = attempts
      .filter(
        (attempt) =>
          attempt.status === "succeeded" || attempt.status === "failed",
      )
      .map((attempt) => ({
        pairKey: attempt.pairKey,
        attemptNumber: attempt.attempt,
        status: attempt.status === "succeeded" ? "success" : "failure",
        recordedAt: attempt.completedAt ?? attempt.updatedAt,
      }));
    const leases: ProviderLease[] = attempts
      .filter((attempt) => attempt.status === "claimed")
      .map((attempt) => ({
        pairKey: attempt.pairKey,
        leaseUntil: attempt.leaseUntil,
      }));
    const next = nextEligiblePair({
      pairs: coverage.pairs,
      coverage: coverage.rows,
      receipts,
      leases,
      now: args.now,
    });
    if (!next) return { claim: null, coverage: coverage.summary };

    const receiptId = `${args.runId}:${next.pairKey}:${next.attemptNumber}`;
    const existingReceipt = await ctx.db
      .query("statewideRouteAttempts")
      .withIndex("by_receiptId", (query) => query.eq("receiptId", receiptId))
      .unique();
    if (existingReceipt) {
      throw new Error("Statewide attempt receipt already exists");
    }
    const leaseUntil = args.now + PROVIDER_LEASE_MS;
    await ctx.db.insert("statewideRouteAttempts", {
      receiptId,
      runId: args.runId,
      pairKey: next.pairKey,
      generatorId: next.pair.generatorId,
      originPortCode: next.pair.portCode,
      attempt: next.attemptNumber,
      status: "claimed",
      leaseOwner: args.leaseOwner,
      leaseUntil,
      providerCall: false,
      startedAt: args.now,
      createdAt: args.now,
      updatedAt: args.now,
    });
    await ctx.db.patch(run._id, {
      status: "running",
      activePairKey: next.pairKey,
      activeLeaseOwner: args.leaseOwner,
      activeLeaseUntil: leaseUntil,
      updatedAt: args.now,
    });
    return {
      claim: {
        ...next,
        runId: args.runId,
        receiptId,
        leaseOwner: args.leaseOwner,
        leaseUntil,
      },
      coverage: coverage.summary,
    };
  },
});

export const recordAttemptInternal = internalMutation({
  args: {
    runId: v.string(),
    pairKey: v.string(),
    attempt: v.number(),
    leaseOwner: v.string(),
    status: v.union(v.literal("succeeded"), v.literal("failed")),
    providerCall: v.boolean(),
    cacheStatus: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorSummary: v.optional(v.string()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db
      .query("statewideRouteAttempts")
      .withIndex("by_run_pair_attempt", (query) =>
        query
          .eq("runId", args.runId)
          .eq("pairKey", args.pairKey)
          .eq("attempt", args.attempt),
      )
      .unique();
    if (!receipt) throw new Error("Statewide attempt receipt does not exist");
    if (receipt.leaseOwner !== args.leaseOwner) {
      throw new Error("Statewide attempt lease owner does not match");
    }
    if (receipt.status !== "claimed") return { idempotent: true };

    let requestHash: string | undefined;
    let catalogId: string | undefined;
    let pointCount: number | undefined;
    if (args.status === "succeeded") {
      const promotions = (
        await ctx.db.query("routeCatalogEntries").collect()
      ).filter(
        (entry) =>
          entry.promoted &&
          entry.generatorId === receipt.generatorId &&
          entry.originPortCode === receipt.originPortCode,
      );
      if (promotions.length !== 1) {
        throw new Error("Successful attempt lacks one exact promoted route");
      }
      const promotion = promotions[0];
      const geometry = await ctx.db
        .query("routeGeometries")
        .withIndex("by_requestHash", (query) =>
          query.eq("requestHash", promotion.requestHash),
        )
        .unique();
      if (
        !geometry ||
        geometry.provider !== "ptv" ||
        geometry.coordinates.length < 8 ||
        geometry.requestHash !== promotion.requestHash
      ) {
        throw new Error("Successful attempt lacks verified PTV road geometry");
      }
      requestHash = promotion.requestHash;
      catalogId = promotion.catalogId;
      pointCount = geometry.coordinates.length;
    }

    await ctx.db.patch(receipt._id, {
      status: args.status,
      providerCall: args.providerCall,
      cacheStatus: boundedText(args.cacheStatus, 80),
      requestHash,
      catalogId,
      pointCount,
      errorCode:
        args.status === "failed" ? boundedText(args.errorCode, 80) : undefined,
      errorSummary:
        args.status === "failed"
          ? boundedText(args.errorSummary, 300)
          : undefined,
      completedAt: args.now,
      updatedAt: args.now,
    });
    const run = await ctx.db
      .query("statewideRouteRuns")
      .withIndex("by_runId", (query) => query.eq("runId", args.runId))
      .unique();
    if (!run) throw new Error("Statewide route run does not exist");
    await ctx.db.patch(run._id, {
      activePairKey: undefined,
      activeLeaseOwner: undefined,
      activeLeaseUntil: undefined,
      providerCalls: run.providerCalls + (args.providerCall ? 1 : 0),
      cacheHits: run.cacheHits + (args.providerCall ? 0 : 1),
      failures: run.failures + (args.status === "failed" ? 1 : 0),
      updatedAt: args.now,
    });
    const coverage = await patchRunCoverage(ctx, args.runId, args.now);
    return {
      idempotent: false,
      requestHash,
      catalogId,
      pointCount,
      coverage: coverage.summary,
    };
  },
});

export const coverageInternal = internalQuery({
  args: { runId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("statewideRouteRuns")
      .withIndex("by_runId", (query) => query.eq("runId", args.runId))
      .unique();
    const coverage = await coverageState(ctx, args.now);
    return {
      runId: args.runId,
      run: run
        ? {
            status: run.status,
            providerCalls: run.providerCalls,
            cacheHits: run.cacheHits,
            failures: run.failures,
            updatedAt: run.updatedAt,
          }
        : null,
      rows: coverage.rows,
      summary: coverage.summary,
    };
  },
});

export const adminStartOrResume = action({
  args: { envelope: envelopeValidator, body: v.object({ runId: v.string() }) },
  handler: async (ctx, args) =>
    await authenticatedAction({
      ctx,
      envelope: args.envelope,
      operation: "adminStartOrResume",
      body: args.body satisfies StartBody,
      invoke: async (now) =>
        await ctx.runMutation(startOrResumeRef, { ...args.body, now }),
    }),
});

export const adminClaimNext = action({
  args: {
    envelope: envelopeValidator,
    body: v.object({ runId: v.string(), leaseOwner: v.string() }),
  },
  handler: async (ctx, args) =>
    await authenticatedAction({
      ctx,
      envelope: args.envelope,
      operation: "adminClaimNext",
      body: args.body satisfies ClaimBody,
      invoke: async (now) =>
        await ctx.runMutation(claimNextRef, { ...args.body, now }),
    }),
});

export const adminRecordAttempt = action({
  args: {
    envelope: envelopeValidator,
    body: v.object({
      runId: v.string(),
      pairKey: v.string(),
      attempt: v.number(),
      leaseOwner: v.string(),
      status: v.union(v.literal("succeeded"), v.literal("failed")),
      providerCall: v.boolean(),
      cacheStatus: v.optional(v.string()),
      errorCode: v.optional(v.string()),
      errorSummary: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) =>
    await authenticatedAction({
      ctx,
      envelope: args.envelope,
      operation: "adminRecordAttempt",
      body: args.body satisfies RecordBody,
      invoke: async (now) =>
        await ctx.runMutation(recordAttemptRef, { ...args.body, now }),
    }),
});

export const adminCoverage = action({
  args: { envelope: envelopeValidator, body: v.object({ runId: v.string() }) },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await runAuthenticatedAdminOperation({
      envelope: args.envelope,
      operation: "adminCoverage",
      body: args.body satisfies CoverageBody,
      keyRing: requireAdminKeyRing(),
      now,
      consumeNonce: async (nonceDigest, expiresAt) =>
        await ctx.runMutation(consumeNonceRef, {
          nonceDigest,
          keyId: args.envelope.keyId,
          operation: "adminCoverage",
          bodyHash: args.envelope.bodyHash,
          issuedAt: args.envelope.issuedAt,
          expiresAt,
          consumedAt: now,
        }),
      invoke: async () =>
        await ctx.runQuery(coverageRef, {
          runId: args.body.runId,
          now,
        }),
    });
  },
});
