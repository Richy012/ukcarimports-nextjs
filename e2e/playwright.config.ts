import { defineConfig, devices } from "@playwright/test";

// Staging by default; point BASE_URL at production to run the same suite there.
const BASE_URL = process.env.BASE_URL || "https://staging.ukcarimports.ie";

export default defineConfig({
  testDir: "./tests",
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: "results.json" }]],
  use: {
    baseURL: BASE_URL,
    // Staging has been observed serving stale HTML after a cache purge, which
    // would silently test yesterday's build. Ask the edge not to.
    extraHTTPHeaders: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
