import type { Snapshot } from "../../../packages/shared/src/index.ts";
import { Narrator } from "./narrator";

/** Music, ceremony, and narration use separate gain nodes under one master. */
export class Soundscape {
  private context?: AudioContext;
  private music?: HTMLAudioElement;
  private master?: GainNode;
  private ambient?: GainNode;
  private effects?: GainNode;
  private voice?: GainNode;
  private narrator?: Narrator;
  private ambientVolume = 0;
  private ambientDucked = false;
  private narratorEnabled = true;
  private seenCeremonies = new Set<string>();
  private seenAnnouncements = new Set<string>();
  private bootstrapped = false;
  private sessionId?: string;
  private lastState?: Snapshot;
  private voices = 0;

  async enable() {
    this.ensureContext();
    await Promise.all([this.context!.resume(), this.music!.play()]);
    this.ensureNarrator(this.lastState);
  }

  get active() {
    return this.context?.state === "running" && !this.music?.paused;
  }

  update(state: Snapshot) {
    const previousState = this.lastState;
    this.lastState = state;
    if (!this.bootstrapped) {
      this.bootstrapped = true;
      this.sessionId = state.session.id;
      this.seenCeremonies = new Set(state.ceremonies.map((item) => item.id));
      this.seenAnnouncements = new Set(
        state.announcements.map((item) => item.id),
      );
    } else if (state.session.id !== this.sessionId) {
      this.sessionId = state.session.id;
      this.narrator?.clear();
      this.narrator?.seed(
        state.session.id,
        state.announcements,
        state.serverTime,
      );
      this.seenAnnouncements = new Set(
        state.announcements.map((item) => item.id),
      );
      this.seenCeremonies = new Set(state.ceremonies.map((item) => item.id));
    }
    const newCeremonies = state.ceremonies.filter(
      (item) => !this.seenCeremonies.has(item.id),
    );
    for (const item of newCeremonies) this.seenCeremonies.add(item.id);
    const newAnnouncements = state.announcements.filter(
      (item) => !this.seenAnnouncements.has(item.id),
    );
    for (const item of newAnnouncements) this.seenAnnouncements.add(item.id);
    if (this.seenCeremonies.size > 512)
      this.seenCeremonies = new Set(state.ceremonies.map((item) => item.id));
    if (this.seenAnnouncements.size > 512)
      this.seenAnnouncements = new Set(
        state.announcements.slice(-256).map((item) => item.id),
      );

    this.narratorEnabled = state.settings.narratorEnabled;
    if (!this.narratorEnabled) this.narrator?.clear();
    if (this.narratorEnabled && this.active && !this.narrator)
      this.ensureNarrator(previousState ?? state);
    this.narrator?.setBrowserTTSEnabled(state.settings.browserTTSEnabled ?? true);
    if (this.narratorEnabled && this.active && newAnnouncements.length)
      this.narrator?.update(
        state.session.id,
        newAnnouncements,
        state.serverTime,
        true,
      );

    if (!this.context || !this.ambient || !this.effects) return;
    const now = this.context.currentTime;
    this.ambientVolume = state.settings.ambientVolume;
    this.applyAmbient(0.3);
    this.effects.gain.setTargetAtTime(
      state.settings.ceremonyVolume ** 2,
      now,
      0.1,
    );
    if (this.voice)
      this.voice.gain.setTargetAtTime(state.settings.narratorVolume, now, 0.1);
    for (const ceremony of newCeremonies)
      if (
        this.active &&
        Math.abs(state.serverTime - ceremony.at) < 2500 &&
        ceremony.action !== "like"
      )
        this.chime(
          ceremony.action === "milestone"
            ? 261.63
            : ceremony.action === "audience-milestone"
              ? 392
              : ceremony.action === "share"
                ? 659.25
                : 523.25,
        );
  }

  async destroy() {
    this.narrator?.destroy();
    this.narrator = undefined;
    this.music?.pause();
    if (this.music) {
      this.music.removeAttribute("src");
      this.music.load();
    }
    await this.context?.close();
    this.context = undefined;
  }

  private ensureContext() {
    if (this.context) return;
    const context = (this.context = new AudioContext());
    this.master = context.createGain();
    this.master.gain.value = 0.4;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 12;
    this.master.connect(limiter);
    limiter.connect(context.destination);
    this.ambient = context.createGain();
    this.effects = context.createGain();
    this.voice = context.createGain();
    this.ambientVolume = this.lastState?.settings.ambientVolume ?? 0;
    this.ambient.gain.value = 0;
    this.effects.gain.value = 0;
    this.voice.gain.value = this.lastState?.settings.narratorVolume ?? 0.85;
    this.ambient.connect(this.master);
    this.effects.connect(this.master);
    this.voice.connect(this.master);
    this.music = new Audio("/assets/music.mp3");
    this.music.loop = true;
    context.createMediaElementSource(this.music).connect(this.ambient);
    this.applyAmbient(0.01);
  }

  private ensureNarrator(seedState?: Snapshot) {
    if (!this.context || !this.voice || !seedState || this.narrator) return;
    this.narrator = new Narrator(this.context, this.voice, (ducked) =>
      this.duck(ducked),
    );
    this.narrator.seed(
      seedState.session.id,
      seedState.announcements,
      seedState.serverTime,
    );
  }

  private duck(ducked: boolean) {
    this.ambientDucked = ducked;
    this.applyAmbient(0.2);
  }

  private applyAmbient(timeConstant: number) {
    if (!this.context || !this.ambient) return;
    this.ambient.gain.setTargetAtTime(
      this.ambientVolume * (this.ambientDucked ? 0.25 : 1),
      this.context.currentTime,
      timeConstant,
    );
  }

  private chime(frequency: number) {
    if (!this.context || !this.effects || this.voices >= 8) return;
    const context = this.context;
    this.voices++;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 3);
    oscillator.connect(gain);
    gain.connect(this.effects);
    oscillator.start();
    oscillator.stop(context.currentTime + 3.1);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.voices--;
    };
  }
}
