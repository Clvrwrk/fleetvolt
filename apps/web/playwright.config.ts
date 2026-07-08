import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests target the Next.js dev server at :3000 with API rewrites to Fastify.
 * Start the full stack before running: `docker compose up` (web, api, simulator, postgres, redis, worker).
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3017",
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "pnpm exec next dev --hostname 127.0.0.1 --port 3017",
        url: "http://127.0.0.1:3017",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          FLEETVOLT_E2E: "1",
          PORT: "3017",
        },
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
