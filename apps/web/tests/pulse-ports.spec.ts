import { test, expect } from "@playwright/test";

/**
 * Phase 7 / Wave 2 (plan 07-03) — FLOW-02, SHELL-06
 * Nyquist signal: "Port anchors present & selectable (6 AdvancedMarkers)"
 */
test.describe("/pulse — port anchors & selector", () => {
  test.fixme(
    "shows 6 port AdvancedMarkers and focuses one via the port selector",
    async ({ page }) => {
      // TODO(07-03): assert POLA/POLB/HUE/OAK/SF/SD markers present;
      // selecting a port reframes the map to that port.
      await page.goto("/pulse");
      await expect(page.getByTestId("port-anchor")).toHaveCount(6);
    },
  );
});
