import { test, expect } from "@playwright/test";

/**
 * Phase 7 / Wave 2 (plan 07-03) — FLOW-01, FLOW-07
 * Nyquist signal: "Vector map renders with mapId, CAD cloud style, CA framing"
 * Real assertions land when PulseMap ships. Stub lists but does not run.
 */
test.describe("/pulse — vector map base", () => {
  test.fixme(
    "renders a Google vector map framed on the CA coast with CAD cloud styling",
    async ({ page }) => {
      // TODO(07-03): goto /pulse; wait for [data-testid="pulse-map"] canvas;
      // assert map loaded (no "map failed"), vector mapId applied, CA bounds framed.
      await page.goto("/pulse");
      await expect(page.getByTestId("pulse-map")).toBeVisible();
    },
  );
});
