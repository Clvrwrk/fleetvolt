import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AdminEnvelopeError,
  hashCanonicalAdminBody,
  signAdminEnvelope,
  type AdminKeyRing,
  type AdminSignedEnvelope,
} from "./adminSignedEnvelopePolicy";
import { runAuthenticatedAdminOperation } from "./statewideRunner";

const NOW = 1_784_000_000_000;
const SECRET = "runner-wrapper-current-secret";
const BODY = { runId: "phase23-live" };
const keyRing: AdminKeyRing = {
  current: {
    keyId: "current",
    secret: SECRET,
    activatedAt: NOW - 60_000,
  },
};

async function signed(
  overrides: Partial<AdminSignedEnvelope> = {},
): Promise<AdminSignedEnvelope> {
  const unsigned = {
    keyId: "current",
    issuedAt: NOW - 1_000,
    expiresAt: NOW + 30_000,
    nonce: `runner-nonce-${crypto.randomUUID()}`,
    operation: "adminStartOrResume",
    bodyHash: await hashCanonicalAdminBody(BODY),
    ...overrides,
  };
  return { ...unsigned, signature: await signAdminEnvelope(unsigned, SECRET) };
}

test("valid wrapper consumes one nonce before invoking one internal operation", async () => {
  const events: string[] = [];
  const result = await runAuthenticatedAdminOperation({
    envelope: await signed(),
    operation: "adminStartOrResume",
    body: BODY,
    keyRing,
    now: NOW,
    consumeNonce: async () => {
      events.push("consume");
      return true;
    },
    invoke: async () => {
      events.push("invoke");
      return { ok: true };
    },
  });
  assert.deepEqual(events, ["consume", "invoke"]);
  assert.deepEqual(result, { ok: true });
});

test("expired, wrong-operation, and wrong-body requests invoke no internal work", async () => {
  const attempts = [
    {
      envelope: await signed({ expiresAt: NOW - 1 }),
      operation: "adminStartOrResume",
      body: BODY,
      code: "expired",
    },
    {
      envelope: await signed(),
      operation: "adminCoverage",
      body: BODY,
      code: "operation-mismatch",
    },
    {
      envelope: await signed(),
      operation: "adminStartOrResume",
      body: { runId: "other" },
      code: "body-mismatch",
    },
  ] as const;
  for (const attempt of attempts) {
    let consumed = 0;
    let invoked = 0;
    await assert.rejects(
      runAuthenticatedAdminOperation({
        envelope: attempt.envelope,
        operation: attempt.operation,
        body: attempt.body,
        keyRing,
        now: NOW,
        consumeNonce: async () => {
          consumed += 1;
          return true;
        },
        invoke: async () => {
          invoked += 1;
        },
      }),
      (error: unknown) =>
        error instanceof AdminEnvelopeError && error.code === attempt.code,
    );
    assert.equal(consumed, 0);
    assert.equal(invoked, 0);
  }
});

test("atomic nonce rejection blocks replay and concurrent duplicate calls", async () => {
  const envelope = await signed({ nonce: "runner-shared-nonce-0123456789" });
  const consumed = new Set<string>();
  let invocations = 0;
  const consumeNonce = async (digest: string) => {
    await Promise.resolve();
    if (consumed.has(digest)) return false;
    consumed.add(digest);
    return true;
  };
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, () =>
      runAuthenticatedAdminOperation({
        envelope,
        operation: "adminStartOrResume",
        body: BODY,
        keyRing,
        now: NOW,
        consumeNonce,
        invoke: async () => {
          invocations += 1;
          return true;
        },
      }),
    ),
  );
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(invocations, 1);
});

test("key rotation and emergency revocation are enforced through the wrapper", async () => {
  const previousSecret = "runner-wrapper-previous-secret";
  const previousUnsigned = {
    keyId: "previous",
    issuedAt: NOW - 1_000,
    expiresAt: NOW + 30_000,
    nonce: "runner-previous-nonce-012345",
    operation: "adminStartOrResume",
    bodyHash: await hashCanonicalAdminBody(BODY),
  };
  const envelope = {
    ...previousUnsigned,
    signature: await signAdminEnvelope(previousUnsigned, previousSecret),
  };
  const rotated: AdminKeyRing = {
    ...keyRing,
    previous: {
      keyId: "previous",
      secret: previousSecret,
      overlapExpiresAt: NOW + 60_000,
    },
  };
  await runAuthenticatedAdminOperation({
    envelope,
    operation: "adminStartOrResume",
    body: BODY,
    keyRing: rotated,
    now: NOW,
    consumeNonce: async () => true,
    invoke: async () => true,
  });
  await assert.rejects(
    runAuthenticatedAdminOperation({
      envelope: await signed(),
      operation: "adminStartOrResume",
      body: BODY,
      keyRing: { ...keyRing, revokedKeyIds: ["current"] },
      now: NOW,
      consumeNonce: async () => true,
      invoke: async () => true,
    }),
    (error: unknown) =>
      error instanceof AdminEnvelopeError && error.code === "key-revoked",
  );
});

test("runner source exposes no provider fan-out or credential logging surface", async () => {
  const source = await readFile(new URL("./statewideRunner.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /precomputeFreightPoi/u);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)/u);
  assert.doesNotMatch(source, /signature:\s*args\.envelope\.signature/u);
  assert.doesNotMatch(source, /nonce:\s*args\.envelope\.nonce/u);
  assert.doesNotMatch(source, /CURRENT_SIGNING_KEY[^\n]*args/u);
  assert.match(source, /runAuthenticatedAdminOperation/u);
  assert.match(source, /consumeNonce/u);
});
