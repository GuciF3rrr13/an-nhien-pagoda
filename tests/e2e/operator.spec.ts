import { test, expect, seed, fixedTime } from "./fixture";

test("operator interactions synchronize game and overlay; reconnect takes a fresh snapshot", async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto("/admin");
  const overlay = await context.newPage();
  await overlay.goto("/overlay");
  await page.getByLabel("Tên khách", { exact: true }).fill("Khách kiểm thử");
  await page.getByRole("button", { name: "Lễ Phật !le", exact: true }).click();
  await expect(overlay.getByTestId("progress-value")).toHaveText("1 / 100");
  await page.getByRole("button", { name: "Gửi quà", exact: true }).click();
  await expect(overlay.getByTestId("progress-value")).toHaveText("11 / 100");
  await context.setOffline(true);
  await page.waitForTimeout(300);
  await context.setOffline(false);
  await expect(
    page.getByRole("button", { name: "Gửi quà", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Gửi quà", exact: true }).click();
  await expect(overlay.getByTestId("progress-value")).toHaveText("21 / 100");
  await overlay.reload();
  await expect(overlay.getByTestId("progress-value")).toHaveText("21 / 100");
  expect(await overlay.getByRole("button").count()).toBe(0);
});

test("prayer approval gates public text and rejected prayers remain private", async ({
  page,
  context,
}) => {
  await page.goto("/admin");
  const overlay = await context.newPage();
  await overlay.goto("/overlay");
  await page.getByLabel("Tên khách", { exact: true }).fill("Diệu An");
  await page
    .getByLabel("Lời cầu nguyện", { exact: true })
    .fill("Cầu cho gia đình luôn bình an");
  await page
    .getByRole("button", { name: "Gửi lời cầu nguyện", exact: true })
    .click();
  await expect(
    overlay.getByText("“Cầu cho gia đình luôn bình an”"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^Lời cầu nguyện/ }).click();
  await page.screenshot({
    path: "docs/qa/prayer-moderation.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(
    overlay.getByText("“Cầu cho gia đình luôn bình an”"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Phòng điều khiển", exact: true })
    .click();
  await page.getByLabel("Tên khách", { exact: true }).fill("Khách khác");
  await page
    .getByLabel("Lời cầu nguyện", { exact: true })
    .fill("Nội dung cần ẩn");
  await page
    .getByRole("button", { name: "Gửi lời cầu nguyện", exact: true })
    .click();
  await page.getByRole("button", { name: /^Lời cầu nguyện/ }).click();
  await page.getByRole("button", { name: "Ẩn", exact: true }).click();
  await expect(overlay.getByText("“Nội dung cần ẩn”")).toHaveCount(0);
});

test("editable gift mappings affect received gifts; settings and camera are durable", async ({
  page,
  request,
}) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Quà tặng", exact: true }).click();
  await page.getByRole("button", { name: "Thêm quà", exact: true }).click();
  await page.getByLabel("Tên quà 4", { exact: true }).fill("Hoa bình an");
  await page.getByLabel("Mã quà 4", { exact: true }).fill("test-flower");
  await page.locator(".mapping-row").last().getByRole("spinbutton").fill("7");
  await page.getByRole("button", { name: "Lưu quy tắc", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu");
  await page.reload();
  await page.getByRole("button", { name: "Quà tặng", exact: true }).click();
  await expect(page.getByLabel("Mã quà 4", { exact: true })).toHaveValue(
    "test-flower",
  );
  await page.screenshot({
    path: "docs/qa/gift-mappings.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Phòng điều khiển", exact: true })
    .click();
  await page.getByLabel("Chọn quà tặng").selectOption("test-flower");
  await page.getByRole("button", { name: "Gửi quà", exact: true }).click();
  await expect(page.getByTestId("progress-value")).toHaveText("7 / 100");
  await page.getByRole("button", { name: "Cận cảnh", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cận cảnh", exact: true }),
  ).toHaveClass(/selected/);
  await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
  await page
    .getByLabel("Thời gian chờ giữa hai lượt (giây)", { exact: true })
    .fill("3");
  await page.getByRole("button", { name: "Lưu cài đặt", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
  await expect(
    page.getByLabel("Thời gian chờ giữa hai lượt (giây)", { exact: true }),
  ).toHaveValue("3");
  await page.screenshot({
    path: "docs/qa/operator-settings.png",
    fullPage: true,
    animations: "disabled",
  });
  expect((await (await request.get("/api/admin")).json()).settings.camera).toBe(
    "close",
  );
});

test("simulation can start and stop; API rejects invalid and cross-origin events", async ({
  page,
  request,
  temple,
}) => {
  await page.goto("/admin");
  await page
    .getByRole("button", { name: "Chạy mô phỏng", exact: true })
    .click();
  await page.waitForFunction(
    () => window.__TEMPLE_STATS__?.visibleVisitors === 24,
  );
  await page
    .getByRole("button", { name: "Dừng mô phỏng", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Chạy mô phỏng", exact: true }),
  ).toBeVisible();
  const seq = temple.engine.snapshot().seq;
  await page.waitForTimeout(2000);
  expect(temple.engine.snapshot().seq).toBe(seq);
  expect(
    (
      await request.post("/api/events", { data: { type: "gift", count: -10 } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/events", {
        headers: { origin: "https://untrusted.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const state = await (await request.get("/api/state")).json();
  expect(state.pendingPrayers).toBeUndefined();
  expect(state.mappings).toBeUndefined();
});

test("native scene, close-up, desktop and mobile match inspected visual baselines", async ({
  page,
  temple,
}) => {
  seed(temple);
  temple.engine.ingest({
    id: "visual-gift",
    timestamp: fixedTime,
    type: "gift",
    source: "mock",
    user: { id: "seed:0", name: "Minh An" },
    giftId: "mock-lotus",
    giftName: "Hoa sen mẫu",
    count: 12,
    streakId: "visual",
    final: true,
  });
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto("/overlay?capture=1");
  await page.waitForFunction(() => window.__TEMPLE_STATS__?.ready);
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("temple-wide.png", {
    animations: "disabled",
  });
  temple.engine.updateSettings({
    ...temple.engine.snapshot().settings,
    camera: "close",
  });
  await page.waitForTimeout(100);
  await expect(page).toHaveScreenshot("temple-close.png", {
    animations: "disabled",
  });
  temple.engine.updateSettings({
    ...temple.engine.snapshot().settings,
    camera: "wide",
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/admin?capture=1");
  await page.waitForFunction(() => window.__TEMPLE_STATS__?.ready);
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("admin-desktop.png", {
    fullPage: true,
    mask: [page.locator(".preview-footer>span:last-child")],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForFunction(() => window.__TEMPLE_STATS__?.ready);
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page).toHaveScreenshot("admin-mobile.png", {
    fullPage: true,
    mask: [page.locator(".preview-footer>span:last-child")],
  });
});

test("overlay labels connecting, errors and disconnects accurately", async ({
  page,
  temple,
}) => {
  await page.goto("/overlay");
  for (const [state, label] of [
    ["connecting", "Đang kết nối"],
    ["error", "Lỗi kết nối"],
    ["disconnected", "Mất kết nối"],
    ["connected", "TikTok LIVE"],
  ] as const) {
    temple.engine.setConnector({
      mode: "tiktok",
      state,
      detail: "Fixture only; no external connection",
      attempt: 0,
    });
    await expect(page.locator(".temple-mode")).toHaveText(label);
  }
});
