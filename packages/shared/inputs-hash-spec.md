# inputs_hash Cross-Language Contract

Canonical SHA-256 hash for `simulation_runs.inputs_hash` cache lookups (D-04). Node (`services/api`) and Python (`services/simulator`) MUST produce identical digests for identical inputs.

## Algorithm

1. Build hash input object:
   ```json
   {
     "scenario": <nested SimulateRequest body>,
     "physics_version": "<version string>",
     "charger_version": "<version string>"
   }
   ```
2. Recursively sort all object keys lexicographically at every nesting level.
3. Round all floating-point numbers to **6 decimal places** before serialization.
4. Serialize to JSON: UTF-8, no insignificant whitespace (`separators=(",", ":")`), no trailing newline.
5. Compute `SHA-256(serialized_bytes)` and encode as **lowercase hexadecimal** (64 characters).

## Version Stamps

| Constant | Value (Phase 3) |
|----------|-----------------|
| `physics_version` | `phase3-v1` |
| `charger_version` | `afdc-static-v1` |

## Committed Test Vector

**Scenario fixture:**

```json
{
  "route": {"corridor_key": "polb_cajon_pass"},
  "truck": {"slug": "ecascadia_438"},
  "conditions": {
    "weather_preset": "ideal",
    "payload_lbs": 34000,
    "port_drayage_enabled": false
  },
  "overrides": {},
  "options": {"include_charging": true}
}
```

**Versions:** `physics_version=phase3-v1`, `charger_version=afdc-static-v1`

**Expected SHA-256 hex:** `789f520088569f9c6c2ece701ece58a78052a65c0667faaef769ca998039266c`

Python tests: `services/simulator/tests/test_inputs_hash.py`  
Node parity tests: `services/api/src/inputs_hash.test.ts` (Plan 03-04)
