import { createHash } from "node:crypto";

export const PHYSICS_VERSION =
  process.env.PHYSICS_VERSION ?? "phase3-v1";
export const CHARGER_VERSION =
  process.env.CHARGER_VERSION ?? "afdc-static-v1";

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

export const TEST_VECTOR_EXPECTED_HASH =
  "789f520088569f9c6c2ece701ece58a78052a65c0667faaef769ca998039266c";

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

export function computeInputsHash(
  scenario: Record<string, unknown>,
  physicsVersion: string,
  chargerVersion: string,
): string {
  const payload = canonicalize({
    charger_version: chargerVersion,
    physics_version: physicsVersion,
    scenario,
  }) as Record<string, JsonValue>;

  const serialized = serializeCanonical(payload);
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}
