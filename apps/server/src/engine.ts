import { randomUUID } from "node:crypto";
import {
  defaultSettings,
  defaultBlessings,
  defaultFortuneSlips,
  actionLabels,
  getScenePeriod,
  getLunarDay,
  getStreakTitle,
  type Action,
  type Announcement,
  type AdminSnapshot,
  type ConnectorStatus,
  type CommunityGoal,
  type FortuneSlip,
  type GiftMapping,
  type LiveEvent,
  type LeaderboardEntry,
  type Prayer,
  type Settings,
  type Shoutout,
  type Snapshot,
  type ViewerStreak,
  type Visitor,
} from "../../../packages/shared/src/index.ts";
import { Store } from "./store.ts";

interface DurableState {
  version: 1;
  seq: number;
  progress: number;
  milestones: number[];
  totals: Snapshot["totals"];
  settings: Settings;
  visitors: Visitor[];
  ceremonies: Snapshot["ceremonies"];
  recent: Snapshot["recent"];
  prayers: Prayer[];
  mappings: GiftMapping[];
  cooldowns: Record<string, number>;
  streaks: Record<string, number>;
  announcements: Announcement[];
  thankedStreaks: Record<string, boolean>;
  followThanks: Record<string, number>;
  audience: Snapshot["audience"];
  shareThanks: Record<string, number>;
  lastSharePrompt: number;
  lastAudienceCelebration: number | null;
  prayerId: number;
  session: {
    id: string;
    startedAt: number;
    source: "mock" | "tiktok";
    gifts: Record<string, LeaderboardEntry>;
    participation: Record<string, LeaderboardEntry>;
  };
  prayerCredits: Record<
    string,
    {
      userId: string;
      userName: string;
      sessionId: string;
      source: LiveEvent["source"];
    }
  >;
  // New engagement features
  shoutouts: Shoutout[];
  fortunes: FortuneSlip[];
  fortuneDraws: Record<string, number>; // visitorId -> last draw timestamp
  viewerStreaks: Record<string, { streak: number; lastDate: string; name: string }>;
  communityGoal: CommunityGoal | null;
  fortuneList: string[];
  blessingsList: string[];
}
const initial = (now: number): DurableState => ({
  version: 1,
  seq: 0,
  progress: 0,
  milestones: [],
  totals: { visits: 0, lotus: 0, incense: 0, bows: 0, likes: 0 },
  settings: { ...defaultSettings },
  visitors: [],
  ceremonies: [],
  recent: [],
  prayers: [],
  mappings: [
    {
      giftId: "mock-lotus",
      name: "Hoa sen mẫu",
      action: "lotus",
      intensity: 2,
      points: 10,
    },
    {
      giftId: "mock-lantern",
      name: "Đèn mẫu",
      action: "incense",
      intensity: 2,
      points: 5,
    },
    {
      giftId: "mock-bell",
      name: "Chuông mẫu",
      action: "bow",
      intensity: 3,
      points: 25,
    },
  ],
  cooldowns: {},
  streaks: {},
  announcements: [],
  thankedStreaks: {},
  followThanks: {},
  audience: { current: null, peak: 0, milestones: [], updatedAt: null },
  shareThanks: {},
  lastSharePrompt: now,
  lastAudienceCelebration: null,
  prayerId: 0,
  session: {
    id: randomUUID(),
    startedAt: now,
    source: "mock",
    gifts: {},
    participation: {},
  },
  prayerCredits: {},
  shoutouts: [],
  fortunes: [],
  fortuneDraws: {},
  viewerStreaks: {},
  communityGoal: null,
  fortuneList: [...defaultFortuneSlips],
  blessingsList: [...defaultBlessings],
});

