import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCatalogVehicleFromHvipRow,
  classLabelFromGvwr,
  parseIncentiveUsd,
  parsePrimaryPackKwh,
} from "./from-hvip-csv.js";
import { catalogSlug } from "./slug.js";

describe("buildCatalogVehicleFromHvipRow", () => {
  it("parses incentive and pack from HVIP CSV row", () => {
    const vehicle = buildCatalogVehicleFromHvipRow(
      {
        Model: "eCascadia",
        Category: "Tractor",
        OEM: "Freightliner",
        "Technology Type": "Battery Electric",
        "Vehicle Incentive": "120,000",
        "Vehicle Size": "",
        Dealers: "Demo Dealer",
        "New or Conversion": "New",
        Battery: "438 kWh",
        "Model Year": "2024, 2025, 2026",
        GVWR: "Class 8: $120,000",
        "Vehicle Type": "Tractor",
        URL: "https://californiahvip.org/vehicles/freightliner-ecascadia-battery-electric-tractor/",
      },
      {
        physicsTrucks: [
          {
            slug: "ecascadia_438",
            name: "Freightliner eCascadia 438 kWh",
            oem: "Freightliner",
            modelHints: ["ecascadia"],
            packKwh: 438,
            streetEfficiencyKwhPerMi: { min: 2.0, max: 2.3, typical: 2.165 },
          },
        ],
        peerKwhPerMiMin: 1.8,
        peerKwhPerMiMax: 2.5,
      },
    );
    assert.equal(vehicle.hvipIncentiveUsd, 120_000);
    assert.equal(vehicle.packKwh, 438);
    assert.equal(vehicle.physicsTruckSlug, "ecascadia_438");
    assert.equal(vehicle.energyEstimatePending, false);
    assert.ok(vehicle.kwhPerMiCombined !== null);
    assert.ok(vehicle.emissionsAnnual !== null);
  });

  it("marks energy pending when no physics link", () => {
    const vehicle = buildCatalogVehicleFromHvipRow(
      {
        Model: "Unknown Van",
        Category: "Step & Panel Van",
        OEM: "Acme",
        "Technology Type": "Battery Electric",
        "Vehicle Incentive": "45,000",
        "Vehicle Size": "",
        Dealers: "",
        "New or Conversion": "New",
        Battery: "100 kWh",
        "Model Year": "2025",
        GVWR: "",
        "Vehicle Type": "Van",
        URL: "https://example.com",
      },
      { physicsTrucks: [], peerKwhPerMiMin: null, peerKwhPerMiMax: null },
    );
    assert.equal(vehicle.physicsTruckSlug, null);
    assert.equal(vehicle.energyEstimatePending, true);
    assert.equal(vehicle.kwhPerMiCombined, null);
    assert.equal(vehicle.emissionsAnnual, null);
  });
});

describe("parseIncentiveUsd", () => {
  it("parses comma-formatted dollar amounts", () => {
    assert.equal(parseIncentiveUsd("120,000"), 120_000);
  });

  it("returns null for empty strings", () => {
    assert.equal(parseIncentiveUsd(""), null);
  });

  it("returns null for non-numeric values", () => {
    assert.equal(parseIncentiveUsd("N/A"), null);
  });
});

describe("parsePrimaryPackKwh", () => {
  it("extracts kWh from battery strings", () => {
    assert.equal(parsePrimaryPackKwh("438 kWh"), 438);
  });

  it("returns null when battery capacity is unknown", () => {
    assert.equal(parsePrimaryPackKwh("TBD"), null);
  });
});

describe("catalogSlug", () => {
  it("builds a slug from OEM, model, and pack size", () => {
    assert.equal(
      catalogSlug("Freightliner", "eCascadia", 438),
      "freightliner-ecascadia-438",
    );
  });
});

describe("classLabelFromGvwr", () => {
  it("extracts class number from GVWR strings", () => {
    assert.equal(classLabelFromGvwr("Class 8: $120,000", "Tractor"), "Class 8");
  });

  it("defaults tractors to Class 8 when GVWR is empty", () => {
    assert.equal(classLabelFromGvwr("", "Tractor"), "Class 8");
  });
});
