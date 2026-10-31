# Performance evidence

Latest engagement measurement is `benchmark.json`: production 1080×1920, 40 visitors, gift bursts every 700ms and a new audience milestone every 4.9 seconds for 60.033 seconds. The shared particle pool peaks at 180. Raw `performance.now()` intervals between Phaser updates are measured, rather than the engine-smoothed timestep.

Result: mean **61.68 FPS**, slowest complete 60-frame window **59.94 FPS**, p95 frame time **17.6ms**. Meets the 30 FPS acceptance target. Hardware: Apple M5, 10 CPU cores, 24GiB RAM, macOS arm64; headed Chromium uses ANGLE Metal on Apple M5. Final sampled game-update CPU time was about 0.1ms. This measures local rendering with audio disabled; it does not establish narration cost, OBS encoding performance or a universal hardware guarantee.

Original v1 measurement is preserved as `benchmark-release-v1.json`: 116.91 mean FPS, 70.60 minimum window FPS and 9.4ms p95 under the older gift-only scenario. The scenarios/browser timing differ; the figures are not a controlled before/after performance comparison.

Initial diagnostic `benchmark-headless-initial.json` used CPU SwiftShader, smoothed timestep data and overlapping screenshot work. It missed the target. No claim is made that software rendering meets the target. Native resolution, visitor count and pool budgets remain unchanged.

Run `npm run build` then `npm run benchmark` alone. Chromium opens with hardware acceleration; keep its window open during the measurement. `TEMPLE_BENCHMARK_HEADLESS=1 npm run benchmark` measures the distinct headless/software path. Do not run another Playwright suite concurrently. No real TikTok traffic, OBS capture or broadcasting is included.