export class Engine {
  private state: DurableState;
  connector: ConnectorStatus = {
    mode: "mock",
    state: "connected",
    detail: "Mô phỏng cục bộ",
    attempt: 0,
  };
  onChange = () => {};
  constructor(
    readonly store: Store,
    readonly now: () => number = Date.now,
  ) {
    this.state = store.load<DurableState>() ?? initial(this.now());
    this.state.session ??= {
      id: randomUUID(),
      startedAt: this.now(),
      source: "mock",
      gifts: {},
      participation: {},
    };
    this.state.prayerCredits ??= {};
    this.state.settings = { ...defaultSettings, ...this.state.settings };
    this.state.announcements ??= [];
    this.state.thankedStreaks ??= {};
    this.state.followThanks ??= {};
    this.state.audience ??= {
      current: null,
      peak: 0,
      milestones: [],
      updatedAt: null,
    };
    this.state.audience.current = null;
    this.state.audience.updatedAt = null;
    this.state.shareThanks ??= {};
    this.state.lastSharePrompt ??= this.state.session.startedAt;
    this.state.lastAudienceCelebration ??= null;
    // New engagement features defaults
    this.state.shoutouts ??= [];
    this.state.fortunes ??= [];
    this.state.fortuneDraws ??= {};
    this.state.viewerStreaks ??= {};
    this.state.communityGoal ??= null;
    this.state.fortuneList ??= [...defaultFortuneSlips];
    this.state.blessingsList ??= [...defaultBlessings];
    if (this.state.version !== 1)
      throw new Error("Unsupported database version");
    store.save(this.state);
  }
  snapshot(admin = false): Snapshot | AdminSnapshot {
    const s = this.state,
      now = this.now();
    const publicState: Snapshot = {
      audience: {
        ...s.audience,
        current:
          s.audience.updatedAt !== null && now - s.audience.updatedAt < 30000
            ? s.audience.current
            : null,
        milestones: [...s.audience.milestones],
      },
      announcements: s.announcements
        .filter(
          (a) =>
            a.sessionId === s.session.id && now - a.at < 30000 && now >= a.at,
        )
        .map((a) => ({ ...a })),
      session: {
        ...s.session,
        gifts: this.top(s.session.gifts),
        participation: this.top(s.session.participation),
      },
      seq: s.seq,
      serverTime: now,
      progress: s.progress,
      milestones: [...s.milestones],
      totals: { ...s.totals },
      settings: { ...s.settings },
      visitors: s.visitors
        .filter((v) => v.expiresAt > now)
        .map((v) => ({ ...v })),
      ceremonies: s.ceremonies
        .filter((c) => now - c.at < 12000)
        .map((c) => ({ ...c })),
      prayers: s.prayers
        .filter((p) => p.status === "approved")
        .slice(-10)
        .map((p) => ({ ...p })),
      recent: admin ? s.recent.map((r) => ({ ...r })) : [],
      connector: { ...this.connector },
      shoutouts: s.shoutouts
        .filter((o) => now - o.at < 8000)
        .map((o) => ({ ...o })),
      fortunes: s.fortunes
        .filter((f) => now - f.at < 10000)
        .map((f) => ({ ...f })),
      communityGoal: s.communityGoal && s.communityGoal.endsAt > now
        ? { ...s.communityGoal }
        : null,
      sceneTime: this.getSceneTime(now),
    };
    return admin
      ? {
          ...publicState,
          mappings: structuredClone(s.mappings),
          pendingPrayers: s.prayers
            .filter((p) => p.status === "pending")
            .map((p) => ({ ...p })),
          fortuneList: [...(s.fortuneList ?? defaultFortuneSlips)],
          viewerStreaks: Object.entries(s.viewerStreaks ?? {}).map(
            ([visitorId, data]) => ({
              visitorId,
              visitorName: data.name,
              currentStreak: data.streak,
              lastVisitDate: data.lastDate,
              title: getStreakTitle(data.streak),
            }),
          ),
        }
      : publicState;
  }

