import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Mirror of prep_traffic_generators.py web_mercator_to_wgs84. */
function webMercatorToWgs84(x: number, y: number): { lat: number; lng: number } {
  const lon = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return { lat, lng: lon };
}

describe("webMercatorToWgs84", () => {
  it("converts POLB-area generator to SoCal lat/lng", () => {
    // First row of Major_Traffic_Generators.csv (Pacific Harbor Line)
    const { lat, lng } = webMercatorToWgs84(-13165140.5793, 3997498.3041);
    assert.ok(lat > 33.5 && lat < 34.2, `lat=${lat}`);
    assert.ok(lng > -118.5 && lng < -117.8, `lng=${lng}`);
  });

  it("converts Oakland generator to Bay Area", () => {
    const { lat, lng } = webMercatorToWgs84(-13615621.6155, 4554461.6007);
    assert.ok(lat > 37.5 && lat < 38.2, `lat=${lat}`);
    assert.ok(lng > -122.5 && lng < -122.0, `lng=${lng}`);
  });
});
