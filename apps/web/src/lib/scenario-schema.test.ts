import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scenarioFormSchema } from "./scenario-schema.js";

describe("scenarioFormSchema", () => {
  it("rejects payload_lbs below 20000", () => {
    const result = scenarioFormSchema.safeParse({
      corridor_key: "polb_cajon_pass",
      truck_slug: "ecascadia_438",
      weather_preset: "ideal",
      payload_lbs: 15000,
      port_drayage_enabled: false,
      include_charging: true,
    });
    assert.equal(result.success, false);
  });

  it("accepts demo corridor defaults", () => {
    const result = scenarioFormSchema.safeParse({
      corridor_key: "polb_cajon_pass",
      truck_slug: "ecascadia_438",
      weather_preset: "ideal",
      payload_lbs: 34000,
      port_drayage_enabled: false,
      include_charging: true,
    });
    assert.equal(result.success, true);
  });
});
