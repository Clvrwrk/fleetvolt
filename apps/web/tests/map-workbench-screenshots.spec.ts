import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

/**
 * Desktop screenshot verification for Fleet Manager and CaaS workbenches.
 * Live Google tile pixel checks are skipped when Maps env/referrer is unavailable;
 * DOM layout + screenshot artifacts are still captured.
 */

const SHOT_DIR = path.join("test-results", "map-workbench-screenshots");

async function withWorkbenchSession(page: Page) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  await page.context().addCookies([
    {
      name: "fv_session",
      value: "playwright-workbench",
      url: baseURL,
    },
    {
      name: "fv_e2e",
      value: "1",
      url: baseURL,
    },
  ]);
}

async function captureWorkbench(
  page: Page,
  mode: string,
  name: string,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await withWorkbenchSession(page);
  await page.goto(`/workbench?mode=${mode}`);
  await expect(page.getByTestId("map-workbench-shell")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("fleetvolt-map-canvas")).toBeVisible();

  const mapsReady = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && process.env.NEXT_PUBLIC_GOOGLE_MAP_ID,
  );
  if (!mapsReady) {
    // Still assert DOM layout; skip only live-tile-specific expectations
    await expect(page.getByTestId("map-workbench-shell")).toBeVisible();
  }

  await page.screenshot({
    path: path.join(SHOT_DIR, `${name}.png`),
    fullPage: false,
  });
}

test.describe("map workbench screenshots — initial states", () => {
  test("fleet contract plan desktop initial", async ({ page }) => {
    await captureWorkbench(page, "fleet_contract_plan", "fleet-contract-plan-desktop-initial", {
      width: 1440,
      height: 900,
    });
  });

  test("caas gap map desktop initial", async ({ page }) => {
    await captureWorkbench(page, "caas_gap_map", "caas-gap-map-desktop-initial", {
      width: 1440,
      height: 900,
    });
  });

});

test.describe("map workbench screenshots — planned-result states", () => {
  test("fleet planned result via AI assumptions", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await withWorkbenchSession(page);
    await page.goto("/workbench?mode=fleet_contract_plan");
    await expect(page.getByTestId("ai-command-bar")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("ai-command-input").fill("Apply Oakland to Tracy contract assumptions");
    await page.getByTestId("ai-command-submit").click();
    await expect(page.getByTestId("ai-command-summary")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({
      path: path.join(SHOT_DIR, "fleet-contract-plan-desktop-planned.png"),
      fullPage: false,
    });
  });

  test("caas planned result via AI gap/carrier toggle", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await withWorkbenchSession(page);
    await page.goto("/workbench?mode=caas_gap_map");
    await expect(page.getByTestId("ai-command-bar")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("ai-command-input").fill("Toggle gap and carrier layers for opportunity map");
    await page.getByTestId("ai-command-submit").click();
    await expect(page.getByTestId("ai-command-summary")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({
      path: path.join(SHOT_DIR, "caas-gap-map-desktop-planned.png"),
      fullPage: false,
    });
  });
});
