// Unit test for the OSM tag -> pois.type classifier (P12-14, T-12-07b).
//
// Guards against the Python extractor (data/ingest/osm/extract_pois.py) and the
// Convex classifier (pois/classify.ts) drifting: both encode the SAME precedence
// spec. Every branch + the fuel-over-convenience precedence + the hgv-required
// rule for truck_parking + null-for-unmatched is asserted here.
//
// Run: cd apps/web && node --import tsx --test convex/pois/extract.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPoi, matchedTag } from "./classify";

test("amenity=fuel -> fuel", () => {
  assert.equal(classifyPoi({ amenity: "fuel" }), "fuel");
});

test("amenity=parking + hgv=yes -> truck_parking", () => {
  assert.equal(classifyPoi({ amenity: "parking", hgv: "yes" }), "truck_parking");
});

test("amenity=parking + access=hgv -> truck_parking", () => {
  assert.equal(classifyPoi({ amenity: "parking", access: "hgv" }), "truck_parking");
});

test("amenity=parking with NO hgv/access -> null (not truck parking)", () => {
  assert.equal(classifyPoi({ amenity: "parking" }), null);
});

test("highway=rest_area -> rest_area", () => {
  assert.equal(classifyPoi({ highway: "rest_area" }), "rest_area");
});

test("highway=services -> rest_area", () => {
  assert.equal(classifyPoi({ highway: "services" }), "rest_area");
});

test("shop=convenience -> convenience", () => {
  assert.equal(classifyPoi({ shop: "convenience" }), "convenience");
});

test("amenity=fast_food -> fast_food", () => {
  assert.equal(classifyPoi({ amenity: "fast_food" }), "fast_food");
});

test("precedence: amenity=fuel + shop=convenience -> fuel (most specific)", () => {
  assert.equal(classifyPoi({ amenity: "fuel", shop: "convenience" }), "fuel");
});

test("unmatched tags -> null", () => {
  assert.equal(classifyPoi({ amenity: "bench", tourism: "hotel" }), null);
  assert.equal(classifyPoi({}), null);
});

test("matchedTag records the provenance input string", () => {
  assert.equal(matchedTag({ amenity: "fuel" }, "fuel"), "amenity=fuel");
  assert.equal(
    matchedTag({ amenity: "parking", hgv: "yes" }, "truck_parking"),
    "amenity=parking,hgv=yes",
  );
  assert.equal(
    matchedTag({ amenity: "parking", access: "hgv" }, "truck_parking"),
    "amenity=parking,access=hgv",
  );
  assert.equal(matchedTag({ highway: "rest_area" }, "rest_area"), "highway=rest_area");
  assert.equal(matchedTag({ shop: "convenience" }, "convenience"), "shop=convenience");
  assert.equal(matchedTag({ amenity: "fast_food" }, "fast_food"), "amenity=fast_food");
});
