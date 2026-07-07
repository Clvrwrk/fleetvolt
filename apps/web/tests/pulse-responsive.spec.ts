import { test, expect } from "@playwright/test";

/**
 * Phase 7 / Wave 1 (plan 07-02) — SHELL-04
 * Nyquist signal: "Responsive: desktop frame; tablet accordion"
 */
test.describe("/pulse — responsive layout", () => {
  test.fixme("desktop shows full framed layout", async ({ page }) => {
    // TODO(07-02): at 1440x900 assert framed map + control panel side-by-side.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/pulse");
    await expect(page.getByTestId("technical-frame")).toBeVisible();
  });

  test.fixme("tablet collapses control panel to accordion", async ({ page }) => {
    // TODO(07-02): at 834x1112 assert control panel collapses to accordion/bottom sheet.
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.goto("/pulse");
    await expect(page.getByTestId("control-panel-accordion")).toBeVisible();
  });
});
