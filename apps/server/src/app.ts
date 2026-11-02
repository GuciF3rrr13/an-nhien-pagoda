import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import {
  liveEventSchema,
  mappingSchema,
  settingsSchema,
  tiktokConfigInputSchema,
  type TikTokConfig,
} from "../../../packages/shared/src/index.ts";
import { Store } from "./store.ts";
import { Engine } from "./engine.ts";
import { Narrator } from "./narrator.ts";
import {
  MockConnector,
  TikTokConnector,
  type LiveConnector,
} from "./connectors.ts";

export function createTempleApp(
  dbPath = process.env.TEMPLE_DB ?? "data/temple.sqlite",
  now: () => number = Date.now,
) {
  const store = new Store(dbPath),
    engine = new Engine(store, now),
    narrator = new Narrator(),
    app = express(),
    server = createServer(app);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  // A loopback service still rejects cross-origin browser mutations and DNS rebinding.
  app.use((req, res, next) => {
    const hostname = req.hostname;
    if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostname)) {
      res.status(403).json({ error: "Chỉ hỗ trợ máy cục bộ." });
      return;
    }
    if (
      req.headers.origin &&
      req.headers.origin !== `http://${req.headers.host}`
    ) {
      res.status(403).json({ error: "Nguồn yêu cầu không hợp lệ." });
      return;
    }
    next();
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  const adminClients = new WeakSet<WebSocket>();
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const host = (req.headers.host ?? "").split(":")[0];
    if (
      url.pathname !== "/ws" ||
      !["localhost", "127.0.0.1"].includes(host) ||
      (req.headers.origin &&
        req.headers.origin !== `http://${req.headers.host}`)
    ) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (url.searchParams.get("role") === "admin") adminClients.add(ws);
      wss.emit("connection", ws, req);
    });
  });
  const send = (ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 1024 * 1024)
      ws.send(
        JSON.stringify({
          type: "snapshot",
          state: engine.snapshot(adminClients.has(ws)),
        }),
      );
  };
  wss.on("connection", send);
  // Throttle WebSocket broadcasts to reduce overhead (max ~15/second)
  let broadcastPending = false;
  let lastBroadcast = 0;
  const broadcastThrottleMs = 66;
  const scheduleBroadcast = () => {
    if (broadcastPending) return;
    const elapsed = Date.now() - lastBroadcast;
    if (elapsed >= broadcastThrottleMs) {
      lastBroadcast = Date.now();
      for (const client of wss.clients) send(client);
    } else {
      broadcastPending = true;
      setTimeout(() => {
        broadcastPending = false;
        lastBroadcast = Date.now();
        for (const client of wss.clients) send(client);
      }, broadcastThrottleMs - elapsed);
    }
  };
  engine.onChange = scheduleBroadcast;
  const heartbeat = setInterval(() => {
    engine.tick();
    scheduleBroadcast();
  }, 2000);
  let connector: LiveConnector = new MockConnector((e) => engine.ingest(e));
  let switching = false;
  app.get("/api/narrator", async (_req, res) =>
    res.json(await narrator.status()),
  );
  app.get("/api/narration/:id.wav", async (req, res) => {
    const id = req.params.id;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      res.status(404).json({ error: "Không tìm thấy lời tri ân." });
      return;
    }
    const announcement = engine.announcement(id);
    if (!announcement) {
      res.status(410).json({ error: "Lời tri ân đã hết hạn." });
      return;
    }
    if (!(await narrator.status()).available) {
      res.status(503).json({ error: "Giọng đọc chưa khả dụng." });
      return;
    }
    try {
      const audio = await narrator.audio(announcement);
      if (!engine.announcement(id)) {
        res.status(410).json({ error: "Lời tri ân đã hết hạn." });
        return;
      }
      res.type("audio/wav").send(audio);
    } catch {
      res.status(503).json({ error: "Không thể tạo lời đọc lúc này." });
    }
  });
  app.get("/api/health", (_req, res) => res.json({ ok: true, version: 1 }));
  app.get("/api/state", (_req, res) => res.json(engine.snapshot()));
  app.get("/api/admin", (_req, res) => res.json(engine.snapshot(true)));
  app.post("/api/events", (req, res) => {
    const event = liveEventSchema.parse(req.body);
    if (event.source !== "mock") {
      res.status(400).json({ error: "Chỉ nhận sự kiện mô phỏng tại đây." });
      return;
    }
    res.json(engine.ingest(event));
  });
  app.put("/api/settings", (req, res) => {
    engine.updateSettings(settingsSchema.parse(req.body));
    res.json(engine.snapshot(true));
  });
  // The sign key is write-only: it never appears in any response or snapshot.
  const tiktokUsername = () =>
    (
      store.getConfig("tiktok.username") ??
      process.env.TIKTOK_USERNAME ??
      ""
    ).replace(/^@/, "");
  const tiktokConfig = (): TikTokConfig => ({
    username: tiktokUsername(),
    hasSignKey: !!store.getConfig("tiktok.signApiKey"),
  });
  app.get("/api/tiktok", (_req, res) => res.json(tiktokConfig()));
  app.put("/api/tiktok", (req, res) => {
    const input = tiktokConfigInputSchema.parse(req.body);
    store.setConfig("tiktok.username", input.username);
    if (input.signApiKey !== undefined)
      store.setConfig("tiktok.signApiKey", input.signApiKey);
    res.json(tiktokConfig());
  });
  app.put("/api/mappings", (req, res) => {
    const mappings = z.array(mappingSchema).max(100).parse(req.body);
    if (new Set(mappings.map((m) => m.giftId)).size !== mappings.length) {
      res.status(400).json({ error: "Mã quà tặng bị trùng." });
      return;
    }
    engine.updateMappings(mappings);
    res.json(engine.snapshot(true));
  });
  app.post("/api/prayers/:id", (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { status } = z
      .object({ status: z.enum(["approved", "rejected"]) })
      .parse(req.body);
    if (!engine.moderate(id, status)) {
      res
        .status(404)
        .json({ error: "Lời nguyện đã xử lý hoặc không tồn tại." });
      return;
    }
    res.json({ ok: true });
  });
  app.post("/api/session/new", (_req, res) => {
    engine.newSession();
    res.json(engine.snapshot(true));
  });
  // Community goal endpoints
  app.post("/api/goal/start", (_req, res) => {
    const started = engine.startCommunityGoal();
    if (!started) {
      res.status(400).json({ error: "Đang có mục tiêu hoặc tính năng bị tắt." });
      return;
    }
    res.json(engine.snapshot(true));
  });
  app.post("/api/goal/stop", (_req, res) => {
    engine.stopCommunityGoal();
    res.json(engine.snapshot(true));
  });
  // Fortune list management
  app.put("/api/fortunes", (req, res) => {
    const input = z
      .object({
        fortunes: z.array(z.string().max(200)).max(100),
      })
      .parse(req.body);
    // Trim whitespace and filter empty entries
    const cleaned = input.fortunes
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
    if (cleaned.length === 0) {
      res.status(400).json({
        error: "Danh sách lá thăm không được rỗng. Vui lòng thêm ít nhất một câu.",
      });
      return;
    }
    engine.updateFortuneList(cleaned);
    res.json(engine.snapshot(true));
  });
  app.post("/api/replay", (req, res) => {
    const { limit } = z
      .object({ limit: z.number().int().min(1).max(40).default(20) })
      .parse(req.body);
    res.json({ replayed: engine.replay(limit) });
  });
  app.post("/api/connector", async (req, res, next) => {
    try {
      const { mode } = z
        .object({ mode: z.enum(["mock", "tiktok"]) })
        .parse(req.body);
      if (switching) {
        res.status(409).json({ error: "Đang chuyển kết nối. Vui lòng chờ." });
        return;
      }
      // Settings win; .env stays a fallback for existing setups.
      const username = tiktokUsername();
      const signApiKey =
        store.getConfig("tiktok.signApiKey") ||
        process.env.TIKTOK_SIGN_API_KEY ||
        undefined;
      if (mode === "tiktok" && !/^[\w.]{1,64}$/.test(username)) {
        res.status(400).json({
          error: "Nhập tên tài khoản TikTok trong Cài đặt trước khi kết nối.",
        });
        return;
      }
      switching = true;
      try {
        await connector.stop();
        if (mode === "mock") {
          connector = new MockConnector((e) => engine.ingest(e));
          engine.setConnector({
            mode,
            state: "connected",
            detail: "Mô phỏng cục bộ",
            attempt: 0,
          });
        } else {
          connector = new TikTokConnector(
            username,
            signApiKey,
            (event) => {
              const parsed = liveEventSchema.safeParse(event);
              if (parsed.success) engine.ingest(parsed.data);
            },
            (status) => engine.setConnector(status),
          );
          engine.setConnector({
            mode,
            state: "connecting",
            detail: "Đang kết nối TikTok…",
            attempt: 0,
          });
          void connector.start();
        }
        res.json(engine.snapshot(true));
      } finally {
        switching = false;
      }
    } catch (error) {
      next(error);
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Không tìm thấy API." }),
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const validation =
        error instanceof z.ZodError || error instanceof SyntaxError;
      res.status(validation ? 400 : 500).json({
        error: validation
          ? "Dữ liệu chưa hợp lệ. Kiểm tra giá trị và thử lại."
          : "Máy chủ chưa xử lý được. Kiểm tra dung lượng và quyền ghi cơ sở dữ liệu.",
      });
      if (!validation)
        console.error(
          "Temple request failed:",
          error instanceof Error ? error.name : "UnknownError",
        );
    },
  );
  return {
    app,
    server,
    engine,
    store,
    async close() {
      clearInterval(heartbeat);
      await narrator.close();
      await connector.stop();
      for (const client of wss.clients) client.terminate();
      wss.close();
      if (server.listening)
        await new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve())),
        );
      store.close();
    },
  };
}
