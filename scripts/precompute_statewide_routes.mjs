#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFile = promisify(execFileCallback);
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_ROOT = resolve(REPO_ROOT, "apps/web");
const ENVELOPE_DOMAIN = "fleetvolt-admin-envelope-v1";
const DEFAULT_RUN_ID = "statewide-v1";
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 30_000;
const MAX_ENVELOPE_LIFETIME_MS = 60_000;
const ENVELOPE_LIFETIME_MS = 45_000;

export const DEADLINE_EXIT_CODE = 124;
export const INCOMPLETE_EXIT_CODE = 2;

const REFERENCES = Object.freeze({
  start: "routes/statewideRunner:adminStartOrResume",
  claim: "routes/statewideRunner:adminClaimNext",
  record: "routes/statewideRunner:adminRecordAttempt",
  coverage: "routes/statewideRunner:adminCoverage",
  provider: "routes/catalog:precomputeFreightPoi",
});

const CLI_INTERNAL_REFERENCES = Object.freeze({
  [REFERENCES.start]: "routes/statewideRunner:startOrResumeInternal",
  [REFERENCES.claim]: "routes/statewideRunner:claimNextInternal",
  [REFERENCES.record]: "routes/statewideRunner:recordAttemptInternal",
  [REFERENCES.coverage]: "routes/statewideRunner:coverageInternal",
});

class DeadlineError extends Error {
  constructor() {
    super("Statewide route generation deadline reached");
    this.name = "DeadlineError";
  }
}

function referenceName(reference) {
  return typeof reference === "string" ? reference : reference?._name;
}

function functionReference(name) {
  return { _name: name };
}

function canonicalJson(value, ancestors = new Set()) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Admin body is not canonicalizable");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new Error("Admin body contains a cycle");
    const next = new Set(ancestors).add(value);
    return `[${value.map((item) => canonicalJson(item, next)).join(",")}]`;
  }
  if (typeof value === "object") {
    if (ancestors.has(value)) throw new Error("Admin body contains a cycle");
    const next = new Set(ancestors).add(value);
    return `{${Object.keys(value)
      .sort()
      .map((key) => {
        if (value[key] === undefined) throw new Error("Admin body contains undefined");
        return `${JSON.stringify(key)}:${canonicalJson(value[key], next)}`;
      })
      .join(",")}}`;
  }
  throw new Error("Admin body is not canonicalizable");
}

function base64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function bodyHash(body) {
  return createHash("sha256").update(canonicalJson(body)).digest("base64url");
}

function signingInput(envelope) {
  return `${ENVELOPE_DOMAIN}\n${canonicalJson({
    bodyHash: envelope.bodyHash,
    expiresAt: envelope.expiresAt,
    issuedAt: envelope.issuedAt,
    keyId: envelope.keyId,
    nonce: envelope.nonce,
    operation: envelope.operation,
  })}`;
}

/**
 * The reusable secret is read only at signing time. Its Buffer is zeroed in a
 * finally block and is never retained by the returned signer.
 */
export function createEnvironmentSigner(env = process.env) {
  return {
    async sign(operation, body, issuedAt) {
      const keyId = env.FLEETVOLT_ADMIN_CURRENT_KEY_ID;
      const secretValue = env.FLEETVOLT_ADMIN_CURRENT_SIGNING_KEY;
      if (!keyId || !secretValue) {
        throw new Error("FleetVolt admin signing environment is not configured");
      }
      const expiresAt = issuedAt + ENVELOPE_LIFETIME_MS;
      if (expiresAt - issuedAt > MAX_ENVELOPE_LIFETIME_MS) {
        throw new Error("FleetVolt admin envelope lifetime is invalid");
      }
      const unsigned = {
        keyId,
        issuedAt,
        expiresAt,
        nonce: base64Url(randomBytes(24)),
        operation,
        bodyHash: bodyHash(body),
      };
      const secret = Buffer.from(secretValue, "utf8");
      try {
        return {
          ...unsigned,
          signature: createHmac("sha256", secret)
            .update(signingInput(unsigned))
            .digest("base64url"),
        };
      } finally {
        secret.fill(0);
      }
    },
  };
}

