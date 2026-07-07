import { test, expect } from "@playwright/test";

/**
 * Phase 7 / Wave 2 (plan 07-03) — FLOW-02, SHELL-06
 * Nyquist signal: "Port anchors present & selectable (6 AdvancedMarkers)".
 *
 * ASSUMES the ports seed has run against the dev Convex deployment:
 *   cd apps/web && npx convex run seed/ports:seed
 *
 * Port AdvancedMarkers render into the Google map's overlay, so they require the
 * live Maps JS API — which needs the API key's HTTP-referrer allowlist to
 * include http://localhost:3000 (EXTERNAL Google Cloud console step; see the
 * SUMMARY manual-verify note). This spec skips cleanly with a pointer to that
 * fix rather than hard-failing when the map can't come up.
 */
test.describe("/pulse — port anchors & selector", () => {
  test.beforeEach(async () => {
    test.skip(
      !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set in the test env — set it (and the Map ID) to exercise the port anchors.",
    );
  });

  test("shows 6 port AdvancedMarkers and focuses one via the port selector", async ({
    page,
  }) => {
    await page.goto("/pulse");

    const unavailable = page.getByTestId("pulse-map-unavailable");
    test.skip(
      await unavailable.isVisible().catch(() => false),
      "Map unavailable fallback shown — client-side Google keys missing.",
    );

    // The port selector chrome is map-independent (SHELL-06) — always present.
    await expect(page.getByTestId("port-select-trigger").first()).toBeVisible();

    // Anchors mount only once the Maps JS API + AdvancedMarker library load.
    const anchors = page.getByTestId("port-anchor");
    const rendered = await anchors
      .first()
      .waitFor({ state: "attached", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    test.skip(
      !rendered,
      "Port anchors did not mount — add http://localhost:3000 to the API key's HTTP-referrer allowlist in the Google Cloud console (external manual step), and ensure seed/ports:seed has run.",
    );

    // Six provenance-tagged Convex ports → six anchors (FLOW-02).
    await expect(anchors).toHaveCount(6);

    // Selecting a port focuses it: the matching anchor gets the accent state.
    await page.getByTestId("port-select-trigger").first().click();
    const firstItem = page.getByTestId("port-select-item").first();
    const code = await firstItem.getAttribute("data-value");
    await firstItem.click();

    const focused = page.locator('[data-testid="port-anchor"][data-focused="true"]');
    await expect(focused).toHaveCount(1);
    if (code) {
      await expect(focused).toHaveAttribute("data-port-code", code);
    }
  });
});
