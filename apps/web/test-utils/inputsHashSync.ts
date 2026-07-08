// Test-only sync inputs hash — NOT bundled by Convex (lives outside convex/).
// Uses node:crypto via createRequire so it works under tsx ESM.
import { createRequire } from "module";
const nodeReq = createRequire(import.meta.url);
const crypto = nodeReq("node:crypto");

// Re-export the shared constants + canonicalization from the Convex-safe module.
export {
  PHYSICS_VERSION,
  CHARGER_VERSION,
  TEST_VECTOR_SCENARIO,
  TEST_VECTOR_EXPECTED_HASH,
} from "../convex/physics/inputsHash";

import { buildPayload } from "../convex/physics/inputsHash";

export function computeInputsHash(
  scenario: Record<string, unknown>,
  physicsVersion: string,
  chargerVersion: string,
): string {
  const serialized = buildPayload(scenario, physicsVersion, chargerVersion);
  return crypto.createHash("sha256").update(serialized, "utf8").digest("hex");
}
