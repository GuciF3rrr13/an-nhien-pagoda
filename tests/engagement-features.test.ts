import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../apps/server/src/engine.ts";
import { Store } from "../apps/server/src/store.ts";
import {
  defaultSettings,
  getScenePeriod,
  getLunarDay,
  getStreakTitle,
  type AdminSnapshot,
  type LiveEvent,
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
    setTime: (t: number) => {
      now = t;
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
  final = true,
  streakId = "streak",
  points = 10,
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

test("!que command draws fortune with per-user cooldown", () => {
  const { store, engine, advance } = fixture();
  try {
    const result1 = engine.ingest(comment("q1", "!que", "user1"));
    assert.equal(result1.result, "fortune");
    const snapshot1 = engine.snapshot();
    assert.equal(snapshot1.fortunes.length, 1);
    assert.equal(snapshot1.fortunes[0].userName, "Khách");

    // Same user cannot draw again within cooldown
    advance(1000);
    const result2 = engine.ingest(comment("q2", "!que", "user1"));
    assert.equal(result2.result, "fortune-cooldown");

    // Different user can draw
    const result3 = engine.ingest(comment("q3", "!que", "user2"));
    assert.equal(result3.result, "fortune");
    assert.equal(engine.snapshot().fortunes.length, 2);
  } finally {
    store.close();
  }
});

test("shoutouts appear for valid actions", () => {
  const { store, engine } = fixture();
  try {
    engine.ingest(comment("s1", "!le", "user1"));
    const snapshot = engine.snapshot();
    assert.equal(snapshot.shoutouts.length, 1);
    assert.equal(snapshot.shoutouts[0].action, "bow");
    assert.ok(snapshot.shoutouts[0].blessing.length > 0);
  } finally {
    store.close();
  }
});

test("shoutouts are disabled when allEffectsEnabled is false", () => {
  const { store, engine } = fixture();
  try {
    engine.updateSettings({
      ...defaultSettings,
      allEffectsEnabled: false,
    });
    engine.ingest(comment("s1", "!le", "user1"));
    const snapshot = engine.snapshot();
    assert.equal(snapshot.shoutouts.length, 0);
  } finally {
    store.close();
  }
});

test("community goal starts, advances, and completes", () => {
  const { store, engine, advance } = fixture();
  try {
    engine.updateSettings({
      ...defaultSettings,
      communityGoalEnabled: true,
      communityGoalTarget: 30,
      communityGoalMinutes: 5,
    });
    
    assert.equal(engine.startCommunityGoal(), true);
    let snapshot = engine.snapshot();
    assert.ok(snapshot.communityGoal);
    assert.equal(snapshot.communityGoal.target, 30);
    assert.equal(snapshot.communityGoal.progress, 0);
    assert.equal(snapshot.communityGoal.completed, false);

    // Contribute to goal
    engine.ingest(gift("g1", 2, true, "s1"));
    snapshot = engine.snapshot();
    assert.equal(snapshot.communityGoal!.progress, 20);

    // Complete goal
    engine.ingest(gift("g2", 1, true, "s2"));
    snapshot = engine.snapshot();
    assert.equal(snapshot.communityGoal!.completed, true);

    // Can't start new goal while one is active (even if completed)
    // First stop it
    engine.stopCommunityGoal();
    assert.equal(engine.snapshot().communityGoal, null);
    
    // Now can start new one
    assert.equal(engine.startCommunityGoal(), true);
  } finally {
    store.close();
  }
});

test("big gift effect triggers for high-value gifts", () => {
  const { store, engine } = fixture();
  try {
    engine.updateSettings({
      ...defaultSettings,
      bigGiftEffectEnabled: true,
      bigGiftThreshold: 50,
    });
    
    // Gift below threshold - no special milestone
    engine.ingest(gift("g1", 4, true, "s1"));
    let snapshot = engine.snapshot();
    const milestoneCount1 = snapshot.ceremonies.filter(
      (c) => c.action === "milestone" && c.name.includes("đại công đức")
    ).length;
    assert.equal(milestoneCount1, 0);

    // Gift at threshold - triggers special effect
    engine.ingest(gift("g2", 5, true, "s2"));
    snapshot = engine.snapshot();
    const milestoneCount2 = snapshot.ceremonies.filter(
      (c) => c.action === "milestone" && c.name.includes("đại công đức")
    ).length;
    assert.equal(milestoneCount2, 1);
  } finally {
    store.close();
  }
});

test("scene time calculation returns correct periods", () => {
  assert.equal(getScenePeriod(5), "dawn");
  assert.equal(getScenePeriod(6), "dawn");
  assert.equal(getScenePeriod(7), "day");
  assert.equal(getScenePeriod(12), "day");
  assert.equal(getScenePeriod(16), "day");
  assert.equal(getScenePeriod(17), "dusk");
  assert.equal(getScenePeriod(18), "dusk");
  assert.equal(getScenePeriod(19), "night");
  assert.equal(getScenePeriod(23), "night");
  assert.equal(getScenePeriod(3), "night");
});

test("lunar day calculation detects special days", () => {
  // Test a known new moon date
  const newMoon = new Date(Date.UTC(2000, 0, 6, 18, 14));
  const lunar1 = getLunarDay(newMoon);
  assert.equal(lunar1.day, 1);
  assert.equal(lunar1.isSpecial, true);

  // Test approximately 15 days later (full moon)
  const fullMoon = new Date(newMoon.getTime() + 14.5 * 24 * 60 * 60 * 1000);
  const lunar15 = getLunarDay(fullMoon);
  assert.equal(lunar15.day, 15);
  assert.equal(lunar15.isSpecial, true);

  // Test a regular day
  const regular = new Date(newMoon.getTime() + 7 * 24 * 60 * 60 * 1000);
  const lunar7 = getLunarDay(regular);
  assert.equal(lunar7.isSpecial, false);
});

test("streak titles return correct values", () => {
  assert.equal(getStreakTitle(1), "");
  assert.equal(getStreakTitle(2), "");
  assert.equal(getStreakTitle(3), "Thành tâm");
  assert.equal(getStreakTitle(6), "Thành tâm");
  assert.equal(getStreakTitle(7), "Đạo hữu");
  assert.equal(getStreakTitle(29), "Đạo hữu");
  assert.equal(getStreakTitle(30), "Đồng tu");
  assert.equal(getStreakTitle(99), "Đồng tu");
  assert.equal(getStreakTitle(100), "Thiện tri thức");
  assert.equal(getStreakTitle(500), "Thiện tri thức");
});

test("viewer streaks update daily", () => {
  const { store, engine, setTime } = fixture();
  try {
    // Set time to a specific date (2024-01-15 10:00 Saigon = UTC+7)
    const baseTime = new Date("2024-01-15T03:00:00Z").getTime();
    setTime(baseTime);
    
    engine.updateSettings({
      ...defaultSettings,
      streaksEnabled: true,
    });
    
    engine.ingest(comment("d1", "!le", "user1"));
    let admin = engine.snapshot(true) as AdminSnapshot;
    const streak1 = admin.viewerStreaks.find((s) => s.visitorId === "user1");
    assert.ok(streak1);
    assert.equal(streak1.currentStreak, 1);
    
    // Same day - no change
    setTime(baseTime + 1000);
    engine.ingest(comment("d2", "!nhang", "user1"));
    admin = engine.snapshot(true) as AdminSnapshot;
    const streak2 = admin.viewerStreaks.find((s) => s.visitorId === "user1");
    assert.equal(streak2!.currentStreak, 1);
    
    // Next day
    setTime(baseTime + 25 * 60 * 60 * 1000);
    engine.ingest(comment("d3", "!le", "user1"));
    admin = engine.snapshot(true) as AdminSnapshot;
    const streak3 = admin.viewerStreaks.find((s) => s.visitorId === "user1");
    assert.equal(streak3!.currentStreak, 2);
  } finally {
    store.close();
  }
});

test("fortune list can be customized via API", () => {
  const { store, engine } = fixture();
  try {
    const customFortunes = ["Lời thăm một", "Lời thăm hai"];
    engine.updateFortuneList(customFortunes);
    
    const admin = engine.snapshot(true) as AdminSnapshot;
    assert.deepEqual(admin.fortuneList, customFortunes);
    
    // Draw fortune should use custom list
    engine.ingest(comment("f1", "!que", "user1"));
    const fortune = engine.snapshot().fortunes[0];
    assert.ok(customFortunes.includes(fortune.text));
  } finally {
    store.close();
  }
});

test("snapshot includes scene time information", () => {
  const { store, engine, setTime } = fixture();
  try {
    // Set to morning in Saigon (7 AM Saigon = 0:00 UTC)
    setTime(new Date("2024-01-15T00:00:00Z").getTime());
    
    engine.updateSettings({
      ...defaultSettings,
      sceneByTimeEnabled: true,
    });
    
    const snapshot = engine.snapshot();
    assert.ok(snapshot.sceneTime);
    assert.equal(snapshot.sceneTime.period, "day");
    assert.equal(typeof snapshot.sceneTime.lunarDay, "number");
    assert.equal(typeof snapshot.sceneTime.isLunarSpecial, "boolean");
  } finally {
    store.close();
  }
});

test("goal and fortune APIs are available", async () => {
  const { createTempleApp } = await import("../apps/server/src/app.ts");
  const temple = createTempleApp(":memory:");
  await new Promise<void>((resolve) =>
    temple.server.listen(0, "127.0.0.1", resolve),
  );
  const port = (temple.server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  
  try {
    // Enable community goal
    await fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...defaultSettings,
        communityGoalEnabled: true,
        communityGoalTarget: 50,
      }),
    });
    
    // Start goal
    const startRes = await fetch(`${base}/api/goal/start`, { method: "POST" });
    assert.equal(startRes.status, 200);
    const startData = await startRes.json();
    assert.ok(startData.communityGoal);
    
    // Stop goal
    const stopRes = await fetch(`${base}/api/goal/stop`, { method: "POST" });
    assert.equal(stopRes.status, 200);
    const stopData = await stopRes.json();
    assert.equal(stopData.communityGoal, null);
    
    // Update fortune list
    const fortuneRes = await fetch(`${base}/api/fortunes`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fortunes: ["Test fortune 1", "Test fortune 2"] }),
    });
    assert.equal(fortuneRes.status, 200);
    const fortuneData = await fortuneRes.json();
    assert.deepEqual(fortuneData.fortuneList, ["Test fortune 1", "Test fortune 2"]);
  } finally {
    await temple.close();
  }
});
