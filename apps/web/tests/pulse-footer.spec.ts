import { test, expect } from "@playwright/test";

/**
 * Phase 7 / Wave 3 (plan 07-05) — SRC-02
 * Nyquist signal: "Sources footer always-visible with citations"
 */
test.describe("/pulse — sources footer", () => {
  test.fixme(
    "shows a persistent sources footer citing datasets + illustrative-data disclaimer",
    async ({ page }) => {
      // TODO(07-05): assert [data-testid="sources-footer"] visible;
      // cites FAF5/Caltrans/FHWA/FMCSA/ports; states flow animation is illustrative.
      await page.goto("/pulse");
      await expect(page.getByTestId("sources-footer")).toBeVisible();
    },
  );
});
