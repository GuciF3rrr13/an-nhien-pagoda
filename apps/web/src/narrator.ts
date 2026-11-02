import type { Announcement, Settings } from "../../../packages/shared/src/index.ts";

const MAX_QUEUE = 12;
const MAX_AGE_MS = 20_000;
const TIMEOUT_MS = 15_000;

/** Serial local WAV playback on the dedicated voice bus with browser TTS fallback. */
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
  private browserTTSEnabled = true;
  private serverAvailable: boolean | null = null;
  private browserVoice: SpeechSynthesisVoice | null = null;

  constructor(
    private context: AudioContext,
    private voice: GainNode,
    private setDucked: (ducked: boolean) => void,
  ) {
    this.detectBrowserVoice();
  }

  private detectBrowserVoice() {
    if (!window.speechSynthesis) return;
    const findVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // Prefer Vietnamese voices
      this.browserVoice =
        voices.find((v) => v.lang.startsWith("vi")) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0] ||
        null;
    };
    findVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = findVoice;
    }
  }

  setBrowserTTSEnabled(enabled: boolean) {
    this.browserTTSEnabled = enabled;
  }

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
      // Try server-side synthesis first
      if (this.serverAvailable !== false) {
        try {
          const response = await fetch(
            `/api/narration/${encodeURIComponent(item.id)}.wav`,
            { signal: controller.signal },
          );
          if (response.ok) {
            this.serverAvailable = true;
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
            return;
          } else if (response.status === 503) {
            this.serverAvailable = false;
          }
        } catch (e) {
          if ((e as Error).name === "AbortError") throw e;
          this.serverAvailable = false;
        }
      }

      // Fallback to browser TTS if enabled and available
      if (
        this.browserTTSEnabled &&
        this.browserVoice &&
        window.speechSynthesis &&
        !controller.signal.aborted
      ) {
        this.setDucked(true);
        await this.playBrowserTTS(item.text, controller.signal);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        console.warn("Narration unavailable", error);
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

  private playBrowserTTS(text: string, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis || !this.browserVoice) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = this.browserVoice;
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = this.voice.gain.value;
      
      const cleanup = () => {
        window.speechSynthesis.cancel();
      };
      
      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        if (e.error === "canceled" || e.error === "interrupted") {
          reject(new DOMException("Speech cancelled", "AbortError"));
        } else {
          resolve(); // Don't fail on other errors
        }
      };
      
      signal.addEventListener("abort", cleanup, { once: true });
      window.speechSynthesis.speak(utterance);
    });
  }
}
