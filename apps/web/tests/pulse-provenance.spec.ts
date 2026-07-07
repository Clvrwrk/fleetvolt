import { test, expect } from "@playwright/test";

/**
 * Phase 7 / Wave 3 (plan 07-05) — SRC-04, DINT-01, DINT-03
 * Nyquist signals: "Simulated ≠ measured (distinct badge)" + provenance visible.
 */
test.describe("/pulse — data provenance & simulated labeling", () => {
  test.fixme(
    "simulated records show a distinct badge and layers expose provenance",
    async ({ page }) => {
      // TODO(07-05): assert a SIMULATED/ESTIMATE record renders the orange
      // "Simulated" badge and never as measured; provenance {source,year} visible.
      await page.goto("/pulse");
      await expect(page.getByTestId("simulated-badge")).toBeVisible();
    },
  );
});
