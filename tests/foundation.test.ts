import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { WebSocket } from "ws";
import { Engine } from "../apps/server/src/engine.ts";
import { Store } from "../apps/server/src/store.ts";
import { createTempleApp } from "../apps/server/src/app.ts";
import type { LiveEvent } from "../packages/shared/src/index.ts";
export const comment = (
  id: string,
  text = "!le",
  uid = "viewer",
): LiveEvent => ({
  id,
  type: "comment",
  source: "mock",
  timestamp: 100000,
  user: { id: uid, name: "An Nhiên" },
  text,
});

test("progress and duplicate IDs survive closing and reopening SQLite", () => {
  const dir = mkdtempSync(join(tmpdir(), "temple-test-")),
    db = join(dir, "test.sqlite");
  try {
    let store = new Store(db),
      engine = new Engine(store, () => 100000);
    assert.equal(engine.ingest(comment("one")).result, "bow");
    store.close();
    store = new Store(db);
    engine = new Engine(store, () => 101000);
    assert.equal(engine.snapshot().progress, 1);
    assert.equal(engine.ingest(comment("one")).result, "duplicate");
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("two WebSocket views receive the same authoritative event and reconnect snapshot", async () => {
  const temple = createTempleApp(":memory:");
  await new Promise<void>((resolve) =>
    temple.server.listen(0, "127.0.0.1", resolve),
  );
  const port = (temple.server.address() as { port: number }).port;
  const url = `ws://127.0.0.1:${port}/ws`;
  const first = new WebSocket(url),
    second = new WebSocket(url);
  try {
    await Promise.all([once(first, "message"), once(second, "message")]);
    const messages = Promise.all([
      once(first, "message"),
      once(second, "message"),
    ]);
    const response = await fetch(`http://127.0.0.1:${port}/api/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(comment("ws-one")),
    });
    assert.equal(response.status, 200);
    for (const [data] of await messages)
      assert.equal(JSON.parse(data.toString()).state.progress, 1);
    const reconnect = new WebSocket(url);
    const [data] = await once(reconnect, "message");
    assert.equal(JSON.parse(data.toString()).state.progress, 1);
    reconnect.close();
  } finally {
    first.close();
    second.close();
    await temple.close();
  }
});
