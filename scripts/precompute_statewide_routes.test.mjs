import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEADLINE_EXIT_CODE,
  runStatewideRoutes,
} from "./precompute_statewide_routes.mjs";

const COMPLETE = {
  expected: 69,
  freshVerified: 69,
  cacheOwned: 0,
  missing: 0,
  invalid: 0,
  duplicate: 0,
  complete: true,
};

const INCOMPLETE = {
  ...COMPLETE,
  freshVerified: 67,
  missing: 2,
  complete: false,
};

function referenceName(reference) {
  return typeof reference === "string" ? reference : reference?._name;
}

function claim(generatorId, attemptNumber = 1) {
  return {
    pair: { generatorId, portCode: "POLB" },
    pairKey: `${generatorId}::POLB`,
    attemptNumber,
    receiptId: `run:${generatorId}:${attemptNumber}`,
    leaseOwner: "test-owner",
    leaseUntil: 99_999,
  };
}

function fakeSigner(secret = "top-secret-signing-key") {
  let sequence = 0;
  const envelopes = [];
  return {
    secret,
    envelopes,
    async sign(operation, body, issuedAt) {
      sequence += 1;
      const envelope = {
        keyId: "key-current",
        issuedAt,
        expiresAt: issuedAt + 45_000,
        nonce: `unique-nonce-${String(sequence).padStart(8, "0")}`,
        operation,
        bodyHash: `body-${JSON.stringify(body).length}`,
        signature: `${secret}-signature-${sequence}`,
      };
      envelopes.push(envelope);
      return envelope;
    },
  };
}

function createFakeClient({
  claims = [],
  provider,
  coverage = COMPLETE,
} = {}) {
  const calls = [];
  const records = [];
  let claimIndex = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  return {
    calls,
    records,
    get maxInFlight() {
      return maxInFlight;
    },
    async action(reference, args, context = {}) {
      const name = referenceName(reference);
      calls.push({ name, args });
      if (name.endsWith(":adminStartOrResume")) {
        return { runId: args.body.runId, ...coverage };
      }
      if (name.endsWith(":adminCoverage")) {
        return { runId: args.body.runId, summary: coverage, rows: [], run: null };
      }
      if (name.endsWith(":adminClaimNext")) {
        return {
          claim: claims[claimIndex++] ?? null,
          coverage,
        };
      }
      if (name.endsWith(":precomputeFreightPoi")) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        try {
          return await (provider?.(args, context) ?? {
            catalogId: `polb-${args.generatorId}`,
            requestHash: `hash-${args.generatorId}`,
            pointCount: 20,
            geometryCacheStatus: "database-miss-write",
            enrichmentCacheStatus: "database-miss-write",
          });
        } finally {
          inFlight -= 1;
        }
      }
      if (name.endsWith(":adminRecordAttempt")) {
        records.push(args.body);
        return { idempotent: false, coverage };
      }
      throw new Error(`Unexpected action ${name}`);
    },
  };
}

function options(client, signer, overrides = {}) {
  const stdout = [];
  const stderr = [];
  let now = 1_000;
  return {
    client,
    signer,
    runId: "statewide-v1",
    leaseOwner: "test-owner",
    now: () => now++,
    sleep: async () => {},
    log: (line) => stdout.push(String(line)),
    errorLog: (line) => stderr.push(String(line)),
    stdout,
    stderr,
    ...overrides,
  };
}

test("runs provider work strictly one route at a time and signs every admin call uniquely", async () => {
  const signer = fakeSigner();
  const client = createFakeClient({
    claims: [claim("MTG-1"), claim("MTG-2"), null],
    provider: async (args) => {
      await new Promise((resolve) => setTimeout(resolve, 4));
      return {
        catalogId: `polb-${args.generatorId}`,
        requestHash: `hash-${args.generatorId}`,
        pointCount: 20,
        geometryCacheStatus: "database-miss-write",
        enrichmentCacheStatus: "database-miss-write",
      };
    },
    coverage: INCOMPLETE,
  });

  const result = await runStatewideRoutes(options(client, signer));

  assert.equal(client.maxInFlight, 1);
  assert.equal(result.providerCalls, 2);
  assert.deepEqual(
    client.records.map((record) => record.pairKey),
    ["MTG-1::POLB", "MTG-2::POLB"],
  );
  assert.equal(new Set(signer.envelopes.map((item) => item.nonce)).size, signer.envelopes.length);
  assert.ok(signer.envelopes.every((item) => item.expiresAt - item.issuedAt <= 60_000));
});

