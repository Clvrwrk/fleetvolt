import assert from "node:assert/strict";
import test from "node:test";
import {
  AdminEnvelopeError,
  hashCanonicalAdminBody,
  redactAdminEnvelope,
  signAdminEnvelope,
  verifyAdminEnvelope,
  verifyAndConsumeAdminEnvelope,
  type AdminKeyRing,
  type AdminSignedEnvelope,
} from "./adminSignedEnvelopePolicy";

const NOW = 1_784_000_000_000;
const CURRENT_SECRET = "current-secret-value-that-must-never-leak";
const PREVIOUS_SECRET = "previous-secret-value-that-must-never-leak";
const BODY = { catalogId: "statewide-v1", runId: "run-23" };

const keyRing: AdminKeyRing = {
  current: {
    keyId: "key-current",
    secret: CURRENT_SECRET,
    activatedAt: NOW - 60_000,
  },
  previous: {
    keyId: "key-previous",
    secret: PREVIOUS_SECRET,
    overlapExpiresAt: NOW + 60_000,
  },
};

async function envelope(
  overrides: Partial<AdminSignedEnvelope> = {},
  secret = CURRENT_SECRET,
): Promise<AdminSignedEnvelope> {
  const unsigned = {
    keyId: "key-current",
    issuedAt: NOW - 1_000,
    expiresAt: NOW + 30_000,
    nonce: "nonce-0123456789abcdef",
    operation: "adminClaimNext",
    bodyHash: await hashCanonicalAdminBody(BODY),
    ...overrides,
  };
  return { ...unsigned, signature: await signAdminEnvelope(unsigned, secret) };
}

async function rejectsWithCode(
  promise: Promise<unknown>,
  code: AdminEnvelopeError["code"],
) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof AdminEnvelopeError);
    assert.equal(error.code, code);
    return true;
  });
}

test("canonical body hashes are order-independent and bind changed bodies", async () => {
  assert.equal(
    await hashCanonicalAdminBody({ runId: "run-23", catalogId: "statewide-v1" }),
    await hashCanonicalAdminBody(BODY),
  );
  assert.notEqual(
    await hashCanonicalAdminBody({ ...BODY, catalogId: "other" }),
    await hashCanonicalAdminBody(BODY),
  );
});

test("accepts a current-key envelope with exact operation and body binding", async () => {
  const verified = await verifyAdminEnvelope({
    envelope: await envelope(),
    expectedOperation: "adminClaimNext",
    expectedBody: BODY,
    keyRing,
    now: NOW,
  });
  assert.equal(verified.keyId, "key-current");
  assert.equal(verified.operation, "adminClaimNext");
  assert.match(verified.nonceDigest, /^[A-Za-z0-9_-]{43}$/);
});

test("rejects expired and excessively long envelopes", async () => {
  await rejectsWithCode(
    verifyAdminEnvelope({
      envelope: await envelope({ expiresAt: NOW - 1 }),
      expectedOperation: "adminClaimNext",
      expectedBody: BODY,
      keyRing,
      now: NOW,
    }),
    "expired",
  );
  await rejectsWithCode(
    verifyAdminEnvelope({
      envelope: await envelope({ expiresAt: NOW + 60_001 }),
      expectedOperation: "adminClaimNext",
      expectedBody: BODY,
      keyRing,
      now: NOW,
    }),
    "lifetime-invalid",
  );
});

test("rejects future-issued envelopes beyond the allowed clock skew", async () => {
  await rejectsWithCode(
    verifyAdminEnvelope({
      envelope: await envelope({
        issuedAt: NOW + 5_001,
        expiresAt: NOW + 35_000,
      }),
      expectedOperation: "adminClaimNext",
      expectedBody: BODY,
      keyRing,
      now: NOW,
    }),
    "future-issued",
  );
});

test("rejects wrong operation and wrong body/catalog binding", async () => {
  await rejectsWithCode(
    verifyAdminEnvelope({
      envelope: await envelope(),
      expectedOperation: "adminCoverage",
      expectedBody: BODY,
      keyRing,
      now: NOW,
    }),
    "operation-mismatch",
  );
  await rejectsWithCode(
    verifyAdminEnvelope({
      envelope: await envelope(),
      expectedOperation: "adminClaimNext",
      expectedBody: { ...BODY, catalogId: "statewide-v2" },
      keyRing,
      now: NOW,
    }),
    "body-mismatch",
  );
});

