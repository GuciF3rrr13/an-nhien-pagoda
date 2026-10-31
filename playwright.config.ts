import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  outputDir:
    process.env.TEMPLE_BENCHMARK === "1"
      ? "test-results-benchmark"
      : "test-results",
  expect: { timeout: 10000, toHaveScreenshot: { maxDiffPixelRatio: 0.005 } },
  use: {
    browserName: "chromium",
    headless:
      process.env.TEMPLE_BENCHMARK !== "1" ||
      process.env.TEMPLE_BENCHMARK_HEADLESS === "1",
    viewport: { width: 1440, height: 1100 },
    timezoneId: "Asia/Ho_Chi_Minh",
    locale: "vi-VN",
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder:
          process.env.TEMPLE_BENCHMARK === "1"
            ? "playwright-report-benchmark"
            : "playwright-report",
      },
    ],
  ],
});
