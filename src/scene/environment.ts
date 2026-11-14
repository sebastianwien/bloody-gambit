import { VIEW_H, VIEW_W } from '../config.ts';
import { mulberry32 } from '../util/random.ts';
import { boardToScreen } from './iso.ts';
import { PAL } from './palette.ts';
import { ctx2d, makeCanvas } from './sprites.ts';
import type { Layer, Stage } from './stage.ts';

const rnd = mulberry32(4242);

/** Hört auf Umgebungsereignisse (für Donner, Krähenrufe, Fackelknistern). */
export interface EnvHooks {
  thunder?(strength: number, delay: number): void;
  crow?(): void;
  rat?(): void;
}

// ---------- Hintergrund ----------

export class BackgroundLayer implements Layer {
  img: HTMLImageElement | null = null;
  constructor(url: string) {
    const i = new Image();
    i.src = url;
    i.decode().then(
      () => (this.img = i),
      () => {},
    );
  }
  ready(): Promise<void> {
    return new Promise((res) => {
      const check = () => (this.img ? res() : setTimeout(check, 30));
      check();
    });
  }
  draw(g: CanvasRenderingContext2D) {
    if (this.img) g.drawImage(this.img, 0, 0);
    else {
      g.fillStyle = PAL.night1;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
}

// ---------- Wolken ----------

function cloudCanvas(w: number, h: number, seed: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  const r = mulberry32(seed);
  const blobs = 14;
  for (let i = 0; i < blobs; i++) {
    const cx = (i / blobs) * w * 0.9 + r() * w * 0.1;
    const cy = h * 0.55 + (r() - 0.5) * h * 0.3;
    const rad = 6 + r() * (h * 0.45);
    for (let y = -rad; y < rad; y += 2) {
      for (let x = -rad * 1.6; x < rad * 1.6; x += 2) {
        const d = (x * x) / (rad * rad * 2.56) + (y * y) / (rad * rad);
        if (d < 1 && r() > d * 0.6) {
          g.fillStyle = y < -rad * 0.3 ? PAL.night4 : y < rad * 0.2 ? PAL.night3 : PAL.night2;
          g.fillRect(Math.round(cx + x), Math.round(cy + y), 2, 2);
        }
      }
    }
  }
  return c;
}

export class CloudLayer implements Layer {
  private clouds: { img: HTMLCanvasElement; x: number; y: number; speed: number; alpha: number }[] = [];
  flash = 0;
  constructor() {
    for (let i = 0; i < 5; i++) {
      this.clouds.push({ img: cloudCanvas(220 + i * 30, 60, 10 + i), x: rnd() * VIEW_W, y: 8 + rnd() * 70, speed: 4 + rnd() * 6, alpha: 0.35 + rnd() * 0.25 });
    }
  }
  update(dt: number) {
    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x > VIEW_W + 20) c.x = -c.img.width - 20;
    }
  }
  draw(g: CanvasRenderingContext2D) {
    for (const c of this.clouds) {
      g.globalAlpha = c.alpha * (1 + this.flash);
      g.drawImage(c.img, Math.round(c.x), Math.round(c.y));
    }
    g.globalAlpha = 1;
  }
}

// ---------- Blitz ----------

export class LightningLayer implements Layer {
  private next = 12 + rnd() * 20;
  private t = -1;
  private bolt: { x: number; y: number }[] = [];
  hooks: EnvHooks = {};
  enabled = true;
  constructor(private clouds: CloudLayer) {}

  strike() {
    this.t = 0;
    const x0 = 120 + rnd() * 720;
    this.bolt = [{ x: x0, y: 0 }];
    let x = x0;
    for (let y = 8; y < 120; y += 6 + rnd() * 8) {
      x += (rnd() - 0.5) * 18;
      this.bolt.push({ x, y });
    }
    const strength = 0.6 + rnd() * 0.4;
    this.hooks.thunder?.(strength, 0.3 + rnd() * 1.2);
  }

  update(dt: number) {
    if (!this.enabled) return;
    this.next -= dt;
    if (this.next <= 0) {
      this.next = 15 + rnd() * 30;
      this.strike();
    }
    if (this.t >= 0) {
      this.t += dt;
      // Doppelblitz: hell, kurz dunkel, wieder hell
      const t = this.t;
      this.clouds.flash = t < 0.08 ? 1.5 : t < 0.14 ? 0.2 : t < 0.24 ? 1.1 : Math.max(0, 1 - (t - 0.24) * 3);
      if (t > 0.7) {
        this.t = -1;
        this.clouds.flash = 0;
      }
    }
  }

