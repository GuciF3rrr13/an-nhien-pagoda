import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Announcement } from "../../../packages/shared/src/index.ts";

const execute = promisify(execFile);
export type SynthRunner = (
  text: string,
  signal: AbortSignal,
) => Promise<Buffer>;
async function nativeSynthesis(
  text: string,
  signal: AbortSignal,
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "temple-voice-"));
  try {
    const path = join(dir, "voice.wav");
    await execute(
      "/usr/bin/say",
      [
        "-v",
        "Linh",
        "-r",
        "165",
        "-o",
        path,
        "--data-format=LEI16@22050",
        text,
      ],
      { timeout: 15000, signal },
    );
    return await readFile(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
export class Narrator {
  private cache = new Map<string, Buffer>();
  private pending = new Map<string, Promise<Buffer>>();
  private tail: Promise<void> = Promise.resolve();
  private controller = new AbortController();
  private closed = false;
  private availability?: Promise<boolean>;
  constructor(
    private runner: SynthRunner = nativeSynthesis,
    private probe?: () => Promise<boolean>,
  ) {}
  async status() {
    this.availability ??= this.probe
      ? this.probe().catch(() => false)
      : (async () => {
          if (process.platform !== "darwin") return false;
          try {
            const { stdout } = await execute("/usr/bin/say", ["-v", "?"], {
              timeout: 5000,
            });
            return /^Linh\s/m.test(stdout);
          } catch {
            return false;
          }
        })();
    const available = !this.closed && (await this.availability);
    return {
      available,
      voice: "Linh" as const,
      detail: available
        ? "Giọng Linh sẵn sàng."
        : "Giọng Linh không khả dụng trên máy này.",
    };
  }
  async audio(announcement: Announcement): Promise<Buffer> {
    if (this.closed) throw new Error("unavailable");
    const cached = this.cache.get(announcement.id);
    if (cached) return cached;
    const existing = this.pending.get(announcement.id);
    if (existing) return existing;
    if (this.pending.size >= 12) throw new Error("queue-full");
    const job = this.tail.then(async () => {
      if (this.closed) throw new Error("unavailable");
      const result = await this.runner(
        announcement.text,
        this.controller.signal,
      );
      if (this.closed) throw new Error("unavailable");
      this.cache.set(announcement.id, result);
      if (this.cache.size > 32)
        this.cache.delete(this.cache.keys().next().value!);
      return result;
    });
    this.tail = job.then(
      () => {},
      () => {},
    );
    this.pending.set(announcement.id, job);
    try {
      return await job;
    } finally {
      this.pending.delete(announcement.id);
    }
  }
  async close() {
    this.closed = true;
    this.controller.abort();
    await this.tail;
    this.cache.clear();
  }
}
