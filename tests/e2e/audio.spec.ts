import { test, expect } from "./fixture";
test("audio activation is explicit in the game and absent from the admin preview", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("button", { name: "Bật âm thanh", exact: true }),
  ).toHaveCount(0);
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function (element) {
      (window as Window & { testMusic?: HTMLMediaElement }).testMusic = element;
      return original.call(this, element);
    };
  });
  await page.goto("/game");
  const musicResponse = page.waitForResponse((response) =>
    response.url().includes("/assets/music.mp3"),
  );
  await page.getByRole("button", { name: "Bật âm thanh", exact: true }).click();
  expect((await musicResponse).ok()).toBeTruthy();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { testMusic?: HTMLMediaElement }).testMusic?.currentTime ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => (window as Window & { testMusic?: HTMLMediaElement }).testMusic?.loop,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Tắt âm thanh", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tắt âm thanh", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Bật âm thanh", exact: true }),
  ).toBeVisible();
});