  /** Bildschirmebene: Aufhellung und Blitzlinie. */
  draw(g: CanvasRenderingContext2D) {
    const f = this.clouds.flash;
    if (f <= 0) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.min(0.35, f * 0.22);
    g.fillStyle = '#b8bcff';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    if (this.t < 0.26 && this.bolt.length) {
      g.globalAlpha = 1;
      g.fillStyle = '#f4f4ff';
      for (let i = 1; i < this.bolt.length; i++) {
        const a = this.bolt[i - 1];
        const b = this.bolt[i];
        const steps = Math.ceil(Math.abs(b.y - a.y));
        for (let s = 0; s <= steps; s++) {
          const k = s / steps;
          g.fillRect(Math.round(a.x + (b.x - a.x) * k), Math.round(a.y + (b.y - a.y) * k), 2, 1);
        }
      }
    }
    g.restore();
  }
}

// ---------- Fackeln ----------

function pillarCanvas(): HTMLCanvasElement {
  const w = 18;
  const h = 46;
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  // Steinsäule mit Fugen
  g.fillStyle = PAL.ink;
  g.fillRect(2, 8, 14, 38);
  g.fillStyle = PAL.stone3;
  g.fillRect(3, 9, 12, 36);
  g.fillStyle = PAL.stone4;
  g.fillRect(3, 9, 5, 36);
  g.fillStyle = PAL.stone2;
  g.fillRect(12, 9, 3, 36);
  g.fillStyle = PAL.stone1;
  for (let y = 15; y < 45; y += 7) g.fillRect(3, y, 12, 1);
  // Eiserne Schale
  g.fillStyle = PAL.ink;
  g.fillRect(0, 3, 18, 6);
  g.fillStyle = PAL.stone2;
  g.fillRect(1, 4, 16, 4);
  g.fillStyle = PAL.stone4;
  g.fillRect(1, 4, 16, 1);
  g.fillStyle = PAL.fire0;
  g.fillRect(3, 3, 12, 1);
  return c;
}

function flameFrames(n: number): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  const cols = [PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4];
  for (let f = 0; f < n; f++) {
    const w = 16;
    const h = 22;
    const c = makeCanvas(w, h);
    const g = ctx2d(c);
    const r = mulberry32(900 + f);
    for (let y = 0; y < h; y++) {
      const rel = y / h; // 0 oben, 1 unten
      const width = (Math.sin(rel * Math.PI * 0.9) * 0.9 + 0.1) * (w / 2) * (0.75 + rel * 0.25);
      const sway = Math.sin(f * 1.3 + rel * 5) * (1 - rel) * 2.5;
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x + 0.5 - w / 2 - sway);
        if (dx > width + (r() - 0.5) * 2) continue;
        if (rel < 0.18 && r() < 0.5) continue;
        const heat = (1 - dx / (width + 0.01)) * 0.6 + rel * 0.5 + (r() - 0.5) * 0.25;
        const idx = Math.max(0, Math.min(4, Math.floor(heat * 4.2)));
        g.fillStyle = cols[idx];
        g.fillRect(x, y, 1, 1);
      }
    }
    out.push(c);
  }
  return out;
}

function glowCanvas(radius: number, color: string): HTMLCanvasElement {
  const c = makeCanvas(radius * 2, radius * 2);
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, radius * 2, radius * 2);
  return c;
}

interface Torch {
  x: number;
  y: number;
  phase: number;
}

/** Feuerschalen an den Brettecken: Säule zwischen Figuren einsortiert, Flamme animiert, Lichtschein additiv. */
export class Torches {
  torches: Torch[];
  private pillar = pillarCanvas();
  private flames = flameFrames(8);
  private glow = glowCanvas(150, 'rgba(255,150,60,0.55)');
  private t = 0;
  embers: { x: number; y: number; vy: number; vx: number; life: number }[] = [];

