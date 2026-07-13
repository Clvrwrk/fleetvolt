const ENVELOPE_DOMAIN = "fleetvolt-admin-envelope-v1";
export const MAX_ADMIN_ENVELOPE_LIFETIME_MS = 60_000;
export const MAX_ADMIN_CLOCK_SKEW_MS = 5_000;
export const MAX_PREVIOUS_KEY_OVERLAP_MS = 300_000;

export type AdminUnsignedEnvelope = {
  keyId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  operation: string;
  bodyHash: string;
};

export type AdminSignedEnvelope = AdminUnsignedEnvelope & {
  signature: string;
};

export type AdminKeyRing = {
  current: {
    keyId: string;
    secret: string;
    activatedAt: number;
  };
  previous?: {
    keyId: string;
    secret: string;
    overlapExpiresAt: number;
  };
  /** Emergency kill switch. A revoked key is rejected even during overlap. */
  revokedKeyIds?: readonly string[];
};

export type AdminEnvelopeErrorCode =
  | "malformed"
  | "expired"
  | "future-issued"
  | "lifetime-invalid"
  | "operation-mismatch"
  | "body-mismatch"
  | "unknown-key"
  | "key-not-active"
  | "key-overlap-ended"
  | "key-config-invalid"
  | "key-revoked"
  | "signature-invalid"
  | "nonce-replayed";

const PUBLIC_ERROR_MESSAGES: Record<AdminEnvelopeErrorCode, string> = {
  malformed: "Admin request envelope is malformed",
  expired: "Admin request envelope is expired",
  "future-issued": "Admin request envelope is not yet valid",
  "lifetime-invalid": "Admin request envelope lifetime is invalid",
  "operation-mismatch": "Admin request operation is invalid",
  "body-mismatch": "Admin request body binding is invalid",
  "unknown-key": "Admin request signing key is invalid",
  "key-not-active": "Admin request signing key is not active",
  "key-overlap-ended": "Admin request signing key is no longer active",
  "key-config-invalid": "Admin signing-key configuration is invalid",
  "key-revoked": "Admin request signing key is revoked",
  "signature-invalid": "Admin request signature is invalid",
  "nonce-replayed": "Admin request envelope was already used",
};

/** Error messages are intentionally constant and never interpolate credentials. */
export class AdminEnvelopeError extends Error {
  readonly code: AdminEnvelopeErrorCode;

  constructor(code: AdminEnvelopeErrorCode) {
    super(PUBLIC_ERROR_MESSAGES[code]);
    this.name = "AdminEnvelopeError";
    this.code = code;
  }
}

export type VerifiedAdminEnvelope = {
  keyId: string;
  issuedAt: number;
  expiresAt: number;
  operation: string;
  nonceDigest: string;
};

type VerifyAdminEnvelopeInput = {
  envelope: AdminSignedEnvelope;
  expectedOperation: string;
  expectedBody?: unknown;
  expectedBodyHash?: string;
  keyRing: AdminKeyRing;
  now: number;
  maxLifetimeMs?: number;
  maxClockSkewMs?: number;
};

export type ConsumeAdminNonce = (
  nonceDigest: string,
  expiresAt: number,
) => boolean | Promise<boolean>;

type VerifyAndConsumeAdminEnvelopeInput = VerifyAdminEnvelopeInput & {
  /** Must atomically return true only for the first insertion of this digest. */
  consumeNonce: ConsumeAdminNonce;
};

