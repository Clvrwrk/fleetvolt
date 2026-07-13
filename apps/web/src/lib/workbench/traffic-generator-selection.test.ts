import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { trafficGeneratorSelection } from "./traffic-generator-selection";

describe("trafficGeneratorSelection", () => {
  it("builds the same typed POI selection used by every generator marker", () => {
    const selection = trafficGeneratorSelection({
      generatorId: "gen-1",
      name: "Bakersfield QDC",
      assoc: "warehouse",
      city: "Bakersfield",
      county: "Kern",
      zip: "93312",
      district: "6",
      location: { lat: 35.44, lng: -119.19 },
      portCode: "HUE",
      distanceMiles: 18.2,
    });

    assert.equal(selection.id, "gen-1");
    assert.equal(selection.type, "poi");
    assert.equal(selection.layerId, "pois");
    assert.equal(selection.metadata?.kind, "traffic-generator");
    assert.equal(selection.metadata?.distanceMiles, 18.2);
    assert.match(String(selection.metadata?.carrierHref), /zip=93312/);
  });
});
