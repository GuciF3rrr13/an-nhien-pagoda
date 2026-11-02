import Phaser from "phaser";
import type {
  Ceremony,
  FortuneSlip,
  Shoutout,
  Snapshot,
  Visitor,
} from "../../../packages/shared/src/index.ts";
import type { TempleClient } from "./api";
export interface GameStats {
  ready: boolean;
  fps: number;
  visibleVisitors: number;
  effects: number;
  peakEffects: number;
  frames: number;
  frameTimes: number[];
  renderer: string;
  gpu: string;
  updateMs: number;
}
declare global {
  interface Window {
    __TEMPLE_STATS__?: GameStats;
  }
}
interface VisitorArt {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
}
interface Particle {
  image: Phaser.GameObjects.Image;
  start: number;
  duration: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: string;
  size: number;
}
export function mountGame(parent: HTMLElement, client: TempleClient) {
  const capture = new URLSearchParams(location.search).has("capture");
  const stats: GameStats = {
    ready: false,
    fps: 0,
    visibleVisitors: 0,
    effects: 0,
    peakEffects: 0,
    frames: 0,
    frameTimes: [],
    renderer: "",
    gpu: "",
    updateMs: 0,
  };
  window.__TEMPLE_STATS__ = stats;
  class TempleScene extends Phaser.Scene {
    private visitors = new Map<string, VisitorArt>();
    private particles: Particle[] = [];
    private seen = new Set<string>();
    private cameraMode = "";
    private started = 0;
    private lastStats = 0;
    private lastRawFrame = 0;
    private unsubscribe?: () => void;
    private light!: Phaser.GameObjects.Image;
    private lanterns: Phaser.GameObjects.Image[] = [];
    private ready = false;
    private hasSnapshot = false;
    private sessionId = "";
    private communalBowUntil = 0;
    private audienceStartedAt = 0;
    private audienceEndsAt = 0;
    private audienceLift = 0;
    private reducedMotion = false;
    // New engagement visuals
    private shoutoutTexts: Phaser.GameObjects.Text[] = [];
    private shoutoutQueue: { text: Phaser.GameObjects.Text; expiresAt: number }[] = [];
    private fortuneTexts: Phaser.GameObjects.Text[] = [];
    private seenShoutouts = new Set<string>();
    private seenFortunes = new Set<string>();
    private goalBar?: Phaser.GameObjects.Graphics;
    private goalText?: Phaser.GameObjects.Text;
    private goalCompletedAt = 0;
    private mistOverlay?: Phaser.GameObjects.Rectangle;
    private duskOverlay?: Phaser.GameObjects.Rectangle;
    private nightOverlay?: Phaser.GameObjects.Rectangle;
    private lunarDecor?: Phaser.GameObjects.Text;
    private currentPeriod: Snapshot["sceneTime"]["period"] = "day";
    private bigGiftText?: Phaser.GameObjects.Text;
    private bigGiftUntil = 0;
    private seenBigGifts = new Set<string>();
    constructor() {
      super("temple");
    }
    preload() {
      this.load.image("hall", "/assets/temple-hall.webp");
      this.load.image("altar", "/assets/altar.webp");
      this.load.spritesheet("visitor", "/assets/visitors.png", {
        frameWidth: 512,
        frameHeight: 512,
      });
      this.load.on("loaderror", () => {
        parent.dataset.loadError =
          "Một hình ảnh chưa tải được. Vui lòng tải lại.";
      });
    }
    create() {
      this.started = this.time.now;
      this.reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      this.add.image(540, 960, "hall").setDisplaySize(1080, 1920).setDepth(0);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d")!;
      const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      gradient.addColorStop(0, "rgba(255,222,134,.55)");
      gradient.addColorStop(0.28, "rgba(255,179,66,.17)");
      gradient.addColorStop(1, "rgba(255,140,20,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);
      this.textures.addCanvas("glow", canvas);
      const spark = this.add.graphics();
      spark.fillStyle(0xffe9a9);
      spark.fillCircle(8, 8, 6);
      spark.generateTexture("spark", 16, 16);
      spark.destroy();
      const petal = this.add.graphics();
      petal.fillStyle(0xf6a2bd);
      petal.fillEllipse(12, 16, 16, 28);
      petal.fillStyle(0xffd4cb);
      petal.fillEllipse(10, 13, 5, 18);
      petal.generateTexture("petal", 24, 32);
      petal.destroy();
      this.light = this.add
        .image(540, 670, "glow")
        .setDisplaySize(850, 1050)
        .setDepth(1)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.add
        .image(540, 1050, "altar")
        .setOrigin(0.5, 1)
        .setDisplaySize(610, 762)
        .setDepth(2);
      for (const x of [160, 920])
        this.lanterns.push(
          this.add
            .image(x, 840, "glow")
            .setDisplaySize(240, 330)
            .setAlpha(0.35)
            .setDepth(3)
            .setBlendMode(Phaser.BlendModes.ADD),
        );
      for (let i = 0; i < 180; i++)
        this.particles.push({
          image: this.add.image(0, 0, "spark").setVisible(false).setDepth(2500),
          start: 0,
          duration: 0,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          kind: "spark",
          size: 1,
        });

      // Scene time overlays
      this.mistOverlay = this.add
        .rectangle(540, 960, 1080, 1920, 0xd4e5f7, 0)
        .setDepth(2800)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.duskOverlay = this.add
        .rectangle(540, 960, 1080, 1920, 0xffb347, 0)
        .setDepth(2800)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.nightOverlay = this.add
        .rectangle(540, 960, 1080, 1920, 0x1a1a2e, 0)
        .setDepth(2800)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);

      // Lunar special decoration
      this.lunarDecor = this.add
        .text(540, 180, "", {
          fontFamily: '"Be Vietnam Pro"',
          fontSize: "42px",
          color: "#ffd700",
          stroke: "#8b0000",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(2900)
        .setVisible(false);

      // Community goal bar - positioned below header to avoid overlap (y ~ 400)
      this.goalBar = this.add.graphics().setDepth(3000);
      this.goalText = this.add
        .text(540, 380, "", {
          fontFamily: '"Be Vietnam Pro"',
          fontSize: "32px",
          color: "#fff",
          backgroundColor: "#3a1f0dee",
          padding: { left: 16, right: 16, top: 10, bottom: 10 },
        })
        .setOrigin(0.5)
        .setDepth(3001)
        .setVisible(false);

      // Big gift text - neutral gratitude, no merit implication
      this.bigGiftText = this.add
        .text(540, 520, "", {
          fontFamily: '"Be Vietnam Pro"',
          fontSize: "52px",
          color: "#ffd700",
          stroke: "#5a2d0a",
          strokeThickness: 4,
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(3100)
        .setVisible(false);

      // Shoutout text pool - larger, more readable, positioned above hint area
      for (let i = 0; i < 4; i++) {
        this.shoutoutTexts.push(
          this.add
            .text(0, 0, "", {
              fontFamily: '"Be Vietnam Pro"',
              fontSize: "32px",
              color: "#fff8e8",
              backgroundColor: "#4a2510e8",
              padding: { left: 14, right: 14, top: 8, bottom: 8 },
            })
            .setOrigin(0.5)
            .setDepth(2950)
            .setVisible(false),
        );
      }

      // Fortune slip text pool
      for (let i = 0; i < 2; i++) {
        this.fortuneTexts.push(
          this.add
            .text(0, 0, "", {
              fontFamily: '"Be Vietnam Pro"',
              fontSize: "32px",
              color: "#8b0000",
              backgroundColor: "#fff8dcee",
              padding: { left: 16, right: 16, top: 10, bottom: 10 },
              wordWrap: { width: 600 },
              align: "center",
            })
            .setOrigin(0.5)
            .setDepth(3050)
            .setVisible(false),
        );
      }

      this.unsubscribe = client.subscribe(() => this.sync());
      this.events.once("shutdown", () => this.unsubscribe?.());
      this.ready = true;
      stats.ready = true;
      stats.renderer =
        this.game.renderer.type === Phaser.WEBGL ? "WebGL" : "Canvas";
      const gl = (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
      const debug = gl?.getExtension("WEBGL_debug_renderer_info");
      stats.gpu = debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : stats.renderer;
      parent.dataset.ready = "true";
      this.sync();
    }
    private sync() {
      if (!this.ready || !client.state) return;
      const state = client.state,
        ids = new Set(state.visitors.map((v) => v.id));
      for (const [id, art] of this.visitors)
        if (!ids.has(id)) {
          art.sprite.destroy();
          art.shadow.destroy();
          art.label.destroy();
          this.visitors.delete(id);
        }
      for (const v of state.visitors)
        if (!this.visitors.has(v.id))
          this.visitors.set(v.id, {
            sprite: this.add
              .image(0, 0, "visitor", (v.variant % 2) * 4 + 1)
              .setOrigin(0.5, 490 / 512),
            shadow: this.add.ellipse(0, 0, 70, 18, 0x160d08, 0.32),
            label: this.add
              .text(0, 0, v.name, {
                fontFamily: '"Be Vietnam Pro"',
                fontSize: "22px",
                color: "#fff0d1",
                backgroundColor: "#291b12e8",
                padding: { left: 8, right: 8, top: 4, bottom: 4 },
              })
              .setOrigin(0.5, 0),
          });
      if (!this.hasSnapshot || state.session.id !== this.sessionId) {
        this.hasSnapshot = true;
        this.sessionId = state.session.id;
        this.seen = new Set(state.ceremonies.map((c) => c.id));
        this.seenShoutouts = new Set(state.shoutouts?.map((s) => s.id) ?? []);
        this.seenFortunes = new Set(state.fortunes?.map((f) => f.id) ?? []);
      } else {
        for (const c of state.ceremonies)
          if (!this.seen.has(c.id)) {
            this.seen.add(c.id);
            if (!capture && Math.abs(state.serverTime - c.at) < 2500) {
              if (c.action === "audience-milestone")
                this.celebrateAudience(c.count, c.intensity);
              this.burst(c.action, c.intensity, c.count);
              // Big gift effect uses dedicated "big-gift" ceremony action
              if (c.action === "big-gift" && !this.seenBigGifts.has(c.id)) {
                this.seenBigGifts.add(c.id);
                this.showBigGift(c.name);
              }
            }
          }
        // Clean up big gift tracking
        if (this.seenBigGifts.size > 32)
          this.seenBigGifts = new Set([...this.seenBigGifts].slice(-16));
        // Handle new shoutouts
        if (state.settings.allEffectsEnabled && state.settings.shoutoutsEnabled) {
          for (const s of state.shoutouts ?? [])
            if (!this.seenShoutouts.has(s.id)) {
              this.seenShoutouts.add(s.id);
              if (!capture && Math.abs(state.serverTime - s.at) < 2500)
                this.showShoutout(s);
            }
        }
        // Handle new fortunes
        if (state.settings.allEffectsEnabled && state.settings.fortuneEnabled) {
          for (const f of state.fortunes ?? [])
            if (!this.seenFortunes.has(f.id)) {
              this.seenFortunes.add(f.id);
              if (!capture && Math.abs(state.serverTime - f.at) < 2500)
                this.showFortune(f);
            }
        }
      }
      if (this.seen.size > 256)
        this.seen = new Set(state.ceremonies.map((c) => c.id));
      if (this.seenShoutouts.size > 64)
        this.seenShoutouts = new Set(state.shoutouts?.map((s) => s.id) ?? []);
      if (this.seenFortunes.size > 32)
        this.seenFortunes = new Set(state.fortunes?.map((f) => f.id) ?? []);
    }

    private showShoutout(shoutout: Shoutout) {
      const text = this.shoutoutTexts.find((t) => !t.visible);
      if (!text) return;
      // Queue shoutouts vertically, stacking from bottom up at y=1480 and above
      // Clean up expired entries from queue
      const now = Date.now();
      this.shoutoutQueue = this.shoutoutQueue.filter((q) => q.expiresAt > now);
      // Find next available slot (each shoutout ~60px high with padding)
      const slotHeight = 65;
      const baseY = 1480;
      const occupiedSlots = this.shoutoutQueue.map((q) =>
        Math.round((baseY - q.text.y) / slotHeight)
      );
      let slot = 0;
      while (occupiedSlots.includes(slot) && slot < 4) slot++;
      const targetY = baseY - slot * slotHeight;
      text
        .setText(`✨ ${shoutout.userName} · ${shoutout.blessing}`)
        .setPosition(540, targetY + 40)
        .setAlpha(0)
        .setVisible(true);
      const expiresAt = now + 5000;
      this.shoutoutQueue.push({ text, expiresAt });
      this.tweens.add({
        targets: text,
        alpha: 1,
        y: targetY,
        duration: 350,
        ease: "Sine.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: text,
            alpha: 0,
            y: targetY - 25,
            duration: 600,
            delay: 3500,
            ease: "Sine.easeIn",
            onComplete: () => {
              text.setVisible(false);
              this.shoutoutQueue = this.shoutoutQueue.filter((q) => q.text !== text);
            },
          });
        },
      });
    }

    private showFortune(fortune: FortuneSlip) {
      const text = this.fortuneTexts.find((t) => !t.visible);
      if (!text) return;
      text
        .setText(`🎋 ${fortune.userName}\n"${fortune.text}"`)
        .setPosition(540, 800)
        .setAlpha(0)
        .setScale(0.8)
        .setVisible(true);
      this.tweens.add({
        targets: text,
        alpha: 1,
        scale: 1,
        duration: 500,
        ease: "Back.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: text,
            alpha: 0,
            scale: 0.9,
            duration: 800,
            delay: 6000,
            ease: "Sine.easeIn",
            onComplete: () => text.setVisible(false),
          });
        },
      });
    }

    private showBigGift(name: string) {
      if (!this.bigGiftText) return;
      // Neutral gratitude wording - no merit implication
      this.bigGiftText
        .setText(`✨ Cảm ơn ${name} ✨`)
        .setAlpha(0)
        .setScale(0.5)
        .setVisible(true);
      this.bigGiftUntil = Date.now() + 5000;
      this.tweens.add({
        targets: this.bigGiftText,
        alpha: 1,
        scale: 1,
        duration: 600,
        ease: "Back.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: this.bigGiftText,
            alpha: 0,
            scale: 1.1,
            duration: 1000,
            delay: 3500,
            ease: "Sine.easeIn",
            onComplete: () => this.bigGiftText?.setVisible(false),
          });
        },
      });
    }
    private burst(action: Ceremony["action"], intensity: number, count = 0) {
      const amount =
        action === "audience-milestone"
          ? Math.min(
              120,
              (count >= 1000 ? 90 : 24 + intensity * 16) *
                (this.reducedMotion ? 0.3 : 1),
            )
          : action === "milestone"
            ? 90
            : action === "big-gift"
              ? 60
              : action === "like"
                ? 8
                : action === "share"
                  ? 16
                  : 20 * intensity;
      let spawned = 0;
      for (const p of this.particles) {
        if (p.duration > 0) continue;
        const i = spawned++,
          angle = i * 2.399963 + this.time.now * 0.0001;
        p.kind =
          action === "lotus" ||
          action === "milestone" ||
          action === "audience-milestone" ||
          action === "big-gift"
            ? "petal"
            : action === "incense"
              ? "smoke"
              : "spark";
        p.start = this.time.now;
        p.duration = 3500 + (i % 5) * 350;
        p.x = 540 + Math.sin(angle) * 170;
        p.y = 1130 + (i % 4) * 45;
        p.vx = Math.sin(angle) * 65;
        p.vy = -(70 + (i % 7) * 20);
        p.size = p.kind === "petal" ? 18 : p.kind === "smoke" ? 100 : 8;
        p.image
          .setTexture(
            p.kind === "petal"
              ? "petal"
              : p.kind === "smoke"
                ? "glow"
                : "spark",
          )
          .setVisible(true)
          .setTint(p.kind === "smoke" ? 0xbcb4a4 : 0xffffff)
          .setAlpha(0.8);
        if (spawned >= amount) break;
      }
    }
    private celebrateAudience(count: number, intensity: number) {
      const now = this.time.now;
      this.communalBowUntil = Date.now() + 4200;
      if (this.reducedMotion) return;
      this.audienceStartedAt = now;
      this.audienceEndsAt = now + 6500;
      this.audienceLift = count >= 1000 ? 0.24 : intensity >= 2 ? 0.14 : 0.07;
    }
    private pose(v: Visitor, now: number) {
      if (now - v.joinedAt < 1400 || v.expiresAt - now < 1800) return 0;
      const age = now - Math.max(v.actionAt, v.joinedAt + 1400);
      if (v.action && age >= 650 && age < 3600) {
        if (v.action === "bow") return 2;
        if (v.action === "lotus") return 3;
        return 1;
      }
      if (now < this.communalBowUntil) return 2;
      return 1;
    }
    update(time: number, delta: number) {
      if (!this.ready) return;
      const updateStart = performance.now(),
        state = client.state,
        visualTime = capture ? 5000 : time,
        now = capture ? (state?.serverTime ?? Date.now()) + 6000 : Date.now();
      if (state) {
        let mode: string = state.settings.camera;
        if (state.settings.autoCamera && !capture)
          mode = Math.floor(now / 16000) % 2 ? "close" : "wide";
        if (mode !== this.cameraMode) {
          this.cameraMode = mode;
          if (capture) {
            this.cameras.main.setZoom(mode === "close" ? 1.42 : 1);
            this.cameras.main.centerOn(540, mode === "close" ? 790 : 960);
          } else {
            this.cameras.main.zoomTo(
              mode === "close" ? 1.42 : 1,
              1200,
              "Sine.easeInOut",
            );
            this.cameras.main.pan(
              540,
              mode === "close" ? 790 : 960,
              1200,
              "Sine.easeInOut",
            );
          }
        }
        const audienceProgress =
          this.audienceEndsAt > time
            ? Math.min(
                1,
                (time - this.audienceStartedAt) / 800,
                (this.audienceEndsAt - time) / 1800,
              )
            : 0;
        const glow = Math.max(0, audienceProgress) * this.audienceLift;
        const lightPulse = this.reducedMotion
          ? 0
          : Math.sin(visualTime * 0.0007) * 0.06;
        const lanternPulse = this.reducedMotion ? 0 : 0.035;
        this.light.setAlpha(
          0.68 +
            Math.min(0.18, state.milestones.length * 0.04) +
            lightPulse +
            glow,
        );
        this.lanterns.forEach((l, i) =>
          l.setAlpha(
            0.24 +
              Math.min(0.3, state.milestones.length * 0.06) +
              (this.reducedMotion
                ? 0
                : Math.sin(visualTime * 0.002 + i) * lanternPulse) +
              glow * 0.6,
          ),
        );
        for (const v of state.visitors) {
          const art = this.visitors.get(v.id);
          if (!art) continue;
          const row = Math.floor(v.slot / 5),
            col = v.slot % 5,
            spread = 108 + row * 17,
            x = 540 + (col - 2) * spread,
            y = 1190 + row * 84,
            scale = 0.8 + row * 0.085;
          const entry = Phaser.Math.Clamp((now - v.joinedAt) / 1400, 0, 1),
            exit = Phaser.Math.Clamp((v.expiresAt - now) / 1800, 0, 1),
            offset = (1 - entry) * 100 - (1 - exit) * 80;
          const pose = this.pose(v, now),
            breathe =
              pose === 1 ? Math.sin(visualTime * 0.0015 + v.slot) * 1.3 : 0;
          art.sprite
            .setFrame((v.variant % 2) * 4 + pose)
            .setPosition(x, y + offset + breathe)
            .setDisplaySize(154 * scale, 154 * scale)
            .setAlpha(Math.min(entry, exit))
            .setDepth(y);
          art.shadow
            .setPosition(x, y + 3)
            .setScale(scale)
            .setAlpha(0.32 * Math.min(entry, exit))
            .setDepth(y - 1);
          art.label
            .setPosition(x, y + 7)
            .setScale(Math.min(1, scale))
            .setVisible(
              entry === 1 &&
                exit === 1 &&
                !!v.action &&
                now - v.actionAt < 5000,
            )
            .setDepth(2600);
        }

        // Scene time overlays
        if (state.settings.allEffectsEnabled && state.settings.sceneByTimeEnabled) {
          const period = state.sceneTime?.period ?? "day";
          if (period !== this.currentPeriod) {
            this.currentPeriod = period;
            const targetMist = period === "dawn" ? 0.15 : 0;
            const targetDusk = period === "dusk" ? 0.12 : 0;
            const targetNight = period === "night" ? 0.25 : 0;
            this.tweens.add({
              targets: this.mistOverlay,
              alpha: targetMist,
              duration: 2000,
            });
            this.tweens.add({
              targets: this.duskOverlay,
              alpha: targetDusk,
              duration: 2000,
            });
            this.tweens.add({
              targets: this.nightOverlay,
              alpha: targetNight,
              duration: 2000,
            });
          }
          // Lunar special decoration
          if (state.sceneTime?.isLunarSpecial && this.lunarDecor) {
            const lunarText =
              state.sceneTime.lunarDay === 1
                ? "🌑 Mùng Một 🌑"
                : "🌕 Rằm 🌕";
            if (!this.lunarDecor.visible || this.lunarDecor.text !== lunarText) {
              this.lunarDecor.setText(lunarText).setVisible(true).setAlpha(0);
              this.tweens.add({
                targets: this.lunarDecor,
                alpha: 1,
                duration: 1000,
              });
            }
          } else if (this.lunarDecor?.visible) {
            this.tweens.add({
              targets: this.lunarDecor,
              alpha: 0,
              duration: 500,
              onComplete: () => this.lunarDecor?.setVisible(false),
            });
          }
        } else {
          this.mistOverlay?.setAlpha(0);
          this.duskOverlay?.setAlpha(0);
          this.nightOverlay?.setAlpha(0);
          this.lunarDecor?.setVisible(false);
        }

        // Community goal bar - positioned below header, auto-hide after completion
        if (
          state.settings.allEffectsEnabled &&
          state.settings.communityGoalEnabled &&
          state.communityGoal &&
          this.goalBar &&
          this.goalText
        ) {
          const goal = state.communityGoal;
          const progress = Math.min(1, goal.progress / goal.target);
          const remaining = Math.max(0, goal.endsAt - state.serverTime);
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          // Track when goal completed to auto-hide after 8 seconds
          if (goal.completed && this.goalCompletedAt === 0) {
            this.goalCompletedAt = state.serverTime;
          }
          // Auto-hide after 8 seconds of completion
          const hideGoal = goal.completed &&
            this.goalCompletedAt > 0 &&
            state.serverTime - this.goalCompletedAt > 8000;
          if (hideGoal) {
            this.goalBar.clear();
            this.goalText.setVisible(false);
          } else {
            // Larger, more readable bar at y=410 (below header and heading)
            this.goalBar.clear();
            this.goalBar.fillStyle(0x2a1508, 0.92);
            this.goalBar.fillRoundedRect(100, 410, 880, 36, 18);
            this.goalBar.fillStyle(goal.completed ? 0xffd700 : 0xd4763a, 1);
            this.goalBar.fillRoundedRect(
              104,
              414,
              Math.max(0, 872 * progress),
              28,
              14,
            );

            this.goalText
              .setPosition(540, 380)
              .setText(
                goal.completed
                  ? "🎉 Hoàn thành mục tiêu cộng đồng!"
                  : `🎯 ${goal.progress}/${goal.target} · Còn ${minutes}:${seconds.toString().padStart(2, "0")}`,
              )
              .setVisible(true);
          }
        } else {
          this.goalBar?.clear();
          this.goalText?.setVisible(false);
          // Reset completion timer when goal is cleared
          if (!state.communityGoal) {
            this.goalCompletedAt = 0;
          }
        }
      }
      let active = 0;
      for (const p of this.particles) {
        if (p.duration === 0) continue;
        const age = time - p.start,
          t = age / p.duration;
        if (t >= 1) {
          p.duration = 0;
          p.image.setVisible(false);
          continue;
        }
        active++;
        p.image
          .setPosition(
            p.x + (p.vx * age) / 1000 + Math.sin(age * 0.002) * 18,
            p.y + (p.vy * age) / 1000,
          )
          .setAlpha((1 - t) * (p.kind === "smoke" ? 0.22 : 0.85))
          .setDisplaySize(
            p.size * (1 + t * 0.8),
            p.size * (p.kind === "petal" ? 1.4 : 1) * (1 + t * 0.8),
          )
          .setRotation(p.kind === "petal" ? t * 3 : 0);
      }
      stats.frames++;
      stats.effects = active;
      stats.peakEffects = Math.max(stats.peakEffects, active);
      stats.visibleVisitors = this.visitors.size;
      if (this.lastRawFrame) {
        stats.frameTimes.push(updateStart - this.lastRawFrame);
        if (stats.frameTimes.length > 7200) stats.frameTimes.splice(0, 120);
      }
      this.lastRawFrame = updateStart;
      stats.updateMs = performance.now() - updateStart;
      if (time - this.lastStats > 1000) {
        this.lastStats = time;
        const recent = stats.frameTimes.slice(-60);
        stats.fps = recent.length
          ? 1000 / (recent.reduce((a, b) => a + b, 0) / recent.length)
          : 0;
      }
    }
  }
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1080,
    height: 1920,
    backgroundColor: "#20150b",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
    fps: { target: 60 },
    scene: [TempleScene],
    audio: { noAudio: true },
  });
}