  private getSceneTime(now: number): Snapshot["sceneTime"] {
    const date = new Date(now);
    const saigonOffset = 7 * 60;
    const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
    const saigonMinutes = utcMinutes + saigonOffset;
    const hour = Math.floor((saigonMinutes % 1440) / 60);
    const lunar = getLunarDay(date);
    return {
      period: getScenePeriod(hour),
      isLunarSpecial: lunar.isSpecial,
      lunarDay: lunar.day,
    };
  }
  announcement(id: string): Announcement | undefined {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      return undefined;
    return this.snapshot().announcements.find((a) => a.id === id);
  }
  private announce(kind: Announcement["kind"], text: string) {
    const now = this.now();
    this.state.announcements = this.state.announcements
      .filter(
        (a) => now - a.at < 30000 && a.sessionId === this.state.session.id,
      )
      .slice(-23);
    this.state.announcements.push({
      id: randomUUID(),
      at: now,
      sessionId: this.state.session.id,
      kind,
      text,
    });
  }
  private safeName(name: string) {
    return (
      [
        ...name
          .normalize("NFC")
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .replace(/\s+/g, " ")
          .trim(),
      ]
        .slice(0, 40)
        .join("")
        .trim() || "bạn"
    );
  }

  private shoutout(userName: string, action: Shoutout["action"]) {
    const s = this.state;
    if (!s.settings.allEffectsEnabled || !s.settings.shoutoutsEnabled) return;
    const now = this.now();
    const blessings = s.blessingsList?.length
      ? s.blessingsList
      : defaultBlessings;
    const blessing = blessings[Math.floor(Math.random() * blessings.length)];
    s.shoutouts = s.shoutouts.filter((o) => now - o.at < 8000).slice(-7);
    s.shoutouts.push({
      id: randomUUID(),
      at: now,
      userName: this.safeName(userName),
      blessing,
      action,
    });
  }

  private drawFortune(userId: string, userName: string): string | null {
    const s = this.state;
    if (!s.settings.allEffectsEnabled || !s.settings.fortuneEnabled) {
      return null;
    }
    const now = this.now();
    const cooldownMs = (s.settings.fortuneCooldownHours ?? 24) * 60 * 60 * 1000;
    const lastDraw = s.fortuneDraws[userId];
    if (lastDraw && now - lastDraw < cooldownMs) {
      return null;
    }
    const fortunes = s.fortuneList?.length ? s.fortuneList : defaultFortuneSlips;
    const text = fortunes[Math.floor(Math.random() * fortunes.length)];
    s.fortuneDraws[userId] = now;
    s.fortunes = s.fortunes.filter((f) => now - f.at < 10000).slice(-7);
    s.fortunes.push({
      id: randomUUID(),
      at: now,
      userName: this.safeName(userName),
      text,
    });
    // Cleanup old fortune draws (keep last 10000)
    const drawKeys = Object.keys(s.fortuneDraws);
    if (drawKeys.length > 10000) {
      const sorted = drawKeys.sort((a, b) =>
        (s.fortuneDraws[a] ?? 0) - (s.fortuneDraws[b] ?? 0)
      );
      for (const key of sorted.slice(0, drawKeys.length - 10000)) {
        delete s.fortuneDraws[key];
      }
    }
    return text;
  }

