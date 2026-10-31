import { test, expect, fixedTime } from "./fixture";

test.use({
  launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
});

function toneWave() {
  const rate = 22050,
    samples = rate;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    wav.writeInt16LE(
      Math.round(Math.sin((i * 440 * 2 * Math.PI) / rate) * 1200),
      44 + i * 2,
    );
  return wav;
}

test("native Vietnamese narration endpoint returns playable WAV and rejects unknown text", async ({
  request,
  temple,
}) => {
  const status = await (await request.get("/api/narrator")).json();
  expect(status.voice).toBe("Linh");
  if (process.platform !== "darwin") {
    expect(status.available).toBe(false);
    return;
  }
  expect(status.available).toBe(true);
  temple.engine.ingest({
    id: "native-gift",
    type: "gift",
    source: "mock",
    timestamp: fixedTime,
    user: { id: "native", name: "Minh An" },
    giftId: "mock-lotus",
    giftName: "Hoa sen",
    count: 3,
    streakId: "native",
    final: true,
  });
  const announcement = temple.engine.snapshot().announcements.at(-1)!;
  const response = await request.get(`/api/narration/${announcement.id}.wav`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("audio/wav");
  const bytes = await response.body();
  expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
  expect(bytes.subarray(8, 12).toString()).toBe("WAVE");
  expect(bytes.length).toBeGreaterThan(22050);
  expect(
    (await request.get("/api/narration/not-an-announcement.wav")).status(),
  ).toBeGreaterThanOrEqual(400);
});

test("narrator skips bootstrap, groups streaks, serializes voice and restores music on disable", async ({
  page,
  request,
  temple,
}) => {
  const gift = (id: string, count = 1, final = true, streakId = id) => ({
    id,
    type: "gift" as const,
    source: "mock" as const,
    timestamp: fixedTime,
    user: { id: "voice", name: "Ngọc Linh" },
    giftId: "mock-lotus",
    giftName: "Hoa sen",
    count,
    streakId,
    final,
  });
  temple.engine.ingest(gift("bootstrap"));
  let fetched = 0;
  await page.route("**/api/narration/*.wav", async (route) => {
    fetched++;
    await route.fulfill({ contentType: "audio/wav", body: toneWave() });
  });
  await page.addInitScript(() => {
    const state = {
      starts: 0,
      active: 0,
      peak: 0,
      minMusic: 1,
      music: undefined as GainNode | undefined,
    };
    (window as any).voiceCheck = state;
    const media = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function (element) {
      const node = media.call(this, element),
        connect = node.connect.bind(node);
      node.connect = ((destination: AudioNode) => {
        state.music = destination as GainNode;
        return connect(destination);
      }) as typeof node.connect;
      return node;
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (
      ...args: Parameters<typeof start>
    ) {
      state.starts++;
      state.active++;
      state.peak = Math.max(state.peak, state.active);
      this.addEventListener("ended", () => state.active--, { once: true });
      return start.apply(this, args);
    };
    setInterval(() => {
      if (state.active && state.music)
        state.minMusic = Math.min(state.minMusic, state.music.gain.value);
    }, 20);
  });
  await page.goto("/game");
  await expect(page.locator(".temple-mode")).toContainText("Mô phỏng");
  await page.getByRole("button", { name: "Bật âm thanh", exact: true }).click();
  await page.waitForTimeout(350);
  expect(fetched).toBe(0);
  await request.post("/api/events", {
    data: gift("partial", 3, false, "group"),
  });
  await page.waitForTimeout(100);
  expect(fetched).toBe(0);
  await request.post("/api/events", { data: gift("final", 3, true, "group") });
  await request.post("/api/events", {
    data: gift("final-again", 3, true, "group"),
  });
  await request.post("/api/events", { data: gift("next") });
  await expect
    .poll(() => page.evaluate(() => (window as any).voiceCheck.starts))
    .toBe(2);
  await expect
    .poll(() => page.evaluate(() => (window as any).voiceCheck.active))
    .toBe(0);
  expect(fetched).toBe(2);
  const stats = await page.evaluate(() => ({
    peak: (window as any).voiceCheck.peak,
    min: (window as any).voiceCheck.minMusic,
  }));
  expect(stats.peak).toBe(1);
  expect(stats.min).toBeLessThan(0.15);
  await request.post("/api/events", { data: gift("disable-during-voice") });
  await expect
    .poll(() => page.evaluate(() => (window as any).voiceCheck.active))
    .toBe(1);
  await request.put("/api/settings", {
    data: { ...temple.engine.snapshot().settings, narratorEnabled: false },
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).voiceCheck.active))
    .toBe(0);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).voiceCheck.music?.gain.value ?? 0),
    )
    .toBeGreaterThan(0.18);
  await request.post("/api/events", { data: gift("disabled") });
  await page.waitForTimeout(150);
  expect(fetched).toBe(3);
});

test("OBS auto audio handles its first snapshot and the first gift after a session reset", async ({
  page,
  request,
}) => {
  let fetched = 0;
  await page.route("**/api/narration/*.wav", async (route) => {
    fetched++;
    await route.fulfill({ contentType: "audio/wav", body: toneWave() });
  });
  await page.goto("/overlay?audio=1");
  await expect(page.locator(".temple-mode")).toContainText("Mô phỏng");
  await page.waitForTimeout(300);
  const gift = (id: string) => ({
    id,
    type: "gift",
    source: "mock",
    timestamp: fixedTime,
    user: { id: "obs", name: "Diệu Hương" },
    giftId: "mock-lotus",
    giftName: "Hoa sen",
    count: 1,
    streakId: id,
    final: true,
  });
  await request.post("/api/events", { data: gift("obs-first") });
  await expect.poll(() => fetched).toBe(1);
  await request.post("/api/session/new");
  await page.waitForTimeout(100);
  await request.post("/api/events", { data: gift("obs-new-session") });
  await expect.poll(() => fetched).toBe(2);
  await page.reload();
  await page.waitForTimeout(350);
  expect(fetched).toBe(2);
});
