import { test, expect, seed } from "./fixture";
import { cpus, totalmem, platform, release, arch } from "node:os";
import { mkdirSync, writeFileSync } from "node:fs";
test("60 seconds with 40 visitors and repeated gift bursts", async ({
  page,
  temple,
}) => {
  test.skip(
    process.env.TEMPLE_BENCHMARK !== "1",
    "Run npm run benchmark explicitly.",
  );
  test.setTimeout(100000);
  seed(temple, 40);
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto("/overlay");
  await page.waitForFunction(() => window.__TEMPLE_STATS__?.ready);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    window.__TEMPLE_STATS__!.frameTimes = [];
  });
  const started = Date.now();
  let i = 0;
  const burst = setInterval(() => {
    if (i % 7 === 0)
      temple.engine.ingest({
        id: `bench-audience:${i}`,
        type: "audience",
        source: "mock",
        timestamp: Date.now(),
        count: 1000 + Math.floor(i / 7) * 1000,
      });
    temple.engine.ingest({
      id: `bench:${i}`,
      type: "gift",
      source: "mock",
      timestamp: Date.now(),
      user: { id: `seed:${i % 40}`, name: "Khách hiệu năng" },
      giftId: "mock-lotus",
      giftName: "Hoa sen mẫu",
      count: 3,
      streakId: `bench:${i++}`,
      final: true,
    });
  }, 700);
  try {
    await page.waitForTimeout(60000);
    const stats = await page.evaluate(() => window.__TEMPLE_STATS__!);
    const samples = stats.frameTimes.slice(5);
    const sorted = [...samples].sort((a, b) => a - b);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const windows = [];
    for (let n = 0; n < samples.length; n += 60) {
      const group = samples.slice(n, n + 60);
      if (group.length === 60)
        windows.push(1000 / (group.reduce((a, b) => a + b, 0) / group.length));
    }
    const report = {
      durationMs: Date.now() - started,
      visitors: stats.visibleVisitors,
      effectLimit: 180,
      maxActiveEffects: stats.peakEffects,
      frames: samples.length,
      meanFps: 1000 / mean,
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
      minimum60FrameWindowFps: Math.min(...windows),
      renderer: stats.renderer,
      gpu: stats.gpu,
      timing: "Raw performance.now intervals between rendered game updates",
      lastUpdateCpuMs: stats.updateMs,
      hardware: {
        cpu: cpus()[0].model,
        cores: cpus().length,
        memoryGiB: Math.round(totalmem() / 1024 ** 3),
        platform: platform(),
        release: release(),
        arch: arch(),
      },
      browser:
        process.env.TEMPLE_BENCHMARK_HEADLESS === "1"
          ? "Playwright Chromium headless (may use software GPU)"
          : "Playwright Chromium headed (hardware GPU)",
      resolution: [1080, 1920],
      build: "production",
      scenario:
        "40 visitors, gifts every 700ms, increasing audience milestones every 4.9s; audio disabled",
    };
    mkdirSync("docs/qa", { recursive: true });
    writeFileSync(
      "docs/qa/benchmark.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(report);
    expect(report.visitors).toBe(40);
    expect(stats.effects).toBeLessThanOrEqual(180);
    expect(report.meanFps).toBeGreaterThanOrEqual(30);
    expect(report.minimum60FrameWindowFps).toBeGreaterThanOrEqual(30);
  } finally {
    clearInterval(burst);
  }
});