  constructor() {
    // Vordere Schalen etwas nach hinten versetzt, damit sie nicht unter den Spielertafeln liegen
    const L = boardToScreen(-0.6, 1.5, false);
    const R = boardToScreen(8.6, 1.5, false);
    const FL = boardToScreen(-0.75, 8.7, false);
    const FR = boardToScreen(8.75, 8.7, false);
    this.torches = [L, R, FL, FR].map((p, i) => ({ x: Math.round(p.x), y: Math.round(p.y), phase: i * 1.7 }));
  }

  update(dt: number) {
    this.t += dt;
    for (const tc of this.torches) {
      if (rnd() < dt * 6) this.embers.push({ x: tc.x + (rnd() - 0.5) * 8, y: tc.y - 56, vy: -20 - rnd() * 25, vx: (rnd() - 0.5) * 10, life: 0.8 + rnd() * 0.8 });
    }
    for (const e of this.embers) {
      e.life -= dt;
      e.y += e.vy * dt;
      e.x += e.vx * dt + Math.sin(this.t * 3 + e.y) * 0.2;
    }
    this.embers = this.embers.filter((e) => e.life > 0);
  }

  /** Flackerfaktor 0..1 je Fackel. */
  flicker(i: number) {
    const p = this.torches[i].phase;
    return 0.85 + Math.sin(this.t * 9 + p) * 0.06 + Math.sin(this.t * 23 + p * 2) * 0.05 + Math.sin(this.t * 3.1 + p) * 0.04;
  }

  /** Säule mit Flamme an Fußpunkt (x, y). */
  drawTorch(g: CanvasRenderingContext2D, i: number) {
    const tc = this.torches[i];
    g.drawImage(this.pillar, tc.x - 9, tc.y - 46);
    const f = this.flames[Math.floor(this.t * 10 + tc.phase * 3) % this.flames.length];
    g.drawImage(f, tc.x - 8, tc.y - 66);
  }

  drawEmbers(g: CanvasRenderingContext2D) {
    for (const e of this.embers) {
      g.globalAlpha = Math.min(1, e.life);
      g.fillStyle = e.life > 0.5 ? PAL.fire3 : PAL.fire1;
      g.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
    }
    g.globalAlpha = 1;
  }

  /** Warmer Lichtschein über der Szene. */
  drawLight(g: CanvasRenderingContext2D, strength = 1) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    this.torches.forEach((tc, i) => {
      const k = this.flicker(i);
      const r = 150 * k;
      g.globalAlpha = 0.5 * k * strength;
      g.drawImage(this.glow, tc.x - r, tc.y - 56 - r, r * 2, r * 2);
    });
    g.restore();
  }
}

// ---------- Nebel ----------

function fogCanvas(w: number, h: number, seed: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  const r = mulberry32(seed);
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const n = Math.sin(x * 0.03 + seed) * 0.5 + Math.sin(x * 0.011 + y * 0.2 + seed * 2) * 0.5;
      const edge = Math.sin((y / h) * Math.PI);
      if (r() < (n * 0.5 + 0.5) * edge * 0.9) {
        g.fillStyle = r() < 0.5 ? '#6c6a8c' : '#55537a';
        g.fillRect(x, y, 2, 2);
      }
    }
  }
  return c;
}

export class FogLayer implements Layer {
  private bands = [
    { img: fogCanvas(640, 46, 1), x: 0, y: 470, speed: 6, alpha: 0.13 },
    { img: fogCanvas(700, 40, 2), x: -300, y: 330, speed: -4, alpha: 0.09 },
    { img: fogCanvas(600, 36, 3), x: 200, y: 200, speed: 3, alpha: 0.07 },
  ];
  update(dt: number) {
    for (const b of this.bands) {
      b.x += b.speed * dt;
      if (b.x > VIEW_W) b.x -= VIEW_W + b.img.width;
      if (b.x < -b.img.width) b.x += VIEW_W + b.img.width;
    }
  }
  draw(g: CanvasRenderingContext2D) {
    for (const b of this.bands) {
      g.globalAlpha = b.alpha;
      g.drawImage(b.img, Math.round(b.x), b.y);
      g.drawImage(b.img, Math.round(b.x - b.img.width - VIEW_W * 0.3), b.y + 8);
    }
    g.globalAlpha = 1;
  }
}

// ---------- Regen ----------

