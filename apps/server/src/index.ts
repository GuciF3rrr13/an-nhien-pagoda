import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { createTempleApp } from "./app.ts";
if (existsSync(".env")) process.loadEnvFile(".env");
const production = process.argv.includes("--production");
const temple = createTempleApp();
let vite:
  Awaited<ReturnType<(typeof import("vite"))["createServer"]>> | undefined;
if (production) {
  if (!existsSync("dist/web/index.html"))
    throw new Error("Run npm run build before npm start.");
  temple.app.use(express.static(resolve("dist/web")));
  temple.app.get("/{*path}", (_req, res) =>
    res.sendFile(resolve("dist/web/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  vite = await createServer({
    configFile: resolve("apps/web/vite.config.ts"),
    server: { middlewareMode: true, hmr: { server: temple.server } },
    appType: "spa",
  });
  temple.app.use(vite.middlewares);
}
const port = Number(process.env.PORT ?? 3000);
temple.server.listen(port, "127.0.0.1", () =>
  console.log(`Chùa An Nhiên LIVE · http://127.0.0.1:${port}/admin`),
);
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    if (closing) return;
    closing = true;
    await vite?.close();
    await temple.close();
    process.exit(0);
  });
