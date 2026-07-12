import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { localAiFallback } from "@/components/workbench/map-workbench/ai-command-bar";

describe("AI map command presets", () => {
  it("isolates road-traced west coast freight layers", () => {
    const result = localAiFallback(
      "caas_gap_map",
      "Show freight volume out of west coast ports",
    );

    assert.match(result.answerSummary, /road-traced freight volume/i);
    assert.deepEqual(result.mapActions, [
      {
        type: "set_layers",
        layers: ["ports", "freight-flow", "geo-regions", "highways"],
      },
      {
        type: "focus_bounds",
        bounds: { north: 49.2, south: 31.2, east: -112, west: -126.5 },
      },
    ]);
    assert.equal(result.cards[0]?.id, "ai-caas-west-coast-freight");
  });
});
