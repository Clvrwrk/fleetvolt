import assert from "node:assert/strict";
import test from "node:test";
import { safeReviewPath } from "./review-session";

test("review path accepts local application paths", () => {
  assert.equal(safeReviewPath("/workbench?mode=driver_day_plan"), "/workbench?mode=driver_day_plan");
});

test("review path rejects absolute and protocol-relative redirects", () => {
  assert.equal(safeReviewPath("https://example.com"), "/caas");
  assert.equal(safeReviewPath("//example.com"), "/caas");
  assert.equal(safeReviewPath(null), "/caas");
});

