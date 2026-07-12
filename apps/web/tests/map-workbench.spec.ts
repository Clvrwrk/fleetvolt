import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 17 — map workbench e2e (DOM/layout/testids).
 * Live Google tile assertions are optional and skipped when Maps env is absent.
 */

async function withWorkbenchSession(page: Page) {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3017";
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

function visibleTestId(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"]:visible`);
}

async function gotoWorkbench(page: Page, mode: string) {
  await withWorkbenchSession(page);
  await page.goto(`/workbench?mode=${mode}`);
  // Next may retain a hidden route tree while streaming the new one. Test the
  // single user-visible workbench rather than matching the hidden cache tree.
  const shell = visibleTestId(page, "map-workbench-shell");
  await expect(shell).toHaveCount(1, { timeout: 20_000 });
  await expect(shell).toBeVisible({ timeout: 20_000 });
  await expect(shell).toHaveAttribute("data-workbench-mode", mode);
}

test.describe("map workbench — launchers and mode parsing", () => {
  test("fleet dashboard CTA launches contract-plan workbench", async ({ page }) => {
    await withWorkbenchSession(page);
    await page.goto("/fleet");
    const cta = page.getByRole("link", { name: /Plan Contract/i }).first();
    await expect(cta).toBeVisible({ timeout: 15_000 });
    await cta.click();
    await expect(page).toHaveURL(/mode=fleet_contract_plan/);
    await expect(visibleTestId(page, "map-workbench-shell")).toBeVisible();
  });

  test("caas route opens the gap-map workbench", async ({ page }) => {
    await withWorkbenchSession(page);
    await page.goto("/caas");
    const shell = visibleTestId(page, "map-workbench-shell");
    await expect(shell).toHaveCount(1, { timeout: 20_000 });
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute("data-workbench-mode", "caas_gap_map");
  });

  test("semantic launchers redirect into /workbench modes", async ({ page }) => {
    await withWorkbenchSession(page);
    await page.goto("/fleet/contract-plan");
    await expect(page).toHaveURL(/\/workbench\?mode=fleet_contract_plan/);
    await page.goto("/caas/gap-map");
    await expect(page).toHaveURL(/\/caas$/);
    await expect(visibleTestId(page, "map-workbench-shell")).toHaveAttribute(
      "data-workbench-mode",
      "caas_gap_map",
    );
  });

  test("/workbench parses mode query param", async ({ page }) => {
    await gotoWorkbench(page, "fleet_contract_plan");
    await expect(visibleTestId(page, "map-workbench-shell")).toHaveAttribute(
      "data-workbench-mode",
      "fleet_contract_plan",
    );
    await gotoWorkbench(page, "caas_gap_map");
    await expect(visibleTestId(page, "map-workbench-shell")).toHaveAttribute(
      "data-workbench-mode",
      "caas_gap_map",
    );
  });
});

test.describe("map workbench — desktop layout", () => {
  test("desktop full-viewport layout shows left tools, map, right cards", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWorkbench(page, "caas_gap_map");

    const shell = visibleTestId(page, "map-workbench-shell");
    await expect(shell).toBeVisible();
    await expect(visibleTestId(page, "workbench-left-panel")).toBeVisible();
    await expect(visibleTestId(page, "fleetvolt-map-canvas")).toBeVisible();
    const summaryToggle = page.getByRole("button", { name: /CaaS opportunity cards/i });
    await expect(summaryToggle).toBeVisible();
    await expect(page.getByTestId("workbench-right-panel")).toBeHidden();
    await summaryToggle.click();
    await expect(page.getByTestId("workbench-right-panel")).toBeVisible();
    const box = await shell.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThan(700);
  });
});

test.describe("map workbench — layers, markers, AI smoke", () => {
  test("layer toggles update pressed state", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWorkbench(page, "caas_gap_map");

    const parking = visibleTestId(page, "workbench-left-panel")
      .getByTestId("workbench-layer-toggle-parking");
    const initial = await parking.getAttribute("aria-pressed");
    expect(initial === "true" || initial === "false").toBeTruthy();
    await parking.click();
    await expect(parking).toHaveAttribute(
      "aria-pressed",
      initial === "true" ? "false" : "true",
    );
    await parking.click();
    await expect(parking).toHaveAttribute("aria-pressed", initial!);
  });

  test("marker click opens selected asset card when markers exist", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWorkbench(page, "caas_gap_map");

    const marker = page.getByTestId("workbench-asset-marker").first();
    const mapsReady =
      process.env.FLEETVOLT_E2E_MAPS === "1" &&
      Boolean(
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY &&
          process.env.NEXT_PUBLIC_GOOGLE_MAP_ID,
      );

    if (!mapsReady) {
      await expect(visibleTestId(page, "fleetvolt-map-canvas")).toBeVisible();
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

  test("AI command bar applies CaaS map actions and cards", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWorkbench(page, "caas_gap_map");

    const bar = visibleTestId(page, "workbench-left-panel")
      .getByTestId("ai-command-bar");
    await expect(bar).toBeVisible();

    // Prefer example chip (deterministic local fallback) over free-text submit.
    await page.getByTestId("ai-command-example").first().click();

    const summary = page.getByTestId("ai-command-summary");
    const cards = page.getByTestId("workbench-result-card");
    await expect(summary.or(cards.first())).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /CaaS opportunity cards/i }).click();
    await expect(cards.first()).toBeVisible();
  });
});
