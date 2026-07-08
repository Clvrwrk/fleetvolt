// P15-01: Unit tests for hotspot-zoom.ts (zoom thresholds, score→color, score→radius).
// Run: node --import tsx --test src/lib/hotspot-zoom.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  zoomLevelForZoom,
  scoreToColor,
  scoreToRadiusPx,
  ZOOM_THRESHOLDS,
} from "./hotspot-zoom.js";

// ── zoomLevelForZoom ─────────────────────────────────────────────────────────
test("zoomLevelForZoom: zoom 3 → nation", () => {
  assert.equal(zoomLevelForZoom(3), "nation");
});

test("zoomLevelForZoom: zoom 5 → nation (boundary)", () => {
  assert.equal(zoomLevelForZoom(5), "nation");
});

test("zoomLevelForZoom: zoom 6 → state", () => {
  assert.equal(zoomLevelForZoom(6), "state");
});

test("zoomLevelForZoom: zoom 7 → state", () => {
  assert.equal(zoomLevelForZoom(7), "state");
});

test("zoomLevelForZoom: zoom 8 → state (boundary)", () => {
  assert.equal(zoomLevelForZoom(8), "state");
});

test("zoomLevelForZoom: zoom 9 → county", () => {
  assert.equal(zoomLevelForZoom(9), "county");
});

test("zoomLevelForZoom: zoom 11 → county", () => {
  assert.equal(zoomLevelForZoom(11), "county");
});

test("ZOOM_THRESHOLDS exports nation=5, state=8", () => {
  assert.equal(ZOOM_THRESHOLDS.nation, 5);
  assert.equal(ZOOM_THRESHOLDS.state, 8);
});

// ── scoreToColor ─────────────────────────────────────────────────────────────
test("scoreToColor: score 0 → gray (#6b7280)", () => {
  assert.equal(scoreToColor(0), "#6b7280");
});

test("scoreToColor: score 1 → dark red", () => {
  const c = scoreToColor(1);
  assert.ok(
    c === "#dc2626" || c === "#ef4444",
    `expected red-ish, got ${c}`,
  );
});

test("scoreToColor: score 0.3 → amber", () => {
  assert.equal(scoreToColor(0.3), "#fbbf24");
});

test("scoreToColor: returns valid hex format", () => {
  const c = scoreToColor(0.5);
  assert.match(c, /^#[0-9A-Fa-f]{6}$/);
});

test("scoreToColor: clamps negative to 0", () => {
  assert.equal(scoreToColor(-5), "#6b7280");
});

test("scoreToColor: clamps >1 to 1", () => {
  assert.equal(scoreToColor(99), "#dc2626");
});

// ── scoreToRadiusPx ──────────────────────────────────────────────────────────
test("scoreToRadiusPx: score 0 → 6", () => {
  assert.equal(scoreToRadiusPx(0), 6);
});

test("scoreToRadiusPx: score 1 → 18", () => {
  assert.equal(scoreToRadiusPx(1), 18);
});

test("scoreToRadiusPx: score 0.5 → 12", () => {
  assert.equal(scoreToRadiusPx(0.5), 12);
});

test("scoreToRadiusPx: clamps negative to 6", () => {
  assert.equal(scoreToRadiusPx(-10), 6);
});

test("scoreToRadiusPx: clamps >1 to 18", () => {
  assert.equal(scoreToRadiusPx(42), 18);
});
