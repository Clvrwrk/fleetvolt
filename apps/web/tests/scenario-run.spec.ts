import { test, expect } from "@playwright/test";

/** Default demo scenario — matches services/api/src/simulations.test.ts CORRIDOR_BODY */
export const CORRIDOR_BODY = {
  route: { corridor_key: "polb_cajon_pass" },
  truck: { slug: "ecascadia_438" },
  conditions: {
    weather_preset: "ideal",
    payload_lbs: 34000,
    port_drayage_enabled: false,
  },
  overrides: {},
  options: { include_charging: true },
} as const;

test.describe("@smoke analyst scenario run", () => {
  test.beforeEach(async ({ request, baseURL }) => {
    try {
      const res = await request.get(`${baseURL}/api/v1/meta/stack`);
      if (!res.ok()) {
        test.skip(true, "API stack unreachable — start docker compose");
      }
    } catch {
      test.skip(true, "API stack unreachable — start docker compose");
    }
  });

  test("test_analyst_runs_polb_scenario", async ({ page }) => {
    await page.goto("/planner");

    const form = page.getByTestId("scenario-form");
    await expect(form).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("run-button").click();

    const jobStatus = page.getByTestId("job-status");
    await expect(jobStatus).toBeVisible({ timeout: 5_000 });

    const results = page.getByTestId("results-canvas");
    await expect(results).toBeVisible({ timeout: 120_000 });

    await expect(
      results.getByText(/kWh|feasible|infeasible|marginal|requires/i),
    ).toBeVisible({ timeout: 120_000 });
  });
});
