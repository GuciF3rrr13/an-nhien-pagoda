import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createTempleApp } from "../apps/server/src/app.ts";

async function withApp(
  run: (
    call: (
      path: string,
      method?: string,
      body?: unknown,
    ) => Promise<{ status: number; text: string; json: any }>,
  ) => Promise<void>,
) {
  const temple = createTempleApp(":memory:");
  await new Promise<void>((resolve) =>
    temple.server.listen(0, "127.0.0.1", resolve),
  );
  const base = `http://127.0.0.1:${(temple.server.address() as AddressInfo).port}`;
  try {
    await run(async (path, method = "GET", body) => {
      const response = await fetch(base + path, {
        method,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      return { status: response.status, text, json: JSON.parse(text) };
    });
  } finally {
    await temple.close();
  }
}

test("TikTok username persists, the sign key is write-only and never leaks", async () => {
  const saved = { ...process.env };
  delete process.env.TIKTOK_USERNAME;
  delete process.env.TIKTOK_SIGN_API_KEY;
  try {
    await withApp(async (call) => {
      assert.deepEqual((await call("/api/tiktok")).json, {
        username: "",
        hasSignKey: false,
      });
      let r = await call("/api/tiktok", "PUT", {
        username: " @chua.an_nhien ",
        signApiKey: "secret-key-123",
      });
      assert.deepEqual(r.json, { username: "chua.an_nhien", hasSignKey: true });
      assert.ok(!r.text.includes("secret-key-123"));
      // Omitted key is kept; the username can change independently.
      r = await call("/api/tiktok", "PUT", { username: "khac" });
      assert.deepEqual(r.json, { username: "khac", hasSignKey: true });
      for (const path of ["/api/tiktok", "/api/state", "/api/admin"]) {
        const body = (await call(path)).text;
        assert.ok(!body.includes("secret-key-123"), path);
      }
      assert.ok(!(await call("/api/state")).text.includes("khac"));
      // null or empty clears the key.
      r = await call("/api/tiktok", "PUT", {
        username: "khac",
        signApiKey: null,
      });
      assert.equal(r.json.hasSignKey, false);
      await call("/api/tiktok", "PUT", {
        username: "khac",
        signApiKey: "again",
      });
      r = await call("/api/tiktok", "PUT", {
        username: "khac",
        signApiKey: "",
      });
      assert.equal(r.json.hasSignKey, false);
    });
  } finally {
    Object.assign(process.env, saved);
  }
});

test("TikTok settings reject invalid usernames and connecting needs a username", async () => {
  const saved = { ...process.env };
  delete process.env.TIKTOK_USERNAME;
  try {
    await withApp(async (call) => {
      assert.equal(
        (await call("/api/tiktok", "PUT", { username: "có dấu cách" })).status,
        400,
      );
      assert.equal(
        (await call("/api/tiktok", "PUT", { username: "x".repeat(65) })).status,
        400,
      );
      const noName = await call("/api/connector", "POST", { mode: "tiktok" });
      assert.equal(noName.status, 400);
      assert.match(noName.json.error, /Cài đặt/);
    });
  } finally {
    Object.assign(process.env, saved);
  }
});

test("TIKTOK_USERNAME in the environment stays a fallback; stored value wins", async () => {
  const saved = { ...process.env };
  process.env.TIKTOK_USERNAME = "@from_env";
  try {
    await withApp(async (call) => {
      assert.equal((await call("/api/tiktok")).json.username, "from_env");
      await call("/api/tiktok", "PUT", { username: "from_settings" });
      assert.equal((await call("/api/tiktok")).json.username, "from_settings");
    });
  } finally {
    process.env = saved;
  }
});
