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
};
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
    Action | "milestone" | "like" | "follow" | "audience-milestone" | "share";
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
}
export interface AdminSnapshot extends Snapshot {
  mappings: GiftMapping[];
  pendingPrayers: Prayer[];
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
