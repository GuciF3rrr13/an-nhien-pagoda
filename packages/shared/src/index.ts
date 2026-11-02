import { z } from "zod";

export const actionSchema = z.enum(["bow", "incense", "lotus", "prayer"]);
export type Action = z.infer<typeof actionSchema>;
const base = {
  id: z.string().min(1).max(200),
  timestamp: z.number().int().nonnegative(),
  source: z.enum(["mock", "tiktok", "replay"]),
  user: z.object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(60),
  }),
};
export const liveEventSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("join") }),
  z.object({ ...base, type: z.literal("share") }),
  z.object({
    id: base.id,
    timestamp: base.timestamp,
    source: base.source,
    type: z.literal("audience"),
    count: z.number().int().min(0).max(10000000),
  }),
  z.object({
    ...base,
    type: z.literal("comment"),
    text: z.string().min(1).max(500),
  }),
  z.object({
    ...base,
    type: z.literal("like"),
    count: z.number().int().min(1).max(100000),
  }),
  z.object({ ...base, type: z.literal("follow") }),
  z.object({
    ...base,
    type: z.literal("gift"),
    giftId: z.string().min(1).max(100),
    giftName: z.string().max(100),
    count: z.number().int().min(1).max(100000),
    streakId: z.string().min(1).max(200),
    final: z.boolean(),
  }),
]);
export type LiveEvent = z.infer<typeof liveEventSchema>;
export const settingsSchema = z.object({
  cooldownSeconds: z.number().int().min(0).max(300),
  camera: z.enum(["wide", "close"]),
  autoCamera: z.boolean(),
  ambientVolume: z.number().min(0).max(1),
  ceremonyVolume: z.number().min(0).max(1),
  narratorEnabled: z.boolean().default(true),
  narratorVolume: z.number().min(0).max(1).default(0.85),
  // New engagement features
  shoutoutsEnabled: z.boolean().default(true),
  fortuneEnabled: z.boolean().default(true),
  fortuneCooldownHours: z.number().int().min(1).max(168).default(24),
  streaksEnabled: z.boolean().default(true),
  communityGoalEnabled: z.boolean().default(false),
  communityGoalTarget: z.number().int().min(10).max(10000).default(100),
  communityGoalMinutes: z.number().int().min(1).max(180).default(30),
  bigGiftEffectEnabled: z.boolean().default(true),
  bigGiftThreshold: z.number().int().min(5).max(1000).default(50),
  sceneByTimeEnabled: z.boolean().default(true),
  browserTTSEnabled: z.boolean().default(true),
  allEffectsEnabled: z.boolean().default(true),
  prayerDisplaySeconds: z.number().int().min(10).max(600).default(60),
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  cooldownSeconds: 10,
  camera: "wide",
  autoCamera: false,
  ambientVolume: 0.2,
  ceremonyVolume: 0.45,
  narratorEnabled: true,
  narratorVolume: 0.85,
  shoutoutsEnabled: true,
  fortuneEnabled: true,
  fortuneCooldownHours: 24,
  streaksEnabled: true,
  communityGoalEnabled: false,
  communityGoalTarget: 100,
  communityGoalMinutes: 30,
  bigGiftEffectEnabled: true,
  bigGiftThreshold: 50,
  sceneByTimeEnabled: true,
  browserTTSEnabled: true,
  allEffectsEnabled: true,
  prayerDisplaySeconds: 60,
};
export const tiktokUsernameSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, ""))
  .pipe(z.string().regex(/^([\w.]{1,64})?$/));
// signApiKey: omitted keeps the stored key, "" or null clears it.
export const tiktokConfigInputSchema = z.object({
  username: tiktokUsernameSchema,
  signApiKey: z.string().trim().max(200).nullable().optional(),
});
export interface TikTokConfig {
  username: string;
  hasSignKey: boolean;
}
export const mappingSchema = z.object({
  giftId: z.string().min(1).max(100),
  name: z.string().min(1).max(60),
  action: actionSchema,
  intensity: z.number().int().min(1).max(3),
  points: z.number().int().min(1).max(1000),
});
export type GiftMapping = z.infer<typeof mappingSchema>;
export interface Prayer {
  id: number;
  userName: string;
  text: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  approvedAt?: number;
}
export interface Visitor {
  id: string;
  name: string;
  slot: number;
  variant: number;
  joinedAt: number;
  action: Action | null;
  actionAt: number;
  expiresAt: number;
}
export interface Ceremony {
  id: string;
  action:
    Action | "milestone" | "like" | "follow" | "audience-milestone" | "share" | "big-gift";
  name: string;
  intensity: number;
  count: number;
  at: number;
}
export interface EventRecord {
  id: string;
  type: LiveEvent["type"];
  userName: string;
  source: LiveEvent["source"];
  at: number;
  result: string;
  giftId?: string;
}
export interface ConnectorStatus {
  mode: "mock" | "tiktok";
  state: "connected" | "connecting" | "disconnected" | "error";
  detail: string;
  attempt: number;
}
export interface LeaderboardEntry {
  userId: string;
  userName: string;
  score: number;
}
export interface Announcement {
  id: string;
  at: number;
  sessionId: string;
  kind: "gift" | "follow" | "share" | "audience-milestone" | "share-prompt";
  text: string;
}

