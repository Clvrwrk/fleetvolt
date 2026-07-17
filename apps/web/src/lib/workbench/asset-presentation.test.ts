import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assetCardViewModel, assetMarkerPresentation } from "./asset-presentation";

describe("assetMarkerPresentation", () => {
  it("uses the required red, yellow, and green charger states", () => {
    assert.match(assetMarkerPresentation({ type: "charger", metadata: { isClass8Capable: false } }).fill, /red/);
    assert.match(assetMarkerPresentation({ type: "charger", metadata: { isClass8Capable: true } }).fill, /amber/);
    assert.match(
      assetMarkerPresentation({
        type: "charger",
        metadata: { isClass8Capable: true, trailerFriendly: true, class8Verified: true },
      }).fill,
      /emerald/,
    );
  });

  it("distinguishes traffic generators, fast food, fuel, and rest areas", () => {
    assert.equal(assetMarkerPresentation({ type: "poi", metadata: { kind: "traffic-generator" } }).label, "TG");
    assert.equal(assetMarkerPresentation({ type: "poi", metadata: { type: "fast_food" } }).label, "FF");
    assert.equal(assetMarkerPresentation({ type: "poi", metadata: { type: "fuel" } }).icon, "fuel");
    assert.equal(assetMarkerPresentation({ type: "poi", metadata: { type: "rest_area" } }).label, "RA");
  });
});

describe("assetCardViewModel", () => {
  it("shows decision-useful route facts without internal request hashes", () => {
    const model = assetCardViewModel({
      id: "route-1",
      type: "route",
      layerId: "route",
      label: "POLB to K-PAC",
      metadata: {
        requestHash: "secret-internal-hash",
        provider: "PTV",
        road: "5 mi",
        traffic: "p90 14.9K",
        charging: "1 Class 8",
        freshness: "Current",
      },
    });
    assert.equal(JSON.stringify(model).includes("secret-internal-hash"), false);
    assert.deepEqual(model.rows.map((row) => row.label), [
      "Routing provider",
      "Road distance",
      "Truck traffic",
      "Class 8 charging",
      "Route freshness",
    ]);
  });

  it("never exposes internal Convex or parking keys", () => {
    const model = assetCardViewModel({
      id: "p1",
      type: "parking",
      layerId: "parking",
      label: "Lot",
      metadata: { convexId: "secret", parkingKey: "internal", numberOfSpots: 42, amenities: ["toilet"] },
    });
    assert.equal(JSON.stringify(model).includes("secret"), false);
    assert.equal(JSON.stringify(model).includes("internal"), false);
    assert.deepEqual(model.pillGroups[0]?.values, ["TOILET"]);
  });

  it("counts actual connectors and renders connector data as pills", () => {
    const model = assetCardViewModel({
      id: "c1",
      type: "charger",
      layerId: "chargers",
      label: "Charger",
      metadata: {
        isClass8Capable: true,
        connectors: [
          { port_count: 1, connectors: { CCS: { port_count: 1 } } },
          { port_count: 1, connectors: { MCS: { port_count: 1 } } },
        ],
        connectorTypes: ["ccs", "mcs"],
        evDcFastNum: 9,
      },
    });
    assert.equal(model.rows.find((row) => row.label === "Available plugs")?.value, "2");
    assert.deepEqual(model.pillGroups.find((group) => group.label === "Connector types")?.values, ["CCS", "MCS"]);
    assert.deepEqual(model.pillGroups.find((group) => group.label === "Connectors")?.values, ["CCS ×1", "MCS ×1"]);
  });

  it("turns raw OSM tags into readable attribute pills", () => {
    const model = assetCardViewModel({
      id: "r1",
      type: "poi",
      layerId: "pois",
      label: "Rest area",
      metadata: { type: "rest_area", tags: { highway: "rest_area", toilets: "yes" } },
    });
    assert.deepEqual(model.pillGroups[0]?.values, ["REST AREA", "YES"]);
  });

  it("shows useful carrier contact and fleet facts without internal keys", () => {
    const model = assetCardViewModel({
      id: "carrier-1",
      type: "carrier",
      layerId: "carriers",
      label: "Example Freight",
      metadata: {
        carrierKey: "internal-key",
        address: "100 Harbor Way",
        city: "Long Beach",
        state: "CA",
        zip: "90802",
        contactName: "Operations Desk",
        phone: "562-555-0100",
        email: "dispatch@example.com",
        tractorCount: 42,
        website: "https://example.com",
      },
    });
    assert.equal(JSON.stringify(model).includes("internal-key"), false);
    assert.deepEqual(model.rows.map((row) => row.label), [
      "Address",
      "Contact",
      "Phone",
      "Email",
      "Tractors / power units",
    ]);
  });
});
