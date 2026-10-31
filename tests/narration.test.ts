import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../apps/server/src/engine.ts";
import { Store } from "../apps/server/src/store.ts";
import { Narrator } from "../apps/server/src/narrator.ts";
import type { Announcement, LiveEvent } from "../packages/shared/src/index.ts";

const gift = (
  id: string,
  count: number,
  final: boolean,
  source: LiveEvent["source"] = "mock",
): LiveEvent => ({
  id,
  type: "gift",
  source,
  timestamp: 1,
  user: { id: "u", name: "💥 <Lan>!" },
  giftId: "mock-lotus",
  giftName: "Hoa",
  count,
  streakId: "s",
  final,
});
test("gift final thanks once with maximum observed count, sanitized name and session expiration", () => {
  const store = new Store(":memory:");
  let now = 1000;
  try {
    const engine = new Engine(store, () => now);
    engine.ingest(gift("g1", 3, false));
    engine.ingest(gift("g2", 2, true));
    engine.ingest(gift("g3", 3, true));
    assert.equal(engine.snapshot().progress, 30);
    const announcements = engine.snapshot().announcements;
    assert.equal(announcements.length, 1);
    assert.equal(
      announcements[0].text,
      "Chùa An Nhiên xin cảm ơn Lan đã gửi 3 phần quà.",
    );
    assert.ok(engine.announcement(announcements[0].id));
    engine.ingest(gift("replay", 10, true, "replay"));
    engine.ingest(gift("foreign", 10, true, "tiktok"));
    assert.equal(engine.snapshot().announcements.length, 1);
    now += 30000;
    assert.equal(engine.announcement(announcements[0].id), undefined);
    engine.newSession();
    assert.deepEqual(engine.snapshot().announcements, []);
  } finally {
    store.close();
  }
});
test("follow throttling, fallback name and legacy settings hydration survive restart", () => {
  const store = new Store(":memory:");
  let now = 1000;
  try {
    let engine = new Engine(store, () => now);
    const follow = (id: string): LiveEvent => ({
      id,
      type: "follow",
      source: "mock",
      timestamp: 1,
      user: { id: "x", name: "💥" },
    });
    engine.ingest(follow("f1"));
    engine.ingest(follow("f2"));
    assert.equal(engine.snapshot().announcements.length, 1);
    assert.match(engine.snapshot().announcements[0].text, /cảm ơn bạn/);
    const state = store.load<any>();
    delete state.settings.narratorEnabled;
    delete state.settings.narratorVolume;
    store.save(state);
    engine = new Engine(store, () => now);
    assert.equal(engine.snapshot().settings.narratorEnabled, true);
    assert.equal(engine.snapshot().settings.narratorVolume, 0.85);
    now += 30000;
    engine.ingest(follow("f3"));
    assert.equal(engine.snapshot().announcements.length, 1);
  } finally {
    store.close();
  }
});
test("narrator serializes, deduplicates, bounds queue, caches and recovers from failures", async () => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const narrator = new Narrator(
    async (text) => {
      calls++;
      if (text === "hold") await gate;
      if (text === "fail") throw new Error("failure");
      return Buffer.from(text);
    },
    async () => true,
  );
  const a = (id: string, text = id): Announcement => ({
    id,
    text,
    at: 1,
    sessionId: "s",
    kind: "gift",
  });
  assert.equal((await narrator.status()).available, true);
  const first = narrator.audio(a("0", "hold"));
  const duplicate = narrator.audio(a("0", "hold"));
  const rest = Array.from({ length: 11 }, (_, i) =>
    narrator.audio(a(String(i + 1))),
  );
  await assert.rejects(narrator.audio(a("overflow")), /queue-full/);
  release();
  await Promise.all([first, duplicate, ...rest]);
  assert.equal(calls, 12);
  await narrator.audio(a("0", "hold"));
  assert.equal(calls, 12);
  await assert.rejects(narrator.audio(a("failure", "fail")), /failure/);
  assert.equal((await narrator.audio(a("later"))).toString(), "later");
  await narrator.close();
  await assert.rejects(narrator.audio(a("closed")), /unavailable/);
});