  private updateStreak(userId: string, userName: string) {
    const s = this.state;
    if (!s.settings.allEffectsEnabled || !s.settings.streaksEnabled) return;
    const now = new Date(this.now());
    const saigonOffset = 7 * 60 * 60 * 1000;
    const saigonDate = new Date(now.getTime() + saigonOffset);
    const today = saigonDate.toISOString().split("T")[0];
    const existing = s.viewerStreaks[userId];
    if (existing && existing.lastDate === today) return;
    if (existing) {
      const yesterday = new Date(saigonDate.getTime() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      if (existing.lastDate === yesterday) {
        existing.streak++;
      } else {
        existing.streak = 1;
      }
      existing.lastDate = today;
      existing.name = userName;
    } else {
      s.viewerStreaks[userId] = { streak: 1, lastDate: today, name: userName };
    }
    // Cleanup old streaks (keep last 50000)
    const streakKeys = Object.keys(s.viewerStreaks);
    if (streakKeys.length > 50000) {
      const sorted = streakKeys.sort((a, b) =>
        (s.viewerStreaks[a]?.lastDate ?? "").localeCompare(
          s.viewerStreaks[b]?.lastDate ?? "",
        )
      );
      for (const key of sorted.slice(0, streakKeys.length - 50000)) {
        delete s.viewerStreaks[key];
      }
    }
  }

  private advanceCommunityGoal(points: number) {
    const s = this.state;
    if (!s.settings.allEffectsEnabled || !s.settings.communityGoalEnabled) return;
    const now = this.now();
    if (!s.communityGoal || s.communityGoal.endsAt <= now || s.communityGoal.completed) {
      return;
    }
    s.communityGoal.progress += points;
    if (s.communityGoal.progress >= s.communityGoal.target) {
      s.communityGoal.completed = true;
      this.ceremony("milestone", "Hoàn thành mục tiêu cộng đồng!", 3);
      this.announce("audience-milestone", "Chúc mừng! Cả phòng đã hoàn thành mục tiêu chung.");
    }
  }

  startCommunityGoal() {
    const s = this.state;
    if (!s.settings.allEffectsEnabled || !s.settings.communityGoalEnabled) return false;
    const now = this.now();
    if (s.communityGoal && s.communityGoal.endsAt > now && !s.communityGoal.completed) {
      return false;
    }
    this.commit(() => {
      this.state.communityGoal = {
        id: randomUUID(),
        startedAt: now,
        endsAt: now + (s.settings.communityGoalMinutes ?? 30) * 60 * 1000,
        target: s.settings.communityGoalTarget ?? 100,
        progress: 0,
        completed: false,
      };
    });
    return true;
  }

  stopCommunityGoal() {
    this.commit(() => {
      this.state.communityGoal = null;
    });
  }

  updateFortuneList(fortunes: string[]) {
    this.commit(() => {
      this.state.fortuneList = fortunes.slice(0, 100);
    });
  }

  private top(board: Record<string, LeaderboardEntry>): LeaderboardEntry[] {
    return Object.values(board)
      .sort(
        (a, b) => b.score - a.score || a.userId.localeCompare(b.userId, "en"),
      )
      .slice(0, 5)
      .map((entry) => ({ ...entry }));
  }
  private score(
    board: Record<string, LeaderboardEntry>,
    user: { id: string; name: string },
    points: number,
  ) {
    const entry = Object.hasOwn(board, user.id)
      ? board[user.id]
      : { userId: user.id, userName: user.name, score: 0 };
    entry.userName = user.name;
    entry.score += points;
    Object.defineProperty(board, user.id, {
      value: entry,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  newSession(source = this.connector.mode) {
    this.commit(() => {
      this.state.audience = {
        current: null,
        peak: 0,
        milestones: [],
        updatedAt: null,
      };
      this.state.shareThanks = {};
      this.state.lastSharePrompt = this.now();
      this.state.lastAudienceCelebration = null;
      this.state.announcements = [];
      this.state.thankedStreaks = {};
      this.state.followThanks = {};
      this.state.session = {
        id: randomUUID(),
        startedAt: this.now(),
        source,
        gifts: {},
        participation: {},
      };
    });
  }
  private commit(fn: () => void) {
    const previous = structuredClone(this.state);
    try {
      this.store.transaction(() => {
        fn();
        this.state.seq++;
        this.store.save(this.state);
      });
    } catch (error) {
      this.state = previous;
      throw error;
    }
    this.onChange();
  }
  private ceremony(
    action: Snapshot["ceremonies"][number]["action"],
    name: string,
    intensity: number,
    count = 1,
  ) {
    this.state.ceremonies.push({
      id: randomUUID(),
      action,
      name,
      intensity,
      count,
      at: this.now(),
    });
    this.state.ceremonies = this.state.ceremonies
      .filter((c) => this.now() - c.at < 12000)
      .slice(-16);
  }
  private visitor(event: Exclude<LiveEvent, { type: "audience" }>): Visitor {
    const s = this.state,
      now = this.now();
    s.visitors = s.visitors.filter((v) => v.expiresAt > now);
    let visitor = s.visitors.find((v) => v.id === event.user.id);
    if (!visitor) {
      let slot = 0;
      while (s.visitors.some((v) => v.slot === slot)) slot++;
      if (s.visitors.length >= 40) {
        const oldest = [...s.visitors].sort(
          (a, b) => a.expiresAt - b.expiresAt,
        )[0];
        slot = oldest.slot;
        s.visitors = s.visitors.filter((v) => v !== oldest);
      }
      visitor = {
        id: event.user.id,
        name: event.user.name,
        slot,
        variant: slot % 3,
        joinedAt: now,
        action: null,
        actionAt: 0,
        expiresAt: now + 120000,
      };
      s.visitors.push(visitor);
      s.totals.visits++;
    }
    visitor.name = event.user.name;
    visitor.expiresAt = now + 120000;
    return visitor;
  }
  ingest(event: LiveEvent) {
    if (this.store.hasEvent(event.id)) return { result: "duplicate" };
    if (event.type === "audience" || event.type === "share") {
      let result = "ignored";
      this.commit(() => {
        const s = this.state,
          now = this.now();
        if (event.source === s.session.source) {
          if (event.type === "audience") {
            const previousPeak = s.audience.peak;
            s.audience.current = event.count;
            s.audience.updatedAt = now;
            s.audience.peak = Math.max(previousPeak, event.count);
            const candidates = [100, 250, 500].filter(
              (n) => n > previousPeak && n <= event.count,
            );
            const last = Math.floor(event.count / 1000) * 1000;
            for (
              let n = Math.max(
                1000,
                Math.floor(previousPeak / 1000 + 1) * 1000,
                last - 63000,
              );
              n <= last;
              n += 1000
            )
              candidates.push(n);
            if (candidates.length) {
              s.audience.milestones = [
                ...s.audience.milestones,
                ...candidates,
              ].slice(-64);
              const milestone = candidates.at(-1)!;
              this.ceremony(
                "audience-milestone",
                `Cùng đón ${milestone} người đang xem`,
                milestone === 100 ? 1 : milestone < 1000 ? 2 : 3,
                milestone,
              );
              this.announce(
                "audience-milestone",
                `Chùa An Nhiên hân hoan đón ${milestone} người đang cùng theo dõi.`,
              );
              s.lastAudienceCelebration = now;
            }
            result = "audience";
          } else {
            this.ceremony("share", event.user.name, 1);
            const key = JSON.stringify([event.source, event.user.id]);
            if (
              s.shareThanks[key] === undefined ||
              now - s.shareThanks[key] >= 60000
            ) {
              s.shareThanks[key] = now;
              this.announce(
                "share",
                `Chùa An Nhiên xin cảm ơn ${this.safeName(event.user.name)} đã chia sẻ LIVE.`,
              );
            }
            const keys = Object.keys(s.shareThanks);
            if (keys.length > 20000)
              for (const key of keys.slice(0, keys.length - 20000))
                delete s.shareThanks[key];
            result = "share";
          }
        }
        this.store.record(event, result, now);
      });
      return { result };
    }
    let result = "received";
    this.commit(() => {
      const s = this.state,
        now = this.now();
      const visitor = this.visitor(event);
      let action: Action | undefined,
        count = 1,
        points = 1,
        intensity = 1;
      if (event.type === "comment") {
        const [command, ...words] = event.text.trim().split(/\s+/);
        const actions: Record<string, Action> = {
          "!le": "bow",
          "!nhang": "incense",
          "!cau": "prayer",
        };
        const normalizedCommand = command.toLowerCase();
        action = Object.hasOwn(actions, normalizedCommand)
          ? actions[normalizedCommand]
          : undefined;
        if (normalizedCommand === "!sen") {
          result = "gift-required";
        } else if (normalizedCommand === "!que") {
          const fortune = this.drawFortune(event.user.id, event.user.name);
          if (fortune) {
            result = "fortune";
            this.shoutout(event.user.name, "fortune");
          } else {
            result = "fortune-cooldown";
          }
        } else if (!action) {
          result = "ignored";
        } else if (action === "prayer" && !words.join(" ").trim()) {
          action = undefined;
          result = "empty-prayer";
        } else if (
          s.cooldowns[`viewer:${event.user.id}`] !== undefined &&
          now - s.cooldowns[`viewer:${event.user.id}`] <
            s.settings.cooldownSeconds * 1000
        ) {
          action = undefined;
          result = "cooldown";
        } else {
          s.cooldowns[`viewer:${event.user.id}`] = now;
          if (action === "prayer") {
            if (s.prayers.filter((p) => p.status === "pending").length >= 200) {
              action = undefined;
              result = "prayer-queue-full";
            } else {
              s.prayers.push({
                id: ++s.prayerId,
                userName: event.user.name,
                text: [...words.join(" ")].slice(0, 240).join(""),
                status: "pending",
                createdAt: now,
              });
              s.prayerCredits[String(s.prayerId)] = {
                userId: event.user.id,
                userName: event.user.name,
                sessionId: s.session.id,
                source: event.source,
              };
              result = "pending-approval";
            }
          } else {
            // Add shoutout for bow and incense actions
            this.shoutout(event.user.name, action);
          }
        }
      } else if (event.type === "gift") {
        const key = JSON.stringify([
          event.source,
          event.user.id,
          event.giftId,
          event.streakId,
        ]);
        count = Math.max(0, event.count - (s.streaks[key] ?? 0));
        s.streaks[key] = Math.max(event.count, s.streaks[key] ?? 0);
        if (
          event.final &&
          event.source === s.session.source &&
          !s.thankedStreaks[key]
        ) {
          s.thankedStreaks[key] = true;
          this.announce(
            "gift",
            `Chùa An Nhiên xin cảm ơn ${this.safeName(event.user.name)} đã gửi ${s.streaks[key]} phần quà.`,
          );
        }
        if (!count) result = "streak-already-counted";
        else {
          const mapping = s.mappings.find((m) => m.giftId === event.giftId);
          action = mapping?.action ?? "lotus";
          points = mapping?.points ?? 1;
          intensity = mapping?.intensity ?? 1;
          // Shoutout for gifts
          this.shoutout(event.user.name, action);
          // Check for big gift effect
          const totalPoints = points * count;
          if (
            s.settings.allEffectsEnabled &&
            s.settings.bigGiftEffectEnabled &&
            totalPoints >= (s.settings.bigGiftThreshold ?? 50)
          ) {
            // Big gift triggers a more intense celebration
            this.ceremony("milestone", `${this.safeName(event.user.name)} đại công đức!`, 3);
          }
        }
      } else if (event.type === "like") {
        s.totals.likes += event.count;
        this.ceremony("like", event.user.name, 1, event.count);
      } else if (event.type === "follow") {
        this.ceremony("follow", event.user.name, 1);
        const key = JSON.stringify([event.source, event.user.id]);
        if (
          event.source === s.session.source &&
          (s.followThanks[key] === undefined ||
            now - s.followThanks[key] >= 30000)
        ) {
          s.followThanks[key] = now;
          this.announce(
            "follow",
            `Chùa An Nhiên xin cảm ơn ${this.safeName(event.user.name)} đã theo dõi.`,
          );
        }
      }
      if (action) {
        if (event.source === s.session.source) {
          if (event.type === "gift")
            this.score(s.session.gifts, event.user, points * count);
          else if (
            event.type === "comment" &&
            (action === "bow" || action === "incense")
          )
            this.score(s.session.participation, event.user, 1);
        }
        visitor.action = action;
        visitor.actionAt = now;
        s.progress += points * count;
        if (action === "bow") s.totals.bows += count;
        if (action === "lotus") s.totals.lotus += count;
        if (action === "incense") s.totals.incense += count;
        this.ceremony(action, event.user.name, intensity, count);
        if (result === "received") result = action;
        const previousProgress = s.progress - points * count;
        const crossed = [100, 250, 500];
        // Coalesce a huge gift burst to its highest ceremony; never loop per point.
        const latestRepeat = Math.floor(s.progress / 500) * 500;
        if (latestRepeat >= 1000 && latestRepeat > previousProgress)
          crossed.push(latestRepeat);
        const newMilestones = crossed.filter(
          (n) =>
            n > previousProgress &&
            n <= s.progress &&
            !s.milestones.includes(n),
        );
        s.milestones.push(...newMilestones);
        s.milestones = [
          ...s.milestones.filter((n) => n <= 500),
          ...s.milestones.filter((n) => n > 500).slice(-64),
        ];
        if (newMilestones.length)
          this.ceremony(
            "milestone",
            `Cùng nhau thắp sáng · ${newMilestones.at(-1)}`,
            3,
          );
        // Update daily visit streaks
        this.updateStreak(event.user.id, event.user.name);
        // Advance community goal
        this.advanceCommunityGoal(points * count);
      }
      // Keep long-running streams bounded while durable event IDs remain in SQLite.
      for (const map of [
        s.cooldowns,
        s.streaks,
        s.thankedStreaks,
        s.followThanks,
      ]) {
        const keys = Object.keys(map);
        if (keys.length > 20000)
          for (const key of keys.slice(0, keys.length - 20000)) delete map[key];
      }
      s.prayers = s.prayers
        .filter((p) => p.status === "pending")
        .concat(s.prayers.filter((p) => p.status !== "pending").slice(-500))
        .sort((a, b) => a.id - b.id);
      s.recent = [
        {
          id: event.id,
          type: event.type,
          userName: event.user.name,
          source: event.source,
          at: now,
          result,
          ...(event.type === "gift" ? { giftId: event.giftId } : {}),
        },
        ...s.recent,
      ].slice(0, 40);
      this.store.record(event, result, now);
    });
    return { result };
  }
  updateSettings(settings: Settings) {
    this.commit(() => {
      this.state.settings = settings;
    });
  }
  updateMappings(mappings: GiftMapping[]) {
    this.commit(() => {
      this.state.mappings = mappings;
    });
  }
  moderate(id: number, status: "approved" | "rejected") {
    const prayer = this.state.prayers.find(
      (p) => p.id === id && p.status === "pending",
    );
    if (!prayer) return false;
    this.commit(() => {
      prayer.status = status;
      const credit = this.state.prayerCredits[String(id)];
      if (
        status === "approved" &&
        credit &&
        credit.sessionId === this.state.session.id &&
        credit.source === this.state.session.source
      )
        this.score(
          this.state.session.participation,
          { id: credit.userId, name: credit.userName },
          1,
        );
      delete this.state.prayerCredits[String(id)];
    });
    return true;
  }
  tick() {
    const s = this.state,
      now = this.now();
    if (
      this.connector.state !== "connected" ||
      this.connector.mode !== s.session.source ||
      s.audience.current === null ||
      s.audience.current <= 0 ||
      s.audience.updatedAt === null ||
      now - s.audience.updatedAt >= 30000 ||
      now - s.lastSharePrompt < 300000 ||
      (s.lastAudienceCelebration !== null &&
        now - s.lastAudienceCelebration < 20000)
    )
      return;
    this.commit(() => {
      this.state.lastSharePrompt = now;
      this.announce(
        "share-prompt",
        "Mời bạn chia sẻ LIVE để cùng lan tỏa lời chúc bình an.",
      );
    });
  }
  setConnector(status: ConnectorStatus) {
    const changedMode = this.state.session.source !== status.mode;
    this.connector = status;
    if (changedMode) this.newSession(status.mode);
    else
      this.commit(() => {
        if (status.state !== "connected") {
          this.state.audience.current = null;
          this.state.audience.updatedAt = null;
        }
      });
  }
  replay(limit: number) {
    const events = this.store.replayEvents(limit),
      prefix = randomUUID();
    for (const event of events)
      this.ingest({
        ...event,
        id: `${prefix}:${event.id}`.slice(0, 200),
        source: "replay",
        timestamp: this.now(),
        ...(event.type === "gift"
          ? { streakId: `${prefix}:${event.streakId}`.slice(0, 200) }
          : {}),
      });
    return events.length;
  }
}
export { actionLabels };