export interface Shoutout {
  id: string;
  at: number;
  userName: string;
  blessing: string;
  action: Action | "fortune";
}

export interface FortuneSlip {
  id: string;
  at: number;
  userName: string;
  text: string;
}

export interface CommunityGoal {
  id: string;
  startedAt: number;
  endsAt: number;
  target: number;
  progress: number;
  completed: boolean;
}

export interface ViewerStreak {
  visitorId: string;
  visitorName: string;
  currentStreak: number;
  lastVisitDate: string;
  title: string;
}

export const streakTitles: Record<number, string> = {
  3: "Thành tâm",
  7: "Đạo hữu",
  30: "Đồng tu",
  100: "Thiện tri thức",
};
export interface Snapshot {
  announcements: Announcement[];
  audience: {
    current: number | null;
    peak: number;
    milestones: number[];
    updatedAt: number | null;
  };
  session: {
    id: string;
    startedAt: number;
    source: "mock" | "tiktok";
    gifts: LeaderboardEntry[];
    participation: LeaderboardEntry[];
  };
  seq: number;
  serverTime: number;
  progress: number;
  milestones: number[];
  totals: {
    visits: number;
    lotus: number;
    incense: number;
    bows: number;
    likes: number;
  };
  settings: Settings;
  visitors: Visitor[];
  ceremonies: Ceremony[];
  prayers: Prayer[];
  recent: EventRecord[];
  connector: ConnectorStatus;
  shoutouts: Shoutout[];
  fortunes: FortuneSlip[];
  communityGoal: CommunityGoal | null;
  sceneTime: {
    period: "dawn" | "day" | "dusk" | "night";
    isLunarSpecial: boolean;
    lunarDay: number;
  };
}
export interface AdminSnapshot extends Snapshot {
  mappings: GiftMapping[];
  pendingPrayers: Prayer[];
  fortuneList: string[];
  viewerStreaks: ViewerStreak[];
}
export type SocketMessage = {
  type: "snapshot";
  state: Snapshot | AdminSnapshot;
};
export const actionLabels: Record<Action, string> = {
  bow: "Lễ Phật",
  incense: "Thắp nhang",
  lotus: "Dâng hoa",
  prayer: "Cầu nguyện",
};
export function nextMilestone(progress: number) {
  return progress < 100
    ? 100
    : progress < 250
      ? 250
      : progress < 500
        ? 500
        : (Math.floor(progress / 500) + 1) * 500;
}

export const defaultBlessings: string[] = [
  "Bình an đến với bạn",
  "Hạnh phúc tràn đầy",
  "Tâm an lạc",
  "Phước lành vô biên",
  "An nhiên tự tại",
  "Vạn sự như ý",
  "Công đức viên mãn",
  "Tâm sáng, ý tịnh",
  "Bồ đề nở hoa",
  "Lành thay, lành thay",
  "Hoa sen nở đẹp",
  "Ánh sáng giác ngộ",
];

export const defaultFortuneSlips: string[] = [
  "Nhẫn nhục là sức mạnh vô địch",
  "Tâm bình thế giới bình",
  "Giọt nước nhỏ cũng làm đầy bình",
  "Yêu thương là nguồn sống",
  "Hãy là ánh sáng trong bóng tối",
  "Mỗi ngày là một món quà",
  "Lời nói nhẹ nhàng, lòng người ấm áp",
  "Buông bỏ muộn phiền, an vui tự đến",
  "Từ bi là sức mạnh của kẻ mạnh",
  "Hành động nhỏ, kết quả lớn",
  "Lắng nghe tiếng lòng, tìm thấy bình yên",
  "Sống chậm lại, yêu thương nhiều hơn",
  "Nụ cười là thần chú mầu nhiệm",
  "Biết đủ là giàu có",
  "Mọi rắc rối đều tạm thời",
  "Hạnh phúc ở ngay trong hiện tại",
  "Đường xa nghìn dặm, bắt đầu từ một bước",
  "Làm việc tốt, được điều tốt",
  "Tâm thanh tịnh, mọi sự thông suốt",
  "Kiên nhẫn là chìa khóa thành công",
];

export function getStreakTitle(streak: number): string {
  const milestones = Object.keys(streakTitles)
    .map(Number)
    .sort((a, b) => b - a);
  for (const m of milestones) {
    if (streak >= m) return streakTitles[m];
  }
  return "";
}

export function getScenePeriod(
  hour: number,
): "dawn" | "day" | "dusk" | "night" {
  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 17) return "day";
  if (hour >= 17 && hour < 19) return "dusk";
  return "night";
}

export function getLunarDay(date: Date): { day: number; isSpecial: boolean } {
  const synodic = 29.53058770576;
  const known = new Date(Date.UTC(2000, 0, 6, 18, 14)); // Known new moon
  const diff = (date.getTime() - known.getTime()) / (1000 * 60 * 60 * 24);
  const phase = diff % synodic;
  const day = Math.floor(phase) + 1;
  const isSpecial = day === 1 || day === 15;
  return { day, isSpecial };
}
