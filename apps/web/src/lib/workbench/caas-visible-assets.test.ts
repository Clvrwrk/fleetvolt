import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkbenchMapAsset } from "@/components/workbench/map-workbench/layers/asset-marker-layer";
import {
  caasVisibleAssets,
  caasVisiblePointLayers,
} from "./caas-visible-assets";

function zone(id: string): WorkbenchMapAsset {
  return {
    id,
    type: "caas-zone",
    layerId: "caas-zones",
    label: id,
    latitude: 34,
    longitude: -118,
  };
}

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
  it("requests CaaS zones only while the heat layer is active", () => {
    assert.deepEqual(
      caasVisiblePointLayers(["chargers", "class8-gaps", "caas-zones", "geo-regions"]),
      ["chargers", "class8-gaps", "caas-zones"],
    );
    assert.deepEqual(caasVisiblePointLayers(["chargers", "geo-regions"]), [
      "chargers",
    ]);
  });

  it("merges returned CaaS zones into the shared map asset contract", () => {
    const result = caasVisibleAssets({
      chargers: [],
      class8Gaps: [gap("gap-la-basin")],
      caasZones: [zone("zone-la-basin")],
    });

    assert.deepEqual(result.map((asset) => asset.id), ["gap-la-basin", "zone-la-basin"]);
    assert.equal(result[0]?.layerId, "class8-gaps");
    assert.equal(result[0]?.type, "class8-gap");
  });
});
