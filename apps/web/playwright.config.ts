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
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