export class RainLayer implements Layer {
  private drops: { x: number; y: number; len: number; speed: number }[] = [];
  private splashes: { x: number; y: number; t: number }[] = [];
  intensity = 1;
  constructor() {
    for (let i = 0; i < 170; i++) this.drops.push(this.drop(true));
  }
  private drop(anywhere = false) {
    return { x: rnd() * (VIEW_W + 120) - 60, y: anywhere ? rnd() * VIEW_H : -10 - rnd() * 40, len: 5 + Math.floor(rnd() * 6), speed: 360 + rnd() * 160 };
  }
  update(dt: number) {
    for (const d of this.drops) {
      d.y += d.speed * dt;
      d.x -= d.speed * 0.18 * dt;
      // Tropfen landen irgendwo auf dem Boden (untere zwei Drittel)
      if (d.y > VIEW_H || (d.y > 170 && rnd() < dt * 1.6)) {
        if (d.y > 170 && d.y < VIEW_H) this.splashes.push({ x: d.x, y: d.y, t: 0 });
        Object.assign(d, this.drop());
      }
    }
    for (const s of this.splashes) s.t += dt;
    this.splashes = this.splashes.filter((s) => s.t < 0.16);
  }
  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = PAL.rain;
    const n = Math.floor(this.drops.length * this.intensity);
    g.globalAlpha = 0.45;
    for (let i = 0; i < n; i++) {
      const d = this.drops[i];
      const x = Math.round(d.x);
      const y = Math.round(d.y);
      for (let k = 0; k < d.len; k++) g.fillRect(x - Math.floor(k * 0.18), y - k, 1, 1);
    }
    g.globalAlpha = 0.6;
    for (const s of this.splashes) {
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      if (s.t < 0.08) {
        g.fillRect(x - 1, y, 1, 1);
        g.fillRect(x + 1, y, 1, 1);
      } else {
        g.fillRect(x - 2, y - 1, 1, 1);
        g.fillRect(x + 2, y - 1, 1, 1);
      }
    }
    g.globalAlpha = 1;
  }
}

// ---------- Kleintiere ----------

function crowFrames(): HTMLCanvasElement[] {
  const shapes = [
    ['..#...#..', '...#.#...', '....#....', '...###...'],
    ['.........', '#..###..#', '.##.#.##.', '...###...'],
  ];
  return shapes.map((rows) => {
    const c = makeCanvas(9, 4);
    const g = ctx2d(c);
    g.fillStyle = PAL.ink;
    rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && g.fillRect(x, y, 1, 1)));
    return c;
  });
}

function ratFrames(): HTMLCanvasElement[] {
  const shapes = [
    ['..####.', '#######', '.#...#.'],
    ['..####.', '#######', '..#.#..'],
  ];
  return shapes.map((rows) => {
    const c = makeCanvas(7, 3);
    const g = ctx2d(c);
    g.fillStyle = '#2a2026';
    rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && g.fillRect(x, y, 1, 1)));
    g.fillStyle = '#7a3a3a';
    g.fillRect(6, 0, 1, 1);
    return c;
  });
}

export class CrittersLayer implements Layer {
  private crowF = crowFrames();
  private ratF = ratFrames();
  private crows: { x: number; y: number; vx: number; vy: number; t: number; sitting: boolean }[] = [];
  private rats: { x: number; y: number; vx: number; t: number }[] = [];
  private nextCrow = 6 + rnd() * 10;
  private nextRat = 14 + rnd() * 20;
  hooks: EnvHooks = {};

  constructor() {
    // Zwei Krähen sitzen auf der Mauer
    this.crows.push({ x: 548, y: 54, vx: 0, vy: 0, t: 0, sitting: true }, { x: 742, y: 40, vx: 0, vy: 0, t: 0, sitting: true });
  }