test("rejects an unknown key id without leaking it", async () => {
  const unknownKeyId = "unknown-sensitive-key-id";
  const attempt = verifyAdminEnvelope({
    envelope: await envelope({ keyId: unknownKeyId }, "attacker-secret"),
    expectedOperation: "adminClaimNext",
    expectedBody: BODY,
    keyRing,
    now: NOW,
  });
  await assert.rejects(attempt, (error: unknown) => {
    assert.ok(error instanceof AdminEnvelopeError);
    assert.equal(error.code, "unknown-key");
    assert.doesNotMatch(error.message, new RegExp(unknownKeyId));
    return true;
  });
});

test("accepts the previous key during rotation overlap and rejects it after", async () => {
  const previous = await envelope(
    { keyId: "key-previous", nonce: "nonce-previous-012345" },
    PREVIOUS_SECRET,
  );
  await verifyAdminEnvelope({
    envelope: previous,
    expectedOperation: "adminClaimNext",
    expectedBody: BODY,
    keyRing,
    now: NOW,
  });
  await rejectsWithCode(
    verifyAdminEnvelope({
      envelope: previous,
      expectedOperation: "adminClaimNext",
      expectedBody: BODY,
      keyRing,
      now: NOW + 60_001,
    }),
    "key-overlap-ended",
  );
});

test("fails closed when previous-key overlap is configured at five minutes or more", async () => {
  const previous = await envelope(
    { keyId: "key-previous", nonce: "nonce-previous-oversized" },
    PREVIOUS_SECRET,
  );
  await rejectsWithCode(
    verifyAdminEnvelope({
      envelope: previous,
      expectedOperation: "adminClaimNext",
      expectedBody: BODY,
      keyRing: {
        ...keyRing,
        previous: {
          ...keyRing.previous!,
          overlapExpiresAt: keyRing.current.activatedAt + 300_000,
        },
      },
      now: NOW,
    }),
    "key-config-invalid",
  );
});

test("emergency revocation rejects current or previous keys immediately", async () => {
  await rejectsWithCode(
    verifyAdminEnvelope({
      envelope: await envelope(),
      expectedOperation: "adminClaimNext",
      expectedBody: BODY,
      keyRing: { ...keyRing, revokedKeyIds: ["key-current"] },
      now: NOW,
    }),
    "key-revoked",
  );
});

test("redaction omits signature, nonce, secrets, and body hash", async () => {
  const signed = await envelope();
  const rendered = JSON.stringify(redactAdminEnvelope(signed));
  for (const sensitive of [
    signed.signature,
    signed.nonce,
    signed.bodyHash,
    CURRENT_SECRET,
    PREVIOUS_SECRET,
  ]) {
    assert.equal(rendered.includes(sensitive), false);
  }
  assert.deepEqual(redactAdminEnvelope(signed), {
    keyId: "key-current",
    operation: "adminClaimNext",
    issuedAt: NOW - 1_000,
    expiresAt: NOW + 30_000,
    credentials: "[REDACTED]",
  });
});

test("replay is rejected after one successful atomic nonce consumption", async () => {
  const signed = await envelope();
  const consumed = new Set<string>();
  const consumeNonce = async (digest: string) => {
    if (consumed.has(digest)) return false;
    consumed.add(digest);
    return true;
  };
  await verifyAndConsumeAdminEnvelope({
    envelope: signed,
    expectedOperation: "adminClaimNext",
    expectedBody: BODY,
    keyRing,
    now: NOW,
    consumeNonce,
  });
  await rejectsWithCode(
    verifyAndConsumeAdminEnvelope({
      envelope: signed,
      expectedOperation: "adminClaimNext",
      expectedBody: BODY,
      keyRing,
      now: NOW,
      consumeNonce,
    }),
    "nonce-replayed",
  );
});

test("concurrent duplicate nonce permits exactly one caller", async () => {
  const signed = await envelope();
  const consumed = new Set<string>();
  const consumeNonce = async (digest: string) => {
    await Promise.resolve();
    if (consumed.has(digest)) return false;
    consumed.add(digest);
    return true;
  };
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      verifyAndConsumeAdminEnvelope({
        envelope: signed,
        expectedOperation: "adminClaimNext",
        expectedBody: BODY,
        keyRing,
        now: NOW,
        consumeNonce,
      }),
    ),
  );
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  for (const result of results) {
    if (result.status === "rejected") {
      assert.ok(result.reason instanceof AdminEnvelopeError);
      assert.equal(result.reason.code, "nonce-replayed");
    }
  }
});