function canonicalJson(value: unknown, ancestors = new Set<object>()): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new AdminEnvelopeError("malformed");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new AdminEnvelopeError("malformed");
    const next = new Set(ancestors).add(value);
    return `[${value.map((item) => canonicalJson(item, next)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (ancestors.has(record)) throw new AdminEnvelopeError("malformed");
    const next = new Set(ancestors).add(record);
    const entries = Object.keys(record)
      .sort()
      .map((key) => {
        const child = record[key];
        if (child === undefined) throw new AdminEnvelopeError("malformed");
        return `${JSON.stringify(key)}:${canonicalJson(child, next)}`;
      });
    return `{${entries.join(",")}}`;
  }
  throw new AdminEnvelopeError("malformed");
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(encoded: string): ArrayBuffer | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(encoded)) return null;
  const padding = "=".repeat((4 - (encoded.length % 4)) % 4);
  try {
    const binary = atob(encoded.replaceAll("-", "+").replaceAll("_", "/") + padding);
    return Uint8Array.from(
      binary,
      (character) => character.charCodeAt(0),
    ).buffer;
  } catch {
    return null;
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(digest);
}

function signingInput(envelope: AdminUnsignedEnvelope): string {
  return `${ENVELOPE_DOMAIN}\n${canonicalJson({
    bodyHash: envelope.bodyHash,
    expiresAt: envelope.expiresAt,
    issuedAt: envelope.issuedAt,
    keyId: envelope.keyId,
    nonce: envelope.nonce,
    operation: envelope.operation,
  })}`;
}

async function hmacKey(secret: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

export async function hashCanonicalAdminBody(body: unknown): Promise<string> {
  return sha256(canonicalJson(body));
}

/** Intended for a trusted local signer; never pass the reusable secret to Convex. */
export async function signAdminEnvelope(
  envelope: AdminUnsignedEnvelope,
  secret: string,
): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, ["sign"]),
    new TextEncoder().encode(signingInput(envelope)),
  );
  return bytesToBase64Url(signature);
}

function assertEnvelopeShape(envelope: AdminSignedEnvelope) {
  if (
    !envelope ||
    typeof envelope !== "object" ||
    typeof envelope.keyId !== "string" ||
    envelope.keyId.length === 0 ||
    !Number.isSafeInteger(envelope.issuedAt) ||
    !Number.isSafeInteger(envelope.expiresAt) ||
    typeof envelope.nonce !== "string" ||
    envelope.nonce.length < 16 ||
    envelope.nonce.length > 256 ||
    typeof envelope.operation !== "string" ||
    envelope.operation.length === 0 ||
    envelope.operation.length > 128 ||
    typeof envelope.bodyHash !== "string" ||
    envelope.bodyHash.length !== 43 ||
    typeof envelope.signature !== "string"
  ) {
    throw new AdminEnvelopeError("malformed");
  }
}

function resolveKey(args: VerifyAdminEnvelopeInput): string {
  const { envelope, keyRing, now } = args;
  if (new Set(keyRing.revokedKeyIds ?? []).has(envelope.keyId)) {
    throw new AdminEnvelopeError("key-revoked");
  }
  if (envelope.keyId === keyRing.current.keyId) {
    if (envelope.issuedAt < keyRing.current.activatedAt) {
      throw new AdminEnvelopeError("key-not-active");
    }
    return keyRing.current.secret;
  }
  if (keyRing.previous && envelope.keyId === keyRing.previous.keyId) {
    const overlapDuration =
      keyRing.previous.overlapExpiresAt - keyRing.current.activatedAt;
    if (overlapDuration < 0 || overlapDuration >= MAX_PREVIOUS_KEY_OVERLAP_MS) {
      throw new AdminEnvelopeError("key-config-invalid");
    }
    if (now > keyRing.previous.overlapExpiresAt) {
      throw new AdminEnvelopeError("key-overlap-ended");
    }
    return keyRing.previous.secret;
  }
  throw new AdminEnvelopeError("unknown-key");
}

export async function verifyAdminEnvelope(
  args: VerifyAdminEnvelopeInput,
): Promise<VerifiedAdminEnvelope> {
  const { envelope, now } = args;
  assertEnvelopeShape(envelope);
  const secret = resolveKey(args);
  const maxLifetimeMs = args.maxLifetimeMs ?? MAX_ADMIN_ENVELOPE_LIFETIME_MS;
  const maxClockSkewMs = args.maxClockSkewMs ?? MAX_ADMIN_CLOCK_SKEW_MS;

  if (
    envelope.expiresAt <= envelope.issuedAt ||
    envelope.expiresAt - envelope.issuedAt > maxLifetimeMs
  ) {
    throw new AdminEnvelopeError("lifetime-invalid");
  }
  if (envelope.issuedAt > now + maxClockSkewMs) {
    throw new AdminEnvelopeError("future-issued");
  }
  if (envelope.expiresAt <= now) throw new AdminEnvelopeError("expired");
  if (envelope.operation !== args.expectedOperation) {
    throw new AdminEnvelopeError("operation-mismatch");
  }
  const expectedBodyHash =
    args.expectedBodyHash ?? (await hashCanonicalAdminBody(args.expectedBody));
  if (envelope.bodyHash !== expectedBodyHash) {
    throw new AdminEnvelopeError("body-mismatch");
  }

  const signature = base64UrlToBytes(envelope.signature);
  if (!signature || signature.byteLength !== 32) {
    throw new AdminEnvelopeError("signature-invalid");
  }
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, ["verify"]),
    signature,
    new TextEncoder().encode(signingInput(envelope)),
  );
  if (!valid) throw new AdminEnvelopeError("signature-invalid");

  return {
    keyId: envelope.keyId,
    issuedAt: envelope.issuedAt,
    expiresAt: envelope.expiresAt,
    operation: envelope.operation,
    nonceDigest: await sha256(envelope.nonce),
  };
}

export async function verifyAndConsumeAdminEnvelope(
  args: VerifyAndConsumeAdminEnvelopeInput,
): Promise<VerifiedAdminEnvelope> {
  const verified = await verifyAdminEnvelope(args);
  if (!(await args.consumeNonce(verified.nonceDigest, verified.expiresAt))) {
    throw new AdminEnvelopeError("nonce-replayed");
  }
  return verified;
}

export function redactAdminEnvelope(envelope: AdminSignedEnvelope) {
  return {
    keyId: envelope.keyId,
    operation: envelope.operation,
    issuedAt: envelope.issuedAt,
    expiresAt: envelope.expiresAt,
    credentials: "[REDACTED]" as const,
  };
}
