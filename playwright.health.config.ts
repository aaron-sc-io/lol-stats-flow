import { defineConfig, devices } from "@playwright/test"

/** Weekly smoke test against the *deployed* GitHub Pages site (plan
 * §3.3.7, §7 Phase 6 AC) — no local `webServer`, no build step. Override
 * `HEALTH_BASE_URL` for manual runs against a different deployment. */
const BASE_URL = process.env.HEALTH_BASE_URL ?? "https://aaron-sc-io.github.io/lol-stats-flow/"

export default defineConfig({
  testDir: "./tests/health",
  fullyParallel: true,
  retries: 1,
  reporter: [["html", { outputFolder: "playwright-report-health" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 1000 } },
    },
  ],
})