function loadConvexUrl(env = process.env) {
  if (env.CONVEX_URL) return env.CONVEX_URL;
  if (env.NEXT_PUBLIC_CONVEX_URL) return env.NEXT_PUBLIC_CONVEX_URL;
  const localEnv = readFileSync(resolve(WEB_ROOT, ".env.local"), "utf8");
  const match = localEnv.match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/mu);
  if (!match) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  return match[1].trim().replace(/^['"]|['"]$/gu, "");
}

/** Public signed-action transport. Its fetch receives the active deadline signal. */
export async function createConvexHttpTransport({ env = process.env } = {}) {
  const convexModuleUrl = pathToFileURL(
    resolve(WEB_ROOT, "node_modules/convex/dist/esm/browser/index.js"),
  ).href;
  const { ConvexHttpClient } = await import(convexModuleUrl);
  let activeSignal;
  const client = new ConvexHttpClient(loadConvexUrl(env), {
    logger: false,
    fetch: async (input, init) =>
      await fetch(input, { ...init, ...(activeSignal ? { signal: activeSignal } : {}) }),
  });
  return {
    async action(reference, args, context = {}) {
      activeSignal = context.signal;
      try {
        return await client.action(functionReference(referenceName(reference)), args);
      } finally {
        activeSignal = undefined;
      }
    },
  };
}

function parseConvexCliJson(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const candidate = lines.slice(index).join("\n");
      try {
        return JSON.parse(candidate);
      } catch {
        // Convex may emit a non-JSON deployment notice before the result.
      }
    }
    throw new Error("Convex CLI returned an unreadable result");
  }
}

/**
 * Local authenticated Convex CLI transport. Admin calls are mapped to internal
 * functions, so no cloud signing secret is required and public action auth is
 * neither changed nor bypassed.
 */
export function createConvexCliTransport({ cwd = WEB_ROOT, now = Date.now } = {}) {
  return {
    async action(reference, args, context = {}) {
      const name = referenceName(reference);
      const internalName = CLI_INTERNAL_REFERENCES[name];
      const payload = internalName ? { ...args.body, now: now() } : args;
      const target = internalName ?? name;
      const { stdout } = await execFile(
        "pnpm",
        ["exec", "convex", "run", target, JSON.stringify(payload)],
        {
          cwd,
          encoding: "utf8",
          maxBuffer: 32 * 1024 * 1024,
          signal: context.signal,
        },
      );
      return parseConvexCliJson(stdout);
    },
  };
}

function isCacheHit(status) {
  return status === "database-hit" || status === "hit" || status === "catalog-hit";
}

function retryBackoffMs(attempt) {
  const normalized = Math.max(1, Math.min(DEFAULT_MAX_ATTEMPTS, Math.trunc(attempt)));
  return DEFAULT_RETRY_BASE_MS * 2 ** (normalized - 1);
}

