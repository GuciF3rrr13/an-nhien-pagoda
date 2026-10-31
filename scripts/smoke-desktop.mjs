// Smoke test for a built desktop executable: node scripts/smoke-desktop.mjs <binary>
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import WebSocket from "ws";

const binary = resolve(process.argv[2] ?? "");
const home = mkdtempSync(join(tmpdir(), "temple-smoke-"));
const port = await new Promise((done) => {
  const probe = createServer().listen(0, "127.0.0.1", () => {
    const { port } = probe.address();
    probe.close(() => done(port));
  });
});
const base = `http://127.0.0.1:${port}`;
let output = "";
const env = { ...process.env, TEMPLE_HOME: home };
delete env.TEMPLE_DB;
delete env.PORT;
const child = spawn(binary, ["--no-open", "--port", String(port)], {
  cwd: home,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (d) => (output += d));
child.stderr.on("data", (d) => (output += d));
const exited = new Promise((r) => child.once("exit", (code) => r(code)));
const stop = async () => {
  child.kill();
  await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
  try {
    rmSync(home, { recursive: true, force: true });
  } catch {
    // Windows may still hold the SQLite files for a moment; the temp dir is disposable.
  }
};
try {
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    try {
      ready = (await fetch(`${base}/api/health`)).ok;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(ready, "server did not become healthy");

  const admin = await fetch(`${base}/admin`);
  const html = await admin.text();
  assert.equal(admin.status, 200);
  assert.match(admin.headers.get("content-type"), /text\/html/);
  const script = /\/assets\/index-[\w-]+\.js/.exec(html)?.[0];
  assert.ok(script, "index.html references the bundle");
  const js = await fetch(base + script);
  assert.equal(js.status, 200);
  assert.ok((await js.arrayBuffer()).byteLength > 100_000);

  const music = await fetch(`${base}/assets/music.mp3`, {
    headers: { range: "bytes=0-99" },
  });
  assert.equal(music.status, 206);
  assert.equal((await music.arrayBuffer()).byteLength, 100);
  assert.equal((await fetch(`${base}/assets/altar.webp`)).status, 200);
  assert.equal((await fetch(`${base}/assets/missing.png`)).status, 404);
  assert.equal((await fetch(`${base}/api/missing`)).status, 404);

  const put = await fetch(`${base}/api/tiktok`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "@smoke_test",
      signApiKey: "smoke-secret",
    }),
  });
  const saved = await put.text();
  assert.deepEqual(JSON.parse(saved), {
    username: "smoke_test",
    hasSignKey: true,
  });
  assert.ok(!saved.includes("smoke-secret"));

  const snapshot = await new Promise((done, fail) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=admin`, {
      headers: { origin: base },
    });
    const timer = setTimeout(
      () => fail(new Error("no websocket snapshot")),
      5000,
    );
    ws.on("message", (m) => {
      clearTimeout(timer);
      ws.close();
      done(JSON.parse(m));
    });
    ws.on("error", fail);
  });
  assert.equal(snapshot.type, "snapshot");
  assert.ok(!JSON.stringify(snapshot).includes("smoke-secret"));
  assert.ok(
    readdirSync(home).includes("temple.sqlite"),
    "database in data dir",
  );
  console.log(`smoke ok: ${binary}`);
} catch (error) {
  console.error("smoke FAILED:", error);
  console.error("--- binary output ---\n" + output);
  process.exitCode = 1;
} finally {
  await stop();
}
