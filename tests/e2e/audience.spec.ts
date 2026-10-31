import { test, expect, seed, fixedTime } from "./fixture";

test("simultaneous viewer milestones synchronize without adding visitors or offering points", async ({
  page,
  context,
  request,
  temple,
}) => {
  seed(temple, 40);
  await page.goto("/admin");
  const overlay = await context.newPage();
  await overlay.clock.setFixedTime(new Date(fixedTime + 6000));
  await overlay.goto("/overlay");
  await overlay.waitForFunction(() => window.__TEMPLE_STATS__?.ready);
  await expect(overlay.getByTestId("audience-value")).toContainText(/chờ|—/i);
  const count = async (id: string, n: number) =>
    request.post("/api/events", {
      data: {
        id,
        type: "audience",
        source: "mock",
        timestamp: fixedTime,
        count: n,
      },
    });
  expect((await count("one-hundred", 100)).ok()).toBe(true);
  await expect(overlay.getByTestId("audience-value")).toContainText("100");
  await expect
    .poll(() =>
      overlay.evaluate(() => window.__TEMPLE_STATS__?.peakEffects ?? 0),
    )
    .toBeGreaterThan(0);
  await expect(overlay.getByTestId("progress-value")).toHaveText("0 / 100");
  const milestonesBefore = temple.engine
    .snapshot()
    .ceremonies.filter((c) => c.action === "audience-milestone").length;
  await count("dip", 50);
  await count("return", 100);
  expect(
    temple.engine
      .snapshot()
      .ceremonies.filter((c) => c.action === "audience-milestone").length,
  ).toBe(milestonesBefore);
  await count("one-thousand", 1000);
  await expect(overlay.getByTestId("audience-value")).toContainText("1.000");
  await expect(overlay.getByTestId("audience-milestone")).toContainText(
    "1.000",
  );
  expect(temple.engine.snapshot().visitors.length).toBe(40);
  expect(temple.engine.snapshot().totals.visits).toBe(40);
  expect(temple.engine.snapshot().progress).toBe(0);
  expect(
    await overlay.evaluate(() => window.__TEMPLE_STATS__!.peakEffects),
  ).toBeLessThanOrEqual(180);
  await overlay.setViewportSize({ width: 1080, height: 1920 });
  await overlay.evaluate(() => document.fonts.ready);
  await overlay.screenshot({
    path: "docs/qa/audience-1000.png",
    animations: "disabled",
  });
  await overlay.reload();
  await overlay.waitForFunction(() => window.__TEMPLE_STATS__?.ready);
  await overlay.waitForTimeout(250);
  expect(
    await overlay.evaluate(() => window.__TEMPLE_STATS__!.peakEffects),
  ).toBe(0);
  await page
    .getByLabel("Người xem đồng thời mô phỏng", { exact: true })
    .fill("2000");
  await page
    .getByRole("button", { name: "Cập nhật người xem", exact: true })
    .click();
  await expect(overlay.getByTestId("audience-value")).toContainText("2.000");
  await page.getByRole("button", { name: "Thử chia sẻ", exact: true }).click();
  await expect(overlay.locator(".live-announcement")).toContainText(/chia sẻ/);
  const beforeReset = temple.engine.snapshot().progress;
  await request.post("/api/session/new");
  await expect(overlay.getByTestId("audience-value")).toContainText(/chờ|—/i);
  await count("fresh-100", 100);
  await expect(overlay.getByTestId("audience-milestone")).toContainText("100");
  expect(temple.engine.snapshot().progress).toBe(beforeReset);
});

test("audience count becomes unknown on disconnect and simulator stays separate from TikTok", async ({
  page,
  temple,
}) => {
  await page.goto("/admin");
  temple.engine.setConnector({
    mode: "tiktok",
    state: "connected",
    detail: "Fixture",
    attempt: 0,
  });
  temple.engine.ingest({
    id: "live-count",
    type: "audience",
    source: "tiktok",
    timestamp: fixedTime,
    count: 1000,
  });
  await expect(page.getByTestId("audience-value")).toContainText("1.000");
  await expect(
    page.getByRole("button", { name: "Cập nhật người xem", exact: true }),
  ).toBeDisabled();
  temple.engine.setConnector({
    mode: "tiktok",
    state: "disconnected",
    detail: "Fixture",
    attempt: 0,
  });
  await expect(page.getByTestId("audience-value")).toContainText(/chờ|—/i);
  expect(temple.engine.snapshot().audience.peak).toBe(1000);
});