test("fresh coverage is a zero-provider cache skip", async () => {
  const signer = fakeSigner();
  const client = createFakeClient({ claims: [null], coverage: COMPLETE });

  const result = await runStatewideRoutes(options(client, signer));

  assert.equal(result.providerCalls, 0);
  assert.equal(client.calls.filter((call) => call.name.endsWith(":precomputeFreightPoi")).length, 0);
  assert.equal(result.coverage.complete, true);
});

test("resume processes the first still-unverified stable pair", async () => {
  const signer = fakeSigner();
  const first = createFakeClient({
    claims: [claim("MTG-9", 1)],
    coverage: INCOMPLETE,
    provider: async () => {
      throw new Error("provider included top-secret-signing-key");
    },
  });
  const firstOptions = options(first, signer, { stopOnError: true });
  const stopped = await runStatewideRoutes(firstOptions);
  assert.equal(stopped.failures, 1);
  assert.equal(first.records[0].pairKey, "MTG-9::POLB");

  const resumed = createFakeClient({
    claims: [claim("MTG-9", 2), null],
    coverage: COMPLETE,
  });
  const resumedResult = await runStatewideRoutes(options(resumed, signer, { resume: true }));

  assert.equal(resumedResult.providerCalls, 1);
  assert.equal(resumed.records[0].pairKey, "MTG-9::POLB");
  assert.equal(resumed.records[0].attempt, 2);
});

test("bounded failures are receipted and continuation follows server eligibility", async () => {
  const signer = fakeSigner();
  const client = createFakeClient({
    claims: [claim("MTG-3", 1), claim("MTG-3", 2), claim("MTG-3", 3), null],
    coverage: INCOMPLETE,
    provider: async () => {
      throw new Error("untrusted provider payload");
    },
  });

  const result = await runStatewideRoutes(
    options(client, signer, { maxAttempts: 3, stopOnError: false }),
  );

  assert.equal(result.failures, 3);
  assert.equal(client.records.length, 3);
  assert.deepEqual(client.records.map((record) => record.attempt), [1, 2, 3]);
  assert.ok(client.records.every((record) => record.errorCode === "provider-failed"));
  assert.ok(client.records.every((record) => record.errorSummary === "Route provider request failed"));
});

test("cache race records a cache hit without claiming a paid provider call", async () => {
  const signer = fakeSigner();
  const client = createFakeClient({
    claims: [claim("MTG-10"), null],
    coverage: COMPLETE,
    provider: async (args) => ({
      catalogId: `polb-${args.generatorId}`,
      requestHash: `hash-${args.generatorId}`,
      pointCount: 20,
      geometryCacheStatus: "database-hit",
      enrichmentCacheStatus: "database-hit",
    }),
  });

  const result = await runStatewideRoutes(options(client, signer));

  assert.equal(result.providerCalls, 0);
  assert.equal(result.cacheHits, 1);
  assert.equal(client.records[0].providerCall, false);
});

test("deadline aborts the active request, clears safely, and returns a nonzero code", async () => {
  const signer = fakeSigner();
  let observedAbort = false;
  const client = createFakeClient({
    claims: [claim("MTG-11")],
    coverage: INCOMPLETE,
    provider: async (_args, context) =>
      await new Promise((_resolve, reject) => {
        context.signal.addEventListener("abort", () => {
          observedAbort = true;
          reject(context.signal.reason);
        });
      }),
  });

  const result = await runStatewideRoutes(
    options(client, signer, { deadlineMs: 15 }),
  );

  assert.equal(result.exitCode, DEADLINE_EXIT_CODE);
  assert.equal(observedAbort, true);
});

test("credentials, signatures, and full envelopes never enter output or receipts", async () => {
  const signer = fakeSigner("never-print-this-key");
  const client = createFakeClient({
    claims: [claim("MTG-12"), null],
    coverage: INCOMPLETE,
    provider: async () => {
      throw new Error("never-print-this-key and signature material");
    },
  });
  const runOptions = options(client, signer, { stopOnError: true });

  await runStatewideRoutes(runOptions);

  const exposed = JSON.stringify({
    stdout: runOptions.stdout,
    stderr: runOptions.stderr,
    receipts: client.records,
  });
  assert.doesNotMatch(exposed, /never-print-this-key/u);
  assert.doesNotMatch(exposed, /signature-material|signature-/u);
  assert.doesNotMatch(exposed, /unique-nonce/u);
  assert.doesNotMatch(exposed, /bodyHash|expiresAt|issuedAt|nonce/u);
});
