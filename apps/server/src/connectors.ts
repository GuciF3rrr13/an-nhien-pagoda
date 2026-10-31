import { randomUUID } from "node:crypto";
import type {
  ConnectorStatus,
  LiveEvent,
} from "../../../packages/shared/src/index.ts";

export interface LiveConnector {
  start(): Promise<void>;
  stop(): Promise<void>;
}
export class MockConnector implements LiveConnector {
  constructor(private emit: (event: LiveEvent) => void) {}
  async start() {}
  async stop() {}
  send(event: LiveEvent) {
    this.emit(event);
  }
}
// SDK payloads stay at this boundary. No SDK types enter game contracts.
export function normalizeTikTok(
  type: string,
  payload: Record<string, any>,
  at = Date.now(),
): LiveEvent | undefined {
  if (type === "roomUser") {
    const raw = payload.total ?? payload.viewerCount;
    if (!(
      typeof raw === "number" ||
      (typeof raw === "string" && /^\d+$/.test(raw))
    ))
      return;
    const count = Number(raw);
    if (!Number.isSafeInteger(count) || count < 0 || count > 10000000) return;
    return {
      id: `tt:${type}:${payload.msgId ?? payload.common?.msgId ?? randomUUID()}`,
      timestamp: at,
      source: "tiktok",
      type: "audience",
      count,
    };
  }
  const user = payload.user ?? payload;
  const uid = String(user.id ?? user.userId ?? user.uniqueId ?? "");
  if (!uid || uid === "0") return;
  const base = {
    id: `tt:${type}:${payload.msgId ?? payload.common?.msgId ?? randomUUID()}`,
    timestamp: at,
    source: "tiktok" as const,
    user: {
      id: uid.slice(0, 100),
      name: String(user.nickname ?? user.uniqueId ?? uid).slice(0, 60),
    },
  };
  if (type === "chat")
    return {
      ...base,
      type: "comment",
      text: String(payload.comment ?? "").slice(0, 500),
    };
  if (type === "member") return { ...base, type: "join" };
  if (type === "like")
    return {
      ...base,
      type: "like",
      count: Math.min(100000, Math.max(1, Number(payload.likeCount) || 1)),
    };
  if (type === "follow") return { ...base, type: "follow" };
  if (type === "share") return { ...base, type: "share" };
  if (type === "gift") {
    const giftId = String(
      payload.giftId ?? payload.gift?.id ?? payload.gift?.giftId ?? "unknown",
    );
    const rawGroup = String(
      payload.groupId || payload.giftDetails?.groupId || "",
    );
    const group = rawGroup && rawGroup !== "0" ? rawGroup : undefined;
    const final =
      (payload.giftType ?? payload.gift?.type) !== 1 ||
      Boolean(payload.repeatEnd);
    // Without a group ID, wait for the final aggregate rather than add cumulative packets.
    if (!group && !final) return;
    const streakId =
      group ??
      String(
        payload.orderId || payload.msgId || payload.common?.msgId || base.id,
      );
    return {
      ...base,
      type: "gift",
      giftId,
      giftName: String(
        payload.giftName ??
          payload.gift?.name ??
          payload.extendedGiftInfo?.name ??
          giftId,
      ).slice(0, 100),
      count: Math.min(100000, Math.max(1, Number(payload.repeatCount) || 1)),
      streakId,
      final,
    };
  }
}

export class TikTokConnector implements LiveConnector {
  private connection: any;
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = true;
  private attempt = 0;
  constructor(
    private username: string,
    private key: string | undefined,
    private emit: (event: LiveEvent) => void,
    private status: (value: ConnectorStatus) => void,
  ) {}
  private report(state: ConnectorStatus["state"], detail: string) {
    this.status({ mode: "tiktok", state, detail, attempt: this.attempt });
  }
  async start() {
    this.stopped = false;
    await this.connect();
  }
  private schedule() {
    if (this.stopped || this.timer) return;
    if (this.attempt >= 6) {
      this.report(
        "error",
        "Kết nối thất bại sau 6 lần thử. Kiểm tra tài khoản đang LIVE và khóa ký, rồi kết nối lại.",
      );
      return;
    }
    const delay = Math.min(30000, 1000 * 2 ** this.attempt);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.connect();
    }, delay);
  }
  private async connect() {
    if (this.stopped) return;
    this.attempt++;
    this.report("connecting", `Đang kết nối @${this.username}…`);
    try {
      if (this.connection) {
        this.connection.removeAllListeners();
        await this.connection.disconnect().catch(() => {});
      }
      const sdk = await import("tiktok-live-connector");
      if (this.stopped) return;
      const Connection =
        (sdk as any).TikTokLiveConnection ?? (sdk as any).WebcastPushConnection;
      if (!Connection) throw new Error("unsupported-sdk");
      this.connection = new Connection(this.username, {
        processInitialData: false,
        enableExtendedGiftInfo: true,
        ...(this.key ? { signApiKey: this.key } : {}),
      });
      for (const type of [
        "chat",
        "member",
        "like",
        "follow",
        "gift",
        "share",
        "roomUser",
      ])
        this.connection.on(type, (payload: Record<string, any>) => {
          if (this.stopped) return;
          const event = normalizeTikTok(type, payload);
          if (event) this.emit(event);
        });
      this.connection.on("error", () => {
        if (!this.stopped) {
          this.report("error", "Lỗi kết nối TikTok. Đang thử lại.");
          this.schedule();
        }
      });
      this.connection.on("disconnected", () => {
        if (!this.stopped) {
          this.report("disconnected", "Mất kết nối TikTok. Đang thử lại.");
          this.schedule();
        }
      });
      this.connection.on("streamEnd", () => {
        this.stopped = true;
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
        this.report("disconnected", "Phiên LIVE đã kết thúc.");
      });
      await this.connection.connect();
      if (!this.stopped) {
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
        this.attempt = 0;
        this.report("connected", `Đang nhận sự kiện @${this.username}`);
      }
    } catch {
      if (!this.stopped) {
        this.report(
          "error",
          "Chưa kết nối được. Kiểm tra tài khoản đang LIVE và cấu hình ký.",
        );
        this.schedule();
      }
    }
  }
  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.connection) {
      this.connection.removeAllListeners();
      await this.connection.disconnect().catch(() => {});
    }
  }
}
