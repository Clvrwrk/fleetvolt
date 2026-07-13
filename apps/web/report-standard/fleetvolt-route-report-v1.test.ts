import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FLEETVOLT_REPORT_DESIGN_TOKENS,
  FLEETVOLT_REPORT_NARRATIVE_CONTRACT,
  FLEETVOLT_REPORT_PAGE_SEQUENCE,
  FLEETVOLT_REPORT_STANDARD,
  FLEETVOLT_REPORT_STANDARD_NAME,
  FLEETVOLT_REPORT_STANDARD_VERSION,
} from "./fleetvolt-route-report-v1.js";

test("route report v1 is locked and has the approved ten-page sequence", () => {
  assert.equal(FLEETVOLT_REPORT_STANDARD_VERSION, "1.0.0");
  assert.equal(FLEETVOLT_REPORT_STANDARD.locked, true);
  assert.equal(FLEETVOLT_REPORT_PAGE_SEQUENCE.length, 10);
  assert.match(FLEETVOLT_REPORT_STANDARD_NAME, /Command Brief/);
  assert.match(FLEETVOLT_REPORT_STANDARD_NAME, /Corridor White Paper/);
});

test("route report v1 preserves evidence and emissions rules", () => {
  assert.match(FLEETVOLT_REPORT_NARRATIVE_CONTRACT, /diesel Class-8/i);
  assert.match(FLEETVOLT_REPORT_NARRATIVE_CONTRACT, /battery-electric Class-8/i);
  assert.match(FLEETVOLT_REPORT_NARRATIVE_CONTRACT, /equal work and equal distance/i);
  assert.match(FLEETVOLT_REPORT_NARRATIVE_CONTRACT, /Not verified/);
  assert.match(FLEETVOLT_REPORT_NARRATIVE_CONTRACT, /Never fabricate/i);
});

test("route report v1 preserves the approved visual language", () => {
  assert.equal(FLEETVOLT_REPORT_DESIGN_TOKENS.colors.paper, "#FBFAF5");
  assert.match(FLEETVOLT_REPORT_DESIGN_TOKENS.typography.technical, /Arcline/);
  assert.match(FLEETVOLT_REPORT_DESIGN_TOKENS.logo, /black FLEET/);
  assert.match(FLEETVOLT_REPORT_NARRATIVE_CONTRACT, /footer collisions/);
});
