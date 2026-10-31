import { test, expect, seed, fixedTime } from "./fixture";

test("TikTok instructions, gift-only flowers and session boards synchronize and reset", async ({
  page,
  context,
  request,
}) => {
  await page.goto("/admin");
  const overlay = await context.newPage();
  await overlay.goto("/overlay");
  await expect(
    overlay.getByRole("region", { name: "Bảng tri ân", exact: true }),
  ).toBeVisible();
  await expect(overlay.getByText("!le", { exact: true })).toBeVisible();
  expect(await overlay.getByRole("button").count()).toBe(0);
  const user = { id: "test-helper", name: "Minh An" };
  const send = async (id: string, text: string) =>
    (
      await request.post("/api/events", {
        data: {
          id,
          type: "comment",
          source: "mock",
          timestamp: fixedTime,
          user,
          text,
        },
      })
    ).json();
  expect((await send("flower-command", "!sen")).result).toBe("gift-required");
  await expect(overlay.getByTestId("progress-value")).toHaveText("0 / 100");
  expect((await send("bow-command", "!le")).result).toBe("bow");
  await expect(overlay.getByTestId("progress-value")).toHaveText("1 / 100");
  await expect(
    page.locator(".admin-thanks-columns").getByText("Minh An", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Tên khách", { exact: true }).fill("Ngọc Linh");
  await page.getByRole("button", { name: "Gửi quà", exact: true }).click();
  await expect(overlay.locator(".stream-thanks")).toContainText("Ngọc Linh");
  await expect(overlay.getByTestId("progress-value")).toHaveText("11 / 100");
  await overlay.reload();
  await expect(overlay.locator(".stream-thanks")).toContainText("Ngọc Linh");
  await page
    .getByRole("button", { name: "Bắt đầu phiên mới", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Xác nhận phiên mới", exact: true })
    .click();
  await expect(overlay.locator(".stream-thanks")).toContainText(
    "Chưa có lượt ghi nhận",
  );
  await expect(overlay.getByTestId("progress-value")).toHaveText("11 / 100");
  await page.goto("/game");
  await expect(
    page.getByRole("button", { name: "Lễ Phật", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Bật âm thanh", exact: true }),
  ).toBeVisible();
});

test("engagement layout fits native portrait and mobile admin", async ({
  page,
  temple,
}) => {
  seed(temple, 40);
  for (let i = 0; i < 5; i++) {
    const user = {
      id: `board:${i}`,
      name: [
        "Minh An",
        "Ngọc Linh",
        "Diệu Hương",
        "Thanh Tâm",
        "Nguyễn Thị Bình An",
      ][i],
    };
    temple.engine.ingest({
      id: `board-free:${i}`,
      timestamp: fixedTime,
      type: "comment",
      source: "mock",
      user,
      text: "!le",
    });
    temple.engine.ingest({
      id: `board-gift:${i}`,
      timestamp: fixedTime,
      type: "gift",
      source: "mock",
      user,
      giftId: "mock-lotus",
      giftName: "Hoa sen",
      count: 5 - i,
      streakId: `board:${i}`,
      final: true,
    });
  }
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto("/overlay?capture=1");
  await page.waitForFunction(() => window.__TEMPLE_STATS__?.ready);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".stream-thanks")).toContainText(
    "Nguyễn Thị Bình An",
  );
  await page.screenshot({
    path: "docs/qa/engagement-portrait.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin?capture=1");
  await page.waitForFunction(() => window.__TEMPLE_STATS__?.ready);
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/qa/engagement-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
