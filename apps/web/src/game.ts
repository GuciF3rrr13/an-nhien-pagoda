import Phaser from "phaser";
import type { Ceremony, Visitor } from "../../../packages/shared/src/index.ts";
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
      } else {
        for (const c of state.ceremonies)
          if (!this.seen.has(c.id)) {
            this.seen.add(c.id);
            if (!capture && Math.abs(state.serverTime - c.at) < 2500) {
              if (c.action === "audience-milestone")
                this.celebrateAudience(c.count, c.intensity);
              this.burst(c.action, c.intensity, c.count);
            }
          }
      }
      if (this.seen.size > 256)
        this.seen = new Set(state.ceremonies.map((c) => c.id));
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
          action === "audience-milestone"
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
