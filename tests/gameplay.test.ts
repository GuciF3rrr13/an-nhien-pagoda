import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../apps/server/src/engine.ts";
import { Store } from "../apps/server/src/store.ts";
import { normalizeTikTok } from "../apps/server/src/connectors.ts";
import {
  defaultSettings,
  liveEventSchema,
  type LiveEvent,
  type AdminSnapshot,
} from "../packages/shared/src/index.ts";

function fixture() {
  let now = 100000;
  const store = new Store(":memory:"),
    engine = new Engine(store, () => now);
  return {
    store,
    engine,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
function comment(id: string, text: string, user = "viewer"): LiveEvent {
  return {
    id,
    type: "comment",
    source: "mock",
    timestamp: 100000,
    user: { id: user, name: "Khách" },
    text,
  };
}
function gift(
  id: string,
  count: number,
  final = false,
  streakId = "streak",
): LiveEvent {
  return {
    id,
    type: "gift",
    source: "mock",
    timestamp: 100000,
    user: { id: "giver", name: "Khách" },
    giftId: "mock-lotus",
    giftName: "Hoa sen",
    count,
    streakId,
    final,
  };
}
test("free commands, malformed prayers and per-viewer cooldown boundaries", () => {
  const { store, engine, advance } = fixture();
  try {
    assert.equal(engine.ingest(comment("0", "!cau")).result, "empty-prayer");
    assert.equal(engine.ingest(comment("1", "!LE")).result, "bow");
    assert.equal(engine.ingest(comment("2", "!nhang")).result, "cooldown");
    assert.equal(
      engine.ingest(comment("3", "!nhang", "other")).result,
      "incense",
    );
    advance(9999);
    assert.equal(engine.ingest(comment("4", "!sen")).result, "gift-required");
    advance(1);
    assert.equal(engine.ingest(comment("5", "!nhang")).result, "incense");
    assert.equal(engine.snapshot().progress, 3);
  } finally {
    store.close();
  }
});
test("pending prayers are private and only approved text becomes public", () => {
  const { store, engine } = fixture();
  try {
    engine.ingest(comment("p", "!cau Cầu cho gia đình bình an"));
    assert.equal(engine.snapshot().prayers.length, 0);
    const admin = engine.snapshot(true) as AdminSnapshot;
    assert.equal(admin.pendingPrayers.length, 1);
    assert.equal(engine.moderate(admin.pendingPrayers[0].id, "approved"), true);
    assert.equal(engine.snapshot().prayers[0].text, "Cầu cho gia đình bình an");
    assert.equal(
      engine.moderate(admin.pendingPrayers[0].id, "approved"),
      false,
    );
    engine.ingest(comment("p2", "!cau Nội dung từ chối", "other"));
    engine.moderate(2, "rejected");
    assert.equal(engine.snapshot().prayers.length, 1);
  } finally {
    store.close();
  }
});
test("gift streak count increases once, including final and out-of-order packets", () => {
  const { store, engine } = fixture();
  try {
    engine.ingest(gift("g1", 1));
    engine.ingest(gift("g2", 3));
    engine.ingest(gift("g3", 2));
    engine.ingest(gift("g4", 3, true));
    engine.ingest(gift("g4", 3, true));
    assert.equal(engine.snapshot().progress, 30);
    assert.equal(engine.snapshot().totals.lotus, 3);
    engine.ingest(gift("g5", 1, true, "new-streak"));
    assert.equal(engine.snapshot().progress, 40);
  } finally {
    store.close();
  }
});
test("milestones coalesce bursts and never repeat already reached progress", () => {
  const { store, engine } = fixture();
  try {
    engine.ingest(gift("m1", 10, true));
    assert.deepEqual(engine.snapshot().milestones, [100]);
    engine.ingest(gift("m2", 25, true));
    assert.deepEqual(engine.snapshot().milestones, [100, 250]);
    engine.ingest(gift("m3", 50, true));
    engine.ingest(gift("m4", 100, true));
    assert.deepEqual(engine.snapshot().milestones, [100, 250, 500, 1000]);
    const seq = engine.snapshot().seq;
    engine.ingest(gift("m4", 100, true));
    assert.equal(engine.snapshot().seq, seq);
  } finally {
    store.close();
  }
});
test("40-visitor and ceremony bounds hold under bursts; expired guests leave", () => {
  const { store, engine, advance } = fixture();
  try {
    for (let n = 0; n < 100; n++)
      engine.ingest(comment(`b${n}`, "!nhang", `v${n}`));
    const state = engine.snapshot();
    assert.equal(state.visitors.length, 40);
    assert.equal(new Set(state.visitors.map((v) => v.slot)).size, 40);
    assert.ok(state.ceremonies.length <= 16);
    advance(120001);
    assert.equal(engine.snapshot().visitors.length, 0);
    assert.equal(engine.snapshot().ceremonies.length, 0);
  } finally {
    store.close();
  }
});
test("unmapped gifts have a modest fallback; configured mappings persist", () => {
  const { store, engine } = fixture();
  try {
    const e = gift("u", 2, true);
    if (e.type !== "gift") throw new Error();
    e.giftId = "unknown";
    engine.ingest(e);
    assert.equal(engine.snapshot().progress, 2);
    engine.updateMappings([
      {
        giftId: "unknown",
        name: "Tùy chỉnh",
        action: "incense",
        intensity: 3,
        points: 5,
      },
    ]);
    engine.ingest({ ...e, id: "u2", streakId: "other" });
    assert.equal(engine.snapshot().progress, 12);
    const reloaded = new Engine(store, () => 100000);
    assert.equal(
      (reloaded.snapshot(true) as AdminSnapshot).mappings[0].points,
      5,
    );
    engine.updateSettings({ ...defaultSettings, camera: "close" });
    assert.equal(new Engine(store).snapshot().settings.camera, "close");
  } finally {
    store.close();
  }
});
test("replay creates new IDs and keeps prayers pending", () => {
  const { store, engine } = fixture();
  try {
    engine.ingest(gift("r1", 2, true));
    assert.equal(engine.replay(1), 1);
    assert.equal(engine.snapshot().progress, 40);
    assert.equal(engine.snapshot(true).recent[0].source, "replay");
  } finally {
    store.close();
  }
});
test("TikTok boundary normalizes supported payloads and stable streak groups", () => {
  const user = { userId: "123", nickname: "An" };
  const first = normalizeTikTok("gift", {
    user,
    msgId: "1",
    giftId: 5655,
    giftType: 1,
    groupId: "group",
    repeatCount: 1,
    repeatEnd: false,
  });
  const final = normalizeTikTok("gift", {
    user,
    msgId: "2",
    giftId: 5655,
    giftType: 1,
    groupId: "group",
    repeatCount: 3,
    repeatEnd: true,
  });
  assert.ok(first && final && first.type === "gift" && final.type === "gift");
  assert.equal(first.streakId, final.streakId);
  assert.equal(final.final, true);
  for (const [type, payload] of Object.entries({
    chat: { comment: "!le" },
    member: {},
    like: { likeCount: 10 },
    follow: {},
  }))
    assert.equal(
      liveEventSchema.safeParse(
        normalizeTikTok(type, { user, msgId: type, ...payload }),
      ).success,
      true,
    );
  assert.equal(normalizeTikTok("chat", {}), undefined);
  assert.equal(normalizeTikTok("unknown", { user }), undefined);
});
test("installed v2.5 SDK protobuf shapes use user.id, common.msgId and gift.type", () => {
  const user = { id: "731", nickname: "Khách thật" },
    common = { msgId: "200" };
  const chat = normalizeTikTok("chat", { user, common, comment: "!le" });
  assert.ok(chat && chat.type === "comment");
  assert.equal(chat.user.id, "731");
  assert.equal(chat.id, "tt:chat:200");
  assert.ok(liveEventSchema.safeParse(chat).success);
  const gift = normalizeTikTok("gift", {
    user,
    common,
    giftId: "5655",
    gift: { id: "5655", name: "Rose", type: 1 },
    groupId: "g",
    repeatCount: 2,
    repeatEnd: 0,
  });
  assert.ok(gift && gift.type === "gift");
  assert.equal(gift.final, false);
  assert.equal(gift.giftName, "Rose");
  assert.equal(gift.count, 2);
  assert.equal(
    normalizeTikTok("gift", {
      user,
      common,
      giftId: "5655",
      gift: { type: 1 },
      groupId: "0",
      repeatCount: 2,
      repeatEnd: 0,
    }),
    undefined,
  );
  const final = normalizeTikTok("gift", {
    user,
    common,
    giftId: "5655",
    gift: { type: 1 },
    groupId: "0",
    repeatCount: 3,
    repeatEnd: 1,
  });
  assert.ok(final && final.type === "gift");
  assert.equal(final.count, 3);
  assert.equal(final.final, true);
});
