import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../apps/server/src/engine.ts";
import { Store } from "../apps/server/src/store.ts";
import { normalizeTikTok } from "../apps/server/src/connectors.ts";
import type { LiveEvent } from "../packages/shared/src/index.ts";
const audience = (
  id: string,
  count: number,
  source: LiveEvent["source"] = "mock",
): LiveEvent => ({ id, type: "audience", count, timestamp: 1, source });
const share = (
  id: string,
  source: LiveEvent["source"] = "mock",
): LiveEvent => ({
  id,
  type: "share",
  source,
  timestamp: 1,
  user: { id: "u", name: "An 💖" },
});
test("audience crossing and dips are once per session, bounded and independent from gameplay", () => {
  const store = new Store(":memory:");
  let now = 1000;
  try {
    let engine = new Engine(store, () => now);
    engine.ingest(audience("a", 100));
    engine.ingest(audience("b", 50));
    engine.ingest(audience("c", 500));
    assert.deepEqual(engine.snapshot().audience.milestones, [100, 250, 500]);
    assert.equal(engine.snapshot().ceremonies.at(-1)?.count, 500);
    assert.equal(engine.snapshot().ceremonies.at(-1)?.intensity, 2);
    assert.equal(engine.ingest(audience("c", 500)).result, "duplicate");
    engine.ingest(audience("d", 10000000));
    assert.equal(engine.snapshot().audience.milestones.length, 64);
    assert.equal(engine.snapshot().audience.milestones.at(-1), 10000000);
    assert.equal(engine.snapshot().ceremonies.at(-1)?.count, 10000000);
    assert.equal(engine.snapshot().progress, 0);
    assert.equal(engine.snapshot().totals.visits, 0);
    assert.deepEqual(engine.snapshot().visitors, []);
    engine = new Engine(store, () => now);
    assert.equal(engine.snapshot().audience.current, null);
    assert.equal(engine.snapshot().audience.peak, 10000000);
    engine.ingest(audience("e", 1000));
    assert.equal(engine.snapshot().audience.milestones.at(-1), 10000000);
    engine.setConnector({
      mode: "mock",
      state: "disconnected",
      detail: "",
      attempt: 0,
    });
    assert.equal(engine.snapshot().audience.current, null);
    engine.setConnector({
      mode: "mock",
      state: "connected",
      detail: "",
      attempt: 0,
    });
    engine.ingest(audience("f", 10));
    now += 30000;
    assert.equal(engine.snapshot().audience.current, null);
    engine.newSession();
    assert.deepEqual(engine.snapshot().audience, {
      current: null,
      peak: 0,
      milestones: [],
      updatedAt: null,
    });
  } finally {
    store.close();
  }
});
test("share and prompt obey source, freshness, throttle, and celebration spacing", () => {
  const store = new Store(":memory:");
  let now = 0;
  try {
    const engine = new Engine(store, () => now);
    engine.ingest(share("s1"));
    engine.ingest(share("s2"));
    engine.ingest(share("s3", "replay"));
    assert.equal(
      engine.snapshot().announcements.filter((a) => a.kind === "share").length,
      1,
    );
    assert.equal(engine.snapshot().progress, 0);
    assert.equal(engine.snapshot().totals.visits, 0);
    now = 60000;
    engine.ingest(share("s4"));
    assert.equal(
      engine.snapshot().announcements.filter((a) => a.kind === "share").length,
      1,
    );
    now = 300000;
    engine.ingest(audience("a", 100));
    engine.tick();
    assert.equal(
      engine.snapshot().announcements.filter((a) => a.kind === "share-prompt")
        .length,
      0,
    );
    now += 20000;
    engine.tick();
    assert.equal(
      engine.snapshot().announcements.filter((a) => a.kind === "share-prompt")
        .length,
      1,
    );
    now += 300000;
    engine.tick();
    assert.equal(engine.snapshot().announcements.length, 0);
    engine.ingest(audience("x", 100, "tiktok"));
    engine.tick();
    assert.equal(engine.snapshot().audience.current, null);
    engine.ingest(audience("y", 99));
    engine.setConnector({
      mode: "mock",
      state: "disconnected",
      detail: "",
      attempt: 0,
    });
    engine.tick();
    assert.equal(engine.snapshot().announcements.length, 0);
  } finally {
    store.close();
  }
});
test("TikTok roomUser uses total or legacy viewerCount and does not confuse cumulative viewers", () => {
  assert.deepEqual(
    normalizeTikTok(
      "roomUser",
      { total: "120", totalUser: "9000", common: { msgId: "7" } },
      1,
    ),
    {
      type: "audience",
      id: "tt:roomUser:7",
      timestamp: 1,
      source: "tiktok",
      count: 120,
    },
  );
  assert.equal(normalizeTikTok("roomUser", { totalUser: "123" }, 1), undefined);
  assert.equal(
    normalizeTikTok("roomUser", { viewerCount: 0 }, 1)?.type,
    "audience",
  );
  for (const value of ["", "-1", "1.5", -1, 1.5, 10000001])
    assert.equal(normalizeTikTok("roomUser", { total: value }, 1), undefined);
  assert.equal(
    normalizeTikTok(
      "share",
      { user: { id: "u", nickname: "An" }, common: { msgId: "9" } },
      1,
    )?.type,
    "share",
  );
});

test("saved TikTok session survives reconnect, switches only on actual source change, and ignores inherited command names", () => {
  const store = new Store(":memory:");
  try {
    let engine = new Engine(store, () => 1000);
    engine.setConnector({
      mode: "tiktok",
      state: "connected",
      detail: "",
      attempt: 0,
    });
    engine.ingest(audience("tt", 250, "tiktok"));
    const sessionId = engine.snapshot().session.id;
    engine = new Engine(store, () => 1100);
    engine.setConnector({
      mode: "tiktok",
      state: "connecting",
      detail: "",
      attempt: 1,
    });
    assert.equal(engine.snapshot().session.id, sessionId);
    assert.equal(engine.snapshot().audience.peak, 250);
    engine.setConnector({
      mode: "mock",
      state: "connected",
      detail: "",
      attempt: 0,
    });
    assert.notEqual(engine.snapshot().session.id, sessionId);
    for (const text of ["constructor", "toString", "__proto__"]) {
      assert.equal(
        engine.ingest({
          type: "comment",
          id: text,
          timestamp: 1,
          source: "mock",
          user: { id: "u", name: "An" },
          text,
        }).result,
        "ignored",
      );
    }
    assert.equal(engine.snapshot().progress, 0);
  } finally {
    store.close();
  }
});
