import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkbenchMapAsset } from "@/components/workbench/map-workbench/layers/asset-marker-layer";
import {
  caasVisibleAssets,
  caasVisiblePointLayers,
} from "./caas-visible-assets";

function gap(id: string): WorkbenchMapAsset {
  return {
    id,
    type: "class8-gap",
    layerId: "class8-gaps",
    label: id,
    latitude: 34,
    longitude: -118,
  };
}

describe("CaaS visible asset adapter", () => {
  it("does not request the retired single-point heat surface", () => {
    assert.deepEqual(
      caasVisiblePointLayers(["chargers", "class8-gaps", "caas-zones", "geo-regions"]),
      ["chargers", "class8-gaps"],
    );
    assert.deepEqual(caasVisiblePointLayers(["chargers", "geo-regions"]), [
      "chargers",
    ]);
  });

  it("merges the supported live point layers into the shared map asset contract", () => {
    const result = caasVisibleAssets({
      chargers: [],
      class8Gaps: [gap("gap-la-basin")],
    });

    assert.deepEqual(result.map((asset) => asset.id), ["gap-la-basin"]);
    assert.equal(result[0]?.layerId, "class8-gaps");
    assert.equal(result[0]?.type, "class8-gap");
  });
});
