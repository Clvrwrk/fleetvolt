// Canonical SHA-256 inputs hash — port of inputs_hash.py + services/api/src/inputs_hash.ts.
// Produces the same hash as the Python reference for the test vector.
//
// Two exports:
//   - computeInputsHash (sync, uses node:crypto — for tests/non-Convex)
//   - computeInputsHashAsync (async, uses Web Crypto — for Convex actions)

export const PHYSICS_VERSION = "phase3-v1";
export const CHARGER_VERSION = "afdc-static-v1";

export const TEST_VECTOR_SCENARIO = {
  route: { corridor_key: "polb_cajon_pass" },
  truck: { slug: "ecascadia_438" },
  conditions: {
    weather_preset: "ideal",
    payload_lbs: 34000,
    port_drayage_enabled: false,
  },
  overrides: {},
  options: { include_charging: true },
} as const;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function canonicalize(value: unknown): JsonValue {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 1_000_000) / 1_000_000;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, JsonValue> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = canonicalize(record[key]);
    }
    return sorted;
  }
  return value as JsonValue;
}

function serializeCanonical(value: JsonValue): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeCanonical(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${serializeCanonical(value[key]!)}`,
  );
  return `{${entries.join(",")}}`;
}

export function buildPayload(
  scenario: Record<string, unknown>,
  physicsVersion: string,
  chargerVersion: string,
): string {
  const payload = canonicalize({
    charger_version: chargerVersion,
    physics_version: physicsVersion,
    scenario,
  }) as Record<string, JsonValue>;
  return serializeCanonical(payload);
}

function bytesToHex(bytes: Uint8Array): string {
  const hex: string[] = [];
  for (const b of bytes) {
    hex.push(b.toString(16).padStart(2, "0"));
  }
  return hex.join("");
}

/** Async hash using Web Crypto API (works in Convex + Node 18+). */
export async function computeInputsHashAsync(
  scenario: Record<string, unknown>,
  physicsVersion: string,
  chargerVersion: string,
): Promise<string> {
  const serialized = buildPayload(scenario, physicsVersion, chargerVersion);
  const data = new TextEncoder().encode(serialized);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hashBuf));
}

/** Sync hash — removed (was using node:crypto which Convex can't bundle).
 *  Use computeInputsHashAsync in Convex actions; tests use inputsHashSync.ts. */

export const TEST_VECTOR_EXPECTED_HASH =
  "789f520088569f9c6c2ece701ece58a78052a65c0667faaef769ca998039266c";
