import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../apps/server/src/engine.ts";
import { Store } from "../apps/server/src/store.ts";
import type { LiveEvent } from "../packages/shared/src/index.ts";

const event = (
  id: string,
  userId: string,
  text: string,
  source: LiveEvent["source"] = "mock",
): LiveEvent => ({
  id,
  type: "comment",
  source,
  timestamp: 1,
  user: { id: userId, name: userId },
  text,
});
const gift = (
  id: string,
  count: number,
  source: LiveEvent["source"] = "mock",
): LiveEvent => ({
  id,
  type: "gift",
  source,
  timestamp: 1,
  user: { id: "giver", name: "Giver" },
  giftId: "mock-lotus",
  giftName: "Lotus",
  count,
  streakId: "streak",
  final: false,
});

test("session boards count accepted actions and exact gift deltas; moderation and reset are durable", () => {
  const store = new Store(":memory:");
  let now = 1000;
  try {
    let engine = new Engine(store, () => now);
    assert.equal(
      engine.ingest(event("sen", "a", "!sen")).result,
      "gift-required",
    );
    assert.equal(engine.ingest(event("bow", "a", "!le")).result, "bow");
    assert.equal(
      engine.ingest(event("cool", "a", "!nhang")).result,
      "cooldown",
    );
    engine.ingest(event("prayer", "b", "!cau Bình an"));
    engine.ingest(event("reject", "c", "!cau Bình an"));
    assert.deepEqual(
      engine.snapshot().session.participation.map((e) => e.userId),
      ["a"],
    );
    engine.moderate(1, "approved");
    engine.moderate(2, "rejected");
    assert.deepEqual(
      engine.snapshot().session.participation.map((e) => e.userId),
      ["a", "b"],
    );
    engine.ingest(gift("g1", 1));
    engine.ingest(gift("g2", 3));
    engine.ingest(gift("g3", 2));
    engine.ingest(gift("g2", 3));
    assert.equal(engine.snapshot().session.gifts[0].score, 30);
    const before = engine.snapshot();
    engine = new Engine(store, () => now);
    assert.deepEqual(engine.snapshot().session, before.session);
    engine.ingest(event("replay", "d", "!le", "replay"));
    engine.ingest(event("foreign", "e", "!le", "tiktok"));
    assert.deepEqual(
      engine.snapshot().session.participation,
      before.session.participation,
    );
    now++;
    const lifetime = engine.snapshot().progress;
    engine.newSession();
    assert.notEqual(engine.snapshot().session.id, before.session.id);
    assert.equal(engine.snapshot().progress, lifetime);
    assert.deepEqual(engine.snapshot().session.gifts, []);
    assert.equal(engine.snapshot().prayers.length, 1);
  } finally {
    store.close();
  }
});

test("all scores survive the top five and mode changes reset only once", () => {
  const store = new Store(":memory:");
  try {
    const engine = new Engine(store, () => 1000);
    for (const name of ["f", "e", "d", "c", "b", "a"])
      engine.ingest(event(name, name, "!le"));
    assert.deepEqual(
      engine.snapshot().session.participation.map((e) => e.userId),
      ["a", "b", "c", "d", "e"],
    );
    engine.updateSettings({
      ...engine.snapshot().settings,
      cooldownSeconds: 0,
    });
    engine.ingest(event("f2", "f", "!le"));
    assert.deepEqual(engine.snapshot().session.participation[0], {
      userId: "f",
      userName: "f",
      score: 2,
    });
    engine.setConnector({
      mode: "tiktok",
      state: "connecting",
      detail: "",
      attempt: 0,
    });
    const id = engine.snapshot().session.id;
    engine.ingest(event("mock", "z", "!le"));
    assert.deepEqual(engine.snapshot().session.participation, []);
    engine.setConnector({
      mode: "tiktok",
      state: "connected",
      detail: "",
      attempt: 0,
    });
    assert.equal(engine.snapshot().session.id, id);
  } finally {
    store.close();
  }
});
