import { test as base, expect } from "@playwright/test";
import express from "express";
import { resolve } from "node:path";
import { createTempleApp } from "../../apps/server/src/app.ts";
export const fixedTime = Date.UTC(2026, 9, 31, 5, 0, 0);
export const test = base.extend<{ temple: ReturnType<typeof createTempleApp> }>(
  {
    temple: async ({}, use) => {
      const temple = createTempleApp(
        ":memory:",
        process.env.TEMPLE_BENCHMARK === "1" ? Date.now : () => fixedTime,
      );
      temple.app.use(express.static(resolve("dist/web")));
      temple.app.get("/{*path}", (_req, res) =>
        res.sendFile(resolve("dist/web/index.html")),
      );
      await new Promise<void>((resolve) =>
        temple.server.listen(0, "127.0.0.1", resolve),
      );
      try {
        await use(temple);
      } finally {
        await temple.close();
      }
    },
    baseURL: async ({ temple }, use) => {
      await use(
        `http://127.0.0.1:${(temple.server.address() as { port: number }).port}`,
      );
    },
  },
);
export { expect };
export function seed(temple: ReturnType<typeof createTempleApp>, count = 24) {
  const names = [
    "Minh An",
    "Ngọc Linh",
    "Bảo An",
    "Thanh Tâm",
    "Diệu Hương",
    "Hải Đăng",
  ];
  for (let i = 0; i < count; i++)
    temple.engine.ingest({
      id: `seed:${i}`,
      timestamp: fixedTime,
      type: "join",
      source: "mock",
      user: { id: `seed:${i}`, name: names[i % names.length] },
    });
}
