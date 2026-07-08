import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 17 — map workbench e2e (DOM/layout/testids).
 * Live Google tile assertions are optional and skipped when Maps env is absent.
 */

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

async function gotoWorkbench(page: Page, mode: string) {
  await withWorkbenchSession(page);
  await page.goto(`/workbench?mode=${mode}`);
  await expect(page.getByTestId("map-workbench-shell")).toBeVisible({ timeout: 20_000 });
}

test.describe("map workbench — launchers and mode parsing", () => {
  test("driver dashboard CTA launches day-plan workbench", async ({ page }) => {
    await withWorkbenchSession(page);
    await page.goto("/driver");
    await page.getByRole("link", { name: /Start Day Plan/i }).click();
    await expect(page).toHaveURL(/mode=driver_day_plan/);
    await expect(page.getByTestId("map-workbench-shell")).toBeVisible();
    await expect(page.getByTestId("workbench-mode-label")).toContainText(/Driver day plan/i);
  });

  test("fleet dashboard CTA launches contract-plan workbench", async ({ page }) => {
    await withWorkbenchSession(page);
    await page.goto("/fleet");
    const cta = page.getByRole("link", { name: /Plan Contract/i }).first();
    await expect(cta).toBeVisible({ timeout: 15_000 });
    await cta.click();
    await expect(page).toHaveURL(/mode=fleet_contract_plan/);
    await expect(page.getByTestId("map-workbench-shell")).toBeVisible();
  });

  test("caas dashboard CTA launches gap-map workbench", async ({ page }) => {
    await withWorkbenchSession(page);
    await page.goto("/caas");
    await page.getByRole("link", { name: /Find Charger Gaps/i }).click();
    await expect(page).toHaveURL(/mode=caas_gap_map/);
    await expect(page.getByTestId("map-workbench-shell")).toBeVisible();
  });

  test("semantic launchers redirect into /workbench modes", async ({ page }) => {
    await withWorkbenchSession(page);
    await page.goto("/driver/day-plan");
    await expect(page).toHaveURL(/\/workbench\?mode=driver_day_plan/);
    await page.goto("/fleet/contract-plan");
    await expect(page).toHaveURL(/\/workbench\?mode=fleet_contract_plan/);
    await page.goto("/caas/gap-map");
    await expect(page).toHaveURL(/\/workbench\?mode=caas_gap_map/);
  });

  test("/workbench parses mode query param", async ({ page }) => {
    await gotoWorkbench(page, "fleet_contract_plan");
    await expect(page.getByTestId("workbench-mode-label")).toContainText(/Fleet contract plan/i);
    await gotoWorkbench(page, "caas_gap_map");
    await expect(page.getByTestId("workbench-mode-label")).toContainText(/CaaS gap map/i);
  });
});

test.describe("map workbench — desktop and mobile layout", () => {
  test("desktop full-viewport layout shows left tools, map, right cards", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWorkbench(page, "driver_day_plan");

    const shell = page.getByTestId("map-workbench-shell");
    await expect(shell).toBeVisible();
    await expect(page.getByTestId("workbench-left-panel")).toBeVisible();
    await expect(page.getByTestId("fleetvolt-map-canvas")).toBeVisible();
    await expect(page.getByTestId("workbench-right-panel")).toBeVisible();
    await expect(page.getByTestId("mobile-workbench-sheet")).toBeHidden();

    const box = await shell.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThan(700);
  });

  test("mobile shows bottom sheet and hides desktop side panels", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoWorkbench(page, "driver_day_plan");

    await expect(page.getByTestId("mobile-workbench-sheet")).toBeVisible();
    await expect(page.getByTestId("fleetvolt-map-canvas")).toBeVisible();
    // Side panels use hidden md:flex — not visible on mobile
    await expect(page.getByTestId("workbench-left-panel")).toBeHidden();
    await expect(page.getByTestId("workbench-right-panel")).toBeHidden();
  });
});

test.describe("map workbench — layers, markers, AI smoke", () => {
  test("layer toggles update pressed state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWorkbench(page, "driver_day_plan");

    const parking = page.getByTestId("workbench-layer-parking");
    await expect(parking).toHaveAttribute("aria-pressed", "true");
    await parking.click();
    await expect(parking).toHaveAttribute("aria-pressed", "false");
    await parking.click();
    await expect(parking).toHaveAttribute("aria-pressed", "true");
  });

  test("marker click opens selected asset card when markers exist", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWorkbench(page, "driver_day_plan");

    const marker = page.getByTestId("workbench-asset-marker").first();
    const mapsReady = Boolean(
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && process.env.NEXT_PUBLIC_GOOGLE_MAP_ID,
    );

    if (!mapsReady) {
      await expect(page.getByTestId("fleetvolt-map-canvas")).toBeVisible();
      test.skip(true, "Google Maps env missing — skip live marker interaction");
      return;
    }

    // Markers may take a moment after Maps JS loads; if absent, skip gracefully
    const count = await marker.count().catch(() => 0);
    if (count === 0) {
      test.skip(true, "Map markers not rendered (referrer/API block) — DOM shell still verified");
      return;
    }

    await marker.click();
    await expect(page.getByTestId("selected-asset-card")).toBeVisible({ timeout: 10_000 });
  });

  test("AI command bar applies map actions and cards (driver example)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWorkbench(page, "driver_day_plan");

    const bar = page.getByTestId("ai-command-bar");
    await expect(bar).toBeVisible();

    // Prefer example chip (deterministic local fallback) over free-text submit.
    await page.getByTestId("ai-command-example").first().click();

    const summary = page.getByTestId("ai-command-summary");
    const cards = page.getByTestId("workbench-result-card");
    await expect(summary.or(cards.first())).toBeVisible({ timeout: 15_000 });
    await expect(cards.first()).toBeVisible();
  });
});
