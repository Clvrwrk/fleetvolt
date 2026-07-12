import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PUBLIC_SURFACES = ["/", "/role-select", "/briefing", "/catalog"] as const;
const INTERNAL_SURFACES = [
  "/fleet",
  "/fleet/setup",
  "/fleet/contract-plan",
  "/driver",
  "/driver/setup",
  "/driver/day-plan",
  "/caas",
  "/caas/setup",
  "/planner",
  "/hotspot",
  "/status",
  "/load",
  "/unit",
  "/workbench?mode=caas_gap_map",
] as const;
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "ipad", width: 1024, height: 1366 },
  { name: "mobile", width: 390, height: 844 },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.clientWidth,
  );
}

async function expectNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === "critical" || violation.impact === "serious",
  );
  expect(
    blocking,
    blocking.map((item) => `${item.id}: ${item.help}`).join("\n"),
  ).toEqual([]);
}

test.describe("FleetVolt enterprise design compliance", () => {
  for (const viewport of VIEWPORTS) {
    for (const route of PUBLIC_SURFACES) {
      test(`${viewport.name} ${route} has no serious WCAG findings or page overflow`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(route, { waitUntil: "domcontentloaded" });

        await expect(page.locator("main")).toHaveCount(1);
        await expectNoHorizontalOverflow(page);
        await expectNoSeriousAxeViolations(page);
      });
    }
  }

  test("home intro is labeled, skippable, and clears in-session", async ({ page }) => {
    await page.goto("/?intro=1", { waitUntil: "domcontentloaded" });
    const intro = page.getByRole("dialog", { name: "FleetVolt system startup" });
    await expect(intro).toBeVisible();
    const skip = page.getByRole("button", { name: "Skip intro" });
    await expect(skip).toHaveCSS("min-height", "44px");
    await skip.click();
    await expect(intro).toBeHidden();
  });

  test("desktop catalog navigation controls meet the 44px target contract", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS[0]);
    await page.goto("/catalog", { waitUntil: "domcontentloaded" });
    const tooSmall = await page.locator('aside[aria-label="Primary navigation"] button, aside[aria-label="Primary navigation"] a').evaluateAll(
      (controls) =>
        controls
          .map((control) => {
            const rect = control.getBoundingClientRect();
            return {
              label: control.getAttribute("aria-label") || control.textContent?.trim(),
              height: Math.round(rect.height),
            };
          })
          .filter((control) => control.height > 0 && control.height < 44),
    );
    expect(tooSmall).toEqual([]);
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} catalog filter drawer stays inside the viewport without menu scrolling`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/catalog", { waitUntil: "domcontentloaded" });

      const visibleDock = page.locator('[data-testid="catalog-filter-rail"]:visible');
      for (const group of ["type", "oem", "class", "technology"] as const) {
        await visibleDock.locator(`button[data-filter-group="${group}"]`).click();
        const drawer = page.getByTestId("catalog-filter-drawer");
        await expect(drawer).toBeVisible();

        const geometry = await drawer.evaluate((element) => ({
          top: element.getBoundingClientRect().top,
          bottom: element.getBoundingClientRect().bottom,
          viewportHeight: window.innerHeight,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        }));
        expect(geometry.top, group).toBeGreaterThanOrEqual(0);
        expect(geometry.bottom, group).toBeLessThanOrEqual(geometry.viewportHeight);
        expect(geometry.scrollHeight, group).toBeLessThanOrEqual(geometry.clientHeight);
        await expectNoHorizontalOverflow(page);
        await expectNoSeriousAxeViolations(page);

        await page.getByRole("button", { name: new RegExp(`Close ${group}`, "i") }).click();
        await expect(drawer).toBeHidden();
      }
    });
  }

  test("desktop catalog filter dock supports deliberate hover intent and Escape", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS[0]);
    await page.goto("/catalog", { waitUntil: "domcontentloaded" });
    const dock = page.locator('[data-testid="catalog-filter-rail"]:visible');
    await dock.locator('button[data-filter-group="technology"]').hover();
    await page.waitForTimeout(420);
    await expect(page.getByTestId("catalog-filter-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("catalog-filter-drawer")).toBeHidden();
  });
});

test.describe("FleetVolt protected-surface compliance", () => {
  test.skip(
    process.env.FLEETVOLT_INTERNAL_AUDIT !== "1",
    "Requires the isolated FLEETVOLT_E2E review server.",
  );

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} internal route sweep`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/api/review-session?next=/fleet", {
        waitUntil: "domcontentloaded",
      });

      for (const route of INTERNAL_SURFACES) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page.locator("main"), route).toHaveCount(1);
        await expectNoHorizontalOverflow(page);
        await expectNoSeriousAxeViolations(page);
      }
    });
  }
});