  update(dt: number) {
    this.nextCrow -= dt;
    if (this.nextCrow <= 0) {
      this.nextCrow = 12 + rnd() * 20;
      const sitter = this.crows.find((c) => c.sitting);
      if (sitter && rnd() < 0.6) {
        sitter.sitting = false;
        sitter.vx = (rnd() < 0.5 ? -1 : 1) * (40 + rnd() * 30);
        sitter.vy = -18 - rnd() * 10;
        this.hooks.crow?.();
      } else {
        const fromLeft = rnd() < 0.5;
        this.crows.push({ x: fromLeft ? -10 : VIEW_W + 10, y: 20 + rnd() * 60, vx: (fromLeft ? 1 : -1) * (45 + rnd() * 25), vy: (rnd() - 0.5) * 8, t: 0, sitting: false });
        if (rnd() < 0.5) this.hooks.crow?.();
      }
    }
    for (const c of this.crows) {
      c.t += dt;
      if (c.sitting) continue;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy *= 0.99;
    }
    this.crows = this.crows.filter((c) => c.sitting || (c.x > -20 && c.x < VIEW_W + 20 && c.y > -20));
    this.nextRat -= dt;
    if (this.nextRat <= 0) {
      this.nextRat = 20 + rnd() * 30;
      const fromLeft = rnd() < 0.5;
      this.rats.push({ x: fromLeft ? -8 : VIEW_W + 8, y: 516 + rnd() * 18, vx: (fromLeft ? 1 : -1) * (70 + rnd() * 30), t: 0 });
      this.hooks.rat?.();
    }
    for (const r of this.rats) {
      r.t += dt;
      r.x += r.vx * dt * (Math.sin(r.t * 2) > 0.85 ? 0 : 1);
    }
    this.rats = this.rats.filter((r) => r.x > -20 && r.x < VIEW_W + 20);
  }

  draw(g: CanvasRenderingContext2D) {
    for (const c of this.crows) {
      const f = c.sitting ? this.crowF[0] : this.crowF[Math.floor(c.t * 8) % 2];
      g.save();
      g.translate(Math.round(c.x), Math.round(c.y));
      if (c.vx < 0) g.scale(-1, 1);
      g.drawImage(f, -4, -3);
      g.restore();
    }
    for (const r of this.rats) {
      const f = this.ratF[Math.floor(r.t * 12) % 2];
      g.save();
      g.translate(Math.round(r.x), Math.round(r.y));
      if (r.vx < 0) g.scale(-1, 1);
      g.drawImage(f, -3, -2);
      g.restore();
    }
  }
}

// ---------- Licht und Vignette ----------

/** Nachtstimmung: alles leicht bläulich abdunkeln, dann Fackellicht addieren. */
export class LightingLayer implements Layer {
  private vignette: HTMLCanvasElement;
  constructor(private torches: Torches) {
    const c = makeCanvas(VIEW_W, VIEW_H);
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(VIEW_W / 2, VIEW_H * 0.55, VIEW_H * 0.35, VIEW_W / 2, VIEW_H * 0.55, VIEW_W * 0.62);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(4,3,10,0.7)');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    this.vignette = c;
  }
  draw(g: CanvasRenderingContext2D, stage: Stage) {
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = '#a4a2c8';
    const tl = stage.viewToWorld(0, 0);
    g.fillRect(tl.x - 10, tl.y - 10, VIEW_W / stage.camera.zoom + 20, VIEW_H / stage.camera.zoom + 20);
    g.restore();
    this.torches.drawLight(g, 0.55);
    this.torches.drawEmbers(g);
  }
  drawVignette(g: CanvasRenderingContext2D) {
    g.drawImage(this.vignette, 0, 0);
  }
}

/** Baut alle Umgebungsebenen auf und hängt sie in die Bühne. */
export function setupEnvironment(stage: Stage, hooks: EnvHooks = {}) {
  const bg = new BackgroundLayer('/assets/background.png');
  const clouds = new CloudLayer();
  const lightning = new LightningLayer(clouds);
  lightning.hooks = hooks;
  const torches = new Torches();
  const fog = new FogLayer();
  const rain = new RainLayer();
  const critters = new CrittersLayer();
  critters.hooks = hooks;
  const lighting = new LightingLayer(torches);
  const torchLayer: Layer = {
    update: (dt) => torches.update(dt),
    draw: (g) => torches.torches.forEach((_, i) => torches.drawTorch(g, i)),
  };
  stage.backLayers = [bg, clouds, torchLayer];
  stage.frontLayers = [critters, fog, lighting];
  stage.screenLayers = [rain, lightning, { draw: (g) => lighting.drawVignette(g) }];
  return { bg, clouds, lightning, torches, fog, rain, critters, lighting };
}