async function withinDeadline(promise, signal) {
  if (signal.aborted) throw signal.reason;
  let rejectOnAbort;
  const aborted = new Promise((_, reject) => {
    rejectOnAbort = () => reject(signal.reason);
    signal.addEventListener("abort", rejectOnAbort, { once: true });
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener("abort", rejectOnAbort);
  }
}

function publicFailureReceipt(claim, leaseOwner, providerCall) {
  return {
    runId: claim.runId,
    pairKey: claim.pairKey,
    attempt: claim.attemptNumber,
    leaseOwner,
    status: "failed",
    providerCall,
    errorCode: "provider-failed",
    errorSummary: "Route provider request failed",
  };
}

/**
 * Transport-agnostic sequential orchestration. The injected transport is the
 * only component allowed to reach Convex, which makes the paid route loop fully
 * testable without a provider or deployment.
 */
export async function runStatewideRoutes(options) {
  const {
    client,
    signer,
    runId = DEFAULT_RUN_ID,
    leaseOwner = `fleetvolt-${process.pid}`,
    now = Date.now,
    sleep = async (ms) => await new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
    log = () => {},
    errorLog = () => {},
    status = false,
    dryRun = false,
    resume = false,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    stopOnError = false,
    deadlineMs = 0,
  } = options;
  if (!client || typeof client.action !== "function") {
    throw new Error("A statewide route transport is required");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw new Error("maxAttempts must be an integer from 1 through 3");
  }

  const controller = new AbortController();
  const deadline = deadlineMs > 0
    ? setTimeout(() => controller.abort(new DeadlineError()), deadlineMs)
    : null;
  const counters = { providerCalls: 0, cacheHits: 0, failures: 0 };

  const invoke = async (reference, args) =>
    await withinDeadline(
      client.action(reference, args, { signal: controller.signal }),
      controller.signal,
    );
  const admin = async (operation, reference, body) => {
    const envelope = signer ? await signer.sign(operation, body, now()) : undefined;
    return await invoke(reference, envelope ? { envelope, body } : { body });
  };
  const readCoverage = async () =>
    await admin("adminCoverage", REFERENCES.coverage, { runId });

  try {
    if (status || dryRun) {
      const coverageResult = await readCoverage();
      const coverage = coverageResult.summary ?? coverageResult;
      log(JSON.stringify({ runId, mode: status ? "status" : "dry-run", coverage }));
      return { exitCode: coverage.complete ? 0 : INCOMPLETE_EXIT_CODE, coverage, ...counters };
    }

    await admin("adminStartOrResume", REFERENCES.start, { runId });
    if (resume) log(`Resuming statewide route run ${runId}`);

    while (true) {
      const next = await admin("adminClaimNext", REFERENCES.claim, { runId, leaseOwner });
      const claimed = next.claim;
      if (!claimed) {
        const coverageResult = await readCoverage();
        const coverage = coverageResult.summary ?? coverageResult;
        return {
          exitCode: coverage.complete ? 0 : INCOMPLETE_EXIT_CODE,
          coverage,
          ...counters,
        };
      }

      if (claimed.attemptNumber > maxAttempts) {
        await admin(
          "adminRecordAttempt",
          REFERENCES.record,
          publicFailureReceipt(claimed, leaseOwner, false),
        );
        counters.failures += 1;
        if (stopOnError) {
          return { exitCode: INCOMPLETE_EXIT_CODE, coverage: next.coverage, ...counters };
        }
        continue;
      }

      let providerStarted = false;
      try {
        providerStarted = true;
        const route = await invoke(REFERENCES.provider, {
          generatorId: claimed.pair.generatorId,
          portCode: claimed.pair.portCode,
        });
        const providerCall = !isCacheHit(route.geometryCacheStatus);
        counters.providerCalls += providerCall ? 1 : 0;
        counters.cacheHits += providerCall ? 0 : 1;
        await admin("adminRecordAttempt", REFERENCES.record, {
          runId: claimed.runId,
          pairKey: claimed.pairKey,
          attempt: claimed.attemptNumber,
          leaseOwner,
          status: "succeeded",
          providerCall,
          cacheStatus: String(route.geometryCacheStatus ?? "unknown").slice(0, 80),
        });
        log(`Verified ${claimed.pairKey}`);
      } catch (error) {
        if (error instanceof DeadlineError || controller.signal.aborted) throw error;
        const providerCall = providerStarted;
        counters.providerCalls += providerCall ? 1 : 0;
        counters.failures += 1;
        await admin(
          "adminRecordAttempt",
          REFERENCES.record,
          publicFailureReceipt(claimed, leaseOwner, providerCall),
        );
        errorLog(`Route attempt ${claimed.attemptNumber} failed for ${claimed.pairKey}`);
        if (stopOnError || claimed.attemptNumber >= maxAttempts) {
          if (stopOnError) {
            return { exitCode: INCOMPLETE_EXIT_CODE, coverage: next.coverage, ...counters };
          }
        } else {
          await withinDeadline(sleep(retryBackoffMs(claimed.attemptNumber)), controller.signal);
        }
      }
    }
  } catch (error) {
    if (error instanceof DeadlineError || controller.signal.aborted) {
      errorLog("Statewide route run stopped at its deadline");
      return { exitCode: DEADLINE_EXIT_CODE, coverage: null, ...counters };
    }
    throw error;
  } finally {
    if (deadline) clearTimeout(deadline);
  }
}

export function parseCliArgs(argv) {
  const result = {
    runId: DEFAULT_RUN_ID,
    leaseOwner: `fleetvolt-${process.pid}`,
    transport: "convex-cli",
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    deadlineMs: 0,
    status: false,
    dryRun: false,
    resume: false,
    stopOnError: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const take = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      index += 1;
      return value;
    };
    if (arg === "--run-id") result.runId = take();
    else if (arg === "--lease-owner") result.leaseOwner = take();
    else if (arg === "--transport") result.transport = take();
    else if (arg === "--max-attempt" || arg === "--max-attempts") result.maxAttempts = Number(take());
    else if (arg === "--deadline-ms") result.deadlineMs = Number(take());
    else if (arg === "--status") result.status = true;
    else if (arg === "--dry-run") result.dryRun = true;
    else if (arg === "--resume") result.resume = true;
    else if (arg === "--stop-on-error") result.stopOnError = true;
    else throw new Error(`Unknown option ${arg}`);
  }
  if (!Number.isSafeInteger(result.deadlineMs) || result.deadlineMs < 0) {
    throw new Error("--deadline-ms must be a nonnegative integer");
  }
  if (!Number.isInteger(result.maxAttempts) || result.maxAttempts < 1 || result.maxAttempts > 3) {
    throw new Error("--max-attempts must be an integer from 1 through 3");
  }
  if (result.transport !== "convex-cli" && result.transport !== "http") {
    throw new Error("--transport must be convex-cli or http");
  }
  return result;
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const client = cli.transport === "http"
    ? await createConvexHttpTransport()
    : createConvexCliTransport();
  const signer = cli.transport === "http" ? createEnvironmentSigner() : undefined;
  const result = await runStatewideRoutes({
    ...cli,
    client,
    signer,
    log: console.log,
    errorLog: console.error,
  });
  console.log(JSON.stringify({
    runId: cli.runId,
    coverage: result.coverage,
    providerCalls: result.providerCalls,
    cacheHits: result.cacheHits,
    failures: result.failures,
  }));
  process.exitCode = result.exitCode;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => {
    console.error("Statewide route CLI failed; sensitive error detail was suppressed");
    process.exitCode = 1;
  });
}
