import { existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import type { Server } from "node:http";
import express from "express";
import { createTempleApp } from "./app.ts";
import { appDataDir, openBrowser } from "./runtime.ts";

// Entry point of the packaged desktop executable (built by scripts/build-desktop.ts).
// @ts-ignore generated at build time; absent during type-checking
const { embedded } = (await import("./embedded-assets.gen.ts")) as {
  embedded: Record<string, string>;
};

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const dataDir = appDataDir();
mkdirSync(dataDir, { recursive: true });
// Optional fallback credentials; TikTok details normally come from Settings.
if (existsSync(join(dataDir, ".env")))
  process.loadEnvFile(join(dataDir, ".env"));

function serveEmbedded(): express.RequestHandler {
  return async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    let key: string;
    try {
      key = decodeURIComponent(req.path);
    } catch {
      res.status(400).end();
      return;
    }
    if (key === "/ws") return next();
    let file = embedded[key];
    if (!file) {
      // Unknown paths with an extension are real 404s; the rest is the SPA.
      if (extname(key)) {
        res.status(404).type("text/plain").send("Not found");
        return;
      }
      file = embedded["/index.html"];
    }
    const blob = Bun.file(file);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", blob.type || "application/octet-stream");
    res.setHeader(
      "Cache-Control",
      /^\/assets\/index-[\w-]+\.(js|css)$/.test(key)
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
    let start = 0,
      end = blob.size - 1,
      status = 200;
    if (range && (range[1] || range[2])) {
      if (range[1]) {
        start = Number(range[1]);
        if (range[2]) end = Math.min(end, Number(range[2]));
      } else {
        start = Math.max(0, blob.size - Number(range[2]));
      }
      if (start > end || start >= blob.size) {
        res.status(416).setHeader("Content-Range", `bytes */${blob.size}`);
        res.end();
        return;
      }
      status = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${blob.size}`);
    }
    res.status(status).setHeader("Content-Length", end - start + 1);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(Buffer.from(await blob.slice(start, end + 1).arrayBuffer()));
  };
}

const temple = createTempleApp(
  process.env.TEMPLE_DB || join(dataDir, "temple.sqlite"),
);
temple.app.use(serveEmbedded());

const tryListen = (server: Server, port: number) =>
  new Promise<"ok" | "busy">((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) =>
      error.code === "EADDRINUSE" ? resolve("busy") : reject(error),
    );
    server.listen(port, "127.0.0.1", () => resolve("ok"));
  });
const isTemple = async (port: number) => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return ((await response.json()) as { ok?: boolean }).ok === true;
  } catch {
    return false;
  }
};

const portFlag = args.indexOf("--port");
const first = Number(
  (portFlag >= 0 ? args[portFlag + 1] : undefined) ?? process.env.PORT ?? 3000,
);
let port = first;
for (; port < first + 20; port++) {
  if ((await tryListen(temple.server, port)) === "ok") break;
  if (await isTemple(port)) {
    // Another copy is already running: reuse it instead of opening a second database.
    console.log(
      `Chùa An Nhiên LIVE đang chạy · http://127.0.0.1:${port}/admin`,
    );
    if (!flag("--no-open")) openBrowser(`http://127.0.0.1:${port}/admin`);
    await temple.close();
    process.exit(0);
  }
}
if (!temple.server.listening) {
  console.error(`Không tìm được cổng trống từ ${first} đến ${first + 19}.`);
  await temple.close();
  process.exit(1);
}
const url = `http://127.0.0.1:${port}/admin`;
console.log(`Chùa An Nhiên LIVE · ${url}`);
console.log(`Dữ liệu: ${dataDir}`);
console.log("Đóng cửa sổ này hoặc nhấn Ctrl+C để thoát.");
if (!flag("--no-open")) openBrowser(url);

let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    if (closing) return;
    closing = true;
    await temple.close();
    process.exit(0);
  });
