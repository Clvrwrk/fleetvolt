import assert from "node:assert/strict";
import test from "node:test";
import { buildClass8GapCandidates } from "./class8-gap-candidates";

test("builds an explainable GAP pin on a mapped parking candidate", () => {
  const assets = buildClass8GapCandidates({
    route: { midpoint: { lat: 35, lng: -119 } },
    gap: { classification: "true-gap", class8WithinCorridor: 0, nearestClass8DistanceLabel: "18.2 mi" },
    hotspot: {
      parking: { totalSpots: 48, parking: [{ name: "Freight staging", location: { lat: 35.1, lng: -119.1 }, numberOfSpots: 48, hgv: true }] },
      pois: { pois: [] },
      whatsMissing: { mobileEnergyOpportunity: true, noClass8Charging: true },
    },
    mobilePositioning: { recommended: true, priority: "high", recommendedPowerKw: 1000 },
    source: { function: "workbench/queries:analyzeCaasRouteOpportunity" },
  });
  assert.equal(assets.length, 1);
  assert.equal(assets[0]?.layerId, "class8-gaps");
  assert.match(String(assets[0]?.metadata?.whyGap), /No verified Class 8/);
  assert.match(String(assets[0]?.metadata?.whyHere), /48 mapped spaces/);
  assert.equal(assets[0]?.metadata?.recommendedPower, "1000 kW mobile bridge");
});

test("uses a labeled midpoint fallback when no physical dwell asset is available", () => {
  const assets = buildClass8GapCandidates({
    route: { midpoint: { lat: 35.25, lng: -119.25 } },
    gap: { classification: "detour-solvable", class8WithinCorridor: 0 },
    hotspot: { parking: { parking: [] }, pois: { pois: [] }, whatsMissing: { mobileEnergyOpportunity: true } },
    mobilePositioning: { recommended: true, point: { lat: 35.2, lng: -119.2 }, recommendedPowerKw: 500 },
  });
  assert.equal(assets.length, 1);
  assert.equal(assets[0]?.metadata?.siteType, "Modeled corridor midpoint");
  assert.match(String(assets[0]?.metadata?.confidence), /Low/);
  assert.match(String(assets[0]?.metadata?.status), /not a verified deployment site/);
});

test("does not fabricate a candidate for a covered corridor without modeled opportunity", () => {
  const assets = buildClass8GapCandidates({
    route: { midpoint: { lat: 35, lng: -119 }, approximateMiles: 42 },
    gap: { classification: "covered", class8WithinCorridor: 4 },
    hotspot: { whatsMissing: { mobileEnergyOpportunity: false, noClass8Charging: false } },
    mobilePositioning: { recommended: false },
  });
  assert.deepEqual(assets, []);
});

test("flags unvalidated charger capacity on a long corridor as a capacity-review hypothesis", () => {
  const assets = buildClass8GapCandidates({
    route: { midpoint: { lat: 34.9, lng: -118.9 }, approximateMiles: 152 },
    gap: { classification: "covered", class8WithinCorridor: 8 },
    hotspot: { parking: { parking: [] }, pois: { pois: [] }, whatsMissing: { mobileEnergyOpportunity: false } },
    mobilePositioning: { recommended: false },
  });
  assert.equal(assets.length, 1);
  assert.equal(assets[0]?.metadata?.classification, "capacity-review");
  assert.match(String(assets[0]?.metadata?.whyGap), /does not verify useful capacity/);
  assert.match(String(assets[0]?.metadata?.whyGap), /152-mile/);
});

test("derives long-corridor review distance from endpoints when deployed evidence lacks approximate miles", () => {
  const assets = buildClass8GapCandidates({
    route: {
      midpoint: { lat: 34.6, lng: -118.7 },
      origin: { lat: 33.7542, lng: -118.2165 },
      destination: { lat: 35.5005, lng: -119.2718 },
    },
    gap: { classification: "covered", class8WithinCorridor: 12 },
    hotspot: { whatsMissing: { mobileEnergyOpportunity: false } },
    mobilePositioning: { recommended: false },
  });
  assert.equal(assets.length, 1);
  assert.equal(assets[0]?.metadata?.classification, "capacity-review");
});
