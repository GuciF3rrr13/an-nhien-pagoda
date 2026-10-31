import type { Announcement } from "../../../packages/shared/src/index.ts";

const MAX_QUEUE = 12;
const MAX_AGE_MS = 20_000;
const TIMEOUT_MS = 15_000;

/** Serial local WAV playback on the dedicated voice bus. */
export class Narrator {
  private queue: Announcement[] = [];
  private seen = new Set<string>();
  private sessionId = "";
  private serverOffset = 0;
  private running = false;
  private stopped = false;
  private controller?: AbortController;
  private source?: AudioBufferSourceNode;
  private task = 0;

  constructor(
    private context: AudioContext,
    private voice: GainNode,
    private setDucked: (ducked: boolean) => void,
  ) {}

  seed(sessionId: string, announcements: Announcement[], serverTime: number) {
    this.sessionId = sessionId;
    this.serverOffset = serverTime - Date.now();
    this.remember(announcements);
  }

  update(
    sessionId: string,
    announcements: Announcement[],
    serverTime: number,
    enabled: boolean,
  ) {
    this.serverOffset = serverTime - Date.now();
    if (sessionId !== this.sessionId) {
      this.sessionId = sessionId;
      this.clear();
      this.seen.clear();
      this.remember(announcements);
      return;
    }
    const incoming = announcements.filter((item) => !this.seen.has(item.id));
    this.remember(incoming);
    if (!enabled || this.stopped) return;
    const now = this.serverNow();
    for (const item of incoming) {
      const age = now - item.at;
      if (item.sessionId === sessionId && age >= 0 && age <= MAX_AGE_MS)
        this.queue.push(item);
    }
    if (this.queue.length > MAX_QUEUE)
      this.queue.splice(0, this.queue.length - MAX_QUEUE);
    void this.pump();
  }

  clear() {
    this.queue = [];
    this.task++;
    this.controller?.abort();
    this.controller = undefined;
    try {
      this.source?.stop();
    } catch {
      /* already stopped */
    }
    this.source = undefined;
    this.setDucked(false);
  }

  destroy() {
    this.stopped = true;
    this.clear();
  }

  private remember(items: Announcement[]) {
    for (const item of items) this.seen.add(item.id);
    if (this.seen.size > 512)
      this.seen = new Set(items.slice(-256).map((item) => item.id));
  }

  private serverNow() {
    return Date.now() + this.serverOffset;
  }

  private async pump() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      while (this.queue.length && !this.stopped) {
        const item = this.queue.shift()!;
        if (this.serverNow() - item.at > MAX_AGE_MS) continue;
        await this.play(item);
      }
    } finally {
      this.running = false;
      if (this.queue.length && !this.stopped) void this.pump();
    }
  }

  private async play(item: Announcement) {
    const task = ++this.task;
    const controller = (this.controller = new AbortController());
    const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(
        `/api/narration/${encodeURIComponent(item.id)}.wav`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error(`Narration HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (
        controller.signal.aborted ||
        task !== this.task ||
        this.serverNow() - item.at > MAX_AGE_MS
      )
        return;
      const buffer = await this.context.decodeAudioData(bytes);
      if (
        controller.signal.aborted ||
        task !== this.task ||
        this.serverNow() - item.at > MAX_AGE_MS
      )
        return;
      if (this.context.state !== "running") return;
      const source = this.context.createBufferSource();
      this.source = source;
      source.buffer = buffer;
      source.connect(this.voice);
      this.setDucked(true);
      await new Promise<void>((resolve, reject) => {
        source.onended = () => resolve();
        controller.signal.addEventListener(
          "abort",
          () => {
            try {
              source.stop();
            } catch {
              /* already stopped */
            }
            reject(
              new DOMException(
                "Narration timed out or was cancelled",
                "AbortError",
              ),
            );
          },
          { once: true },
        );
        source.start();
      });
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        console.warn("Local narration unavailable", error);
    } finally {
      window.clearTimeout(timeout);
      if (this.controller === controller) this.controller = undefined;
      if (this.source) {
        this.source.disconnect();
        this.source = undefined;
      }
      this.setDucked(false);
    }
  }
}
