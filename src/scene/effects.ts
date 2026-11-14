import { mulberry32 } from '../util/random.ts';
import { boardToScreen, screenToBoard } from './iso.ts';
import { PAL } from './palette.ts';
import { ctx2d, makeCanvas } from './sprites.ts';
import type { Layer, Stage } from './stage.ts';

/** Ein Partikel in Weltkoordinaten (x, y = Bodenpunkt, z = Höhe). */
interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  color: string;
  size: number;
  kind: 'blood' | 'chunk' | 'spark' | 'ash' | 'dust' | 'smoke' | 'ember';
  /** Brocken bleiben kurz liegen, bevor sie verblassen. */
  rest?: number;
}

/** Bleibende Flecken auf dem Brett, gespeichert in Brettkoordinaten (überstehen Drehen). */
interface Decal {
  bx: number;
  by: number;
  img: HTMLCanvasElement;
  alpha: number;
}

/** Freie Bildteile (abgeschlagener Kopf, Hälften, Pfeile), mit Figuren einsortiert. */
export interface Prop {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  vrot: number;
  img: CanvasImageSource;
  w: number;
  h: number;
  /** Drehpunkt im Bild. */
  px: number;
  py: number;
  alpha: number;
  life: number;
  gravity: boolean;
  /** Blutspur beim Fliegen. */
  bleed: number;
  bounce: number;
  /** Zeichnen ohne Physik (z. B. fest steckende Pfeile). */
  still?: boolean;
}

const rnd = mulberry32(99);

function splatImage(size: number, color: string, drops: number): HTMLCanvasElement {
  const c = makeCanvas(size * 2 + 6, size + 4);
  const g = ctx2d(c);
  const cx = c.width / 2;
  const cy = c.height / 2;
  g.fillStyle = color;
  // Fleck flach (Perspektive), aus Kreisen zusammengesetzt, pixelgenau gerundet
  for (let i = 0; i < drops; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * size * 0.9;
    const s = 1 + Math.floor(rnd() * (size / 2.5));
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r * 0.45);
    g.fillRect(x - s, y - Math.ceil(s / 2), s * 2, Math.max(1, s));
  }
  // dunkler Rand unten für Tiefe
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = PAL.blood0;
  g.globalAlpha = 0.4;
  g.fillRect(0, cy + 1, c.width, c.height);
  return c;
}

export class Effects implements Layer {
  particles: Particle[] = [];
  decals: Decal[] = [];
  props: Prop[] = [];
  flash = 0;
  flashColor = '#fff6e0';
  /** Blut an oder aus (Einstellung). Aus: Funken und Staub statt Blut, keine Flecken. */
  gore = true;
  private splats: HTMLCanvasElement[] = [];
  private stage: Stage | null = null;

  constructor() {
    for (let i = 0; i < 10; i++) this.splats.push(splatImage(3 + i, i % 3 ? PAL.blood1 : PAL.blood2, 6 + i * 2));
  }

  reset() {
    this.particles = [];
    this.decals = [];
    this.props = [];
    this.flash = 0;
  }

  /** Blutfontäne/-spritzer an einem Punkt (Welt) in Höhe z. */
  blood(x: number, y: number, z: number, n: number, dirX = 0, spread = 1.4, up = 1) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const sp = (20 + rnd() * 70) * spread;
      if (this.gore) {
        this.particles.push({
          x, y, z,
          vx: Math.cos(a) * sp * 0.8 + dirX * 60,
          vy: Math.sin(a) * sp * 0.35,
          vz: (40 + rnd() * 120) * up,
          life: 2,
          color: rnd() < 0.5 ? PAL.blood2 : rnd() < 0.5 ? PAL.blood3 : PAL.blood1,
          size: rnd() < 0.2 ? 2 : 1,
          kind: 'blood',
        });
      } else {
        this.particles.push({
          x, y, z,
          vx: Math.cos(a) * sp * 0.6 + dirX * 40,
          vy: Math.sin(a) * sp * 0.3,
          vz: 30 + rnd() * 80,
          life: 0.5 + rnd() * 0.3,
          color: rnd() < 0.5 ? PAL.fire3 : PAL.stone6,
          size: 1,
          kind: 'spark',
        });
      }
    }
  }

  /** Blutlache auf dem Boden (Weltpunkt). */
  pool(x: number, y: number, size = 6) {
    if (!this.gore || !this.stage) return;
    const b = screenToBoard(x, y, this.stage.flipped);
    const img = this.splats[Math.min(this.splats.length - 1, Math.max(0, size))];
    this.decals.push({ bx: b.x, by: b.y, img, alpha: 0.95 });
    if (this.decals.length > 260) this.decals.shift();
  }

  sparks(x: number, y: number, z: number, n: number, color: string = PAL.fire3) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const sp = 40 + rnd() * 90;
      this.particles.push({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.4, vz: 20 + rnd() * 100, life: 0.3 + rnd() * 0.4, color, size: 1, kind: 'spark' });
    }
  }

  dust(x: number, y: number, n: number, color: string = PAL.stone4) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const sp = 10 + rnd() * 40;
      this.particles.push({ x, y, z: 1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.4, vz: 5 + rnd() * 20, life: 0.6 + rnd() * 0.5, color, size: 2, kind: 'dust' });
    }
  }

  smoke(x: number, y: number, z: number, n: number) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ x: x + (rnd() - 0.5) * 12, y, z: z + rnd() * 10, vx: (rnd() - 0.5) * 12, vy: 0, vz: 15 + rnd() * 20, life: 1 + rnd(), color: rnd() < 0.5 ? PAL.stone2 : PAL.stone3, size: 2, kind: 'smoke' });
    }
  }

  embers(x: number, y: number, z: number, n: number) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ x: x + (rnd() - 0.5) * 16, y, z: z + rnd() * 30, vx: (rnd() - 0.5) * 30, vy: 0, vz: 20 + rnd() * 40, life: 0.6 + rnd() * 0.8, color: rnd() < 0.5 ? PAL.fire2 : PAL.fire3, size: 1, kind: 'ember' });
    }
  }

  /** Zerlegt ein Bild in Pixelbrocken, die auseinanderfliegen. */
  shatter(img: CanvasImageSource, w: number, h: number, x0: number, y0: number, footY: number, power = 1, chunk = 3, kindColor?: (r: number, g: number, b: number) => string) {
    const c = makeCanvas(w, h);
    const g = ctx2d(c);
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    const cx = x0 + w / 2;
    for (let y = 0; y < h; y += chunk) {
      for (let x = 0; x < w; x += chunk) {
        const i = ((y + 1) * w + x + 1) * 4;
        if (i >= d.length || d[i + 3] < 128) continue;
        const color = kindColor ? kindColor(d[i], d[i + 1], d[i + 2]) : `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`;
        const wx = x0 + x;
        const z = footY - (y0 + y);
        const dx = wx - cx;
        this.particles.push({
          x: wx,
          y: footY + (rnd() - 0.5) * 6,
          z,
          vx: dx * 4 * power + (rnd() - 0.5) * 50 * power,
          vy: (rnd() - 0.5) * 40 * power,
          vz: (30 + rnd() * 120) * power,
          life: 2.5,
          color,
          size: chunk - 1,
          kind: 'chunk',
        });
      }
    }
  }

  addProp(p: Partial<Prop> & Pick<Prop, 'img' | 'w' | 'h' | 'x' | 'y'>): Prop {
    const prop: Prop = { z: 0, vx: 0, vy: 0, vz: 0, rot: 0, vrot: 0, px: p.w / 2, py: p.h, alpha: 1, life: 99, gravity: true, bleed: 0, bounce: 0.3, ...p };
    this.props.push(prop);
    return prop;
  }

  update(dt: number, stage: Stage) {
    this.stage = stage;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4);
    const G = 380;
    const keep: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.kind === 'smoke' || p.kind === 'ember' || p.kind === 'ash') {
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        p.vz *= 0.98;
        if (p.life > 0) keep.push(p);
        continue;
      }
      if (p.rest !== undefined) {
        p.rest -= dt;
        if (p.rest > 0) keep.push(p);
        continue;
      }
      p.vz -= G * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.z <= 0) {
        p.z = 0;
        if (p.kind === 'blood') {
          if (rnd() < 0.35) this.pool(p.x, p.y, Math.floor(rnd() * 3));
          continue;
        }
        if (p.kind === 'chunk') {
          if (Math.abs(p.vz) > 60) {
            p.vz = -p.vz * 0.3;
            p.vx *= 0.5;
            p.vy *= 0.5;
          } else {
            p.rest = 1 + rnd() * 1.5;
          }
        } else if (p.kind === 'dust' || p.kind === 'spark') {
          p.vx *= 0.8;
          p.vy *= 0.8;
          p.vz = 0;
        }
      }
      if (p.life > 0) keep.push(p);
    }
    this.particles = keep;

    for (const pr of this.props) {
      pr.life -= dt;
      if (pr.life < 0.5) pr.alpha = Math.max(0, pr.life / 0.5);
      if (pr.still) continue;
      if (pr.gravity) pr.vz -= G * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;
      pr.rot += pr.vrot * dt;
      if (pr.bleed > 0 && rnd() < pr.bleed * dt * 20) this.blood(pr.x, pr.y, pr.z + 2, 1, 0, 0.3, 0.3);
      if (pr.z <= 0 && pr.gravity) {
        pr.z = 0;
        if (Math.abs(pr.vz) > 50) {
          pr.vz = -pr.vz * pr.bounce;
          pr.vx *= 0.55;
          pr.vy *= 0.55;
          pr.vrot *= 0.5;
          if (pr.bleed) this.pool(pr.x, pr.y, 3);
        } else {
          pr.vz = 0;
          pr.vx *= 0.8;
          pr.vy *= 0.8;
          pr.vrot *= 0.6;
        }
      }
    }
    this.props = this.props.filter((p) => p.life > 0);
  }

  /** Bodenschicht: Flecken. */
  drawFloor(g: CanvasRenderingContext2D, stage: Stage) {
    for (const d of this.decals) {
      const p = boardToScreen(d.bx, d.by, stage.flipped);
      g.globalAlpha = d.alpha;
      g.drawImage(d.img, Math.round(p.x - d.img.width / 2), Math.round(p.y - d.img.height / 2));
    }
    g.globalAlpha = 1;
  }

  drawProp(g: CanvasRenderingContext2D, p: Prop) {
    g.save();
    g.globalAlpha = p.alpha;
    g.translate(Math.round(p.x), Math.round(p.y - p.z));
    if (p.rot) g.rotate(p.rot);
    g.drawImage(p.img, -p.px, -p.py);
    g.restore();
  }

  /** Vordergrund: Partikel über allem in der Welt. */
  draw(g: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      let a = 1;
      if (p.kind === 'smoke') a = Math.min(0.6, p.life * 0.5);
      else if (p.kind === 'dust' || p.kind === 'spark' || p.kind === 'ember') a = Math.min(1, p.life * 2);
      else if (p.rest !== undefined) a = Math.min(1, p.rest);
      g.globalAlpha = a;
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y - p.z), p.size, p.size);
    }
    g.globalAlpha = 1;
  }

  /** Bildschirm: Trefferblitz. */
  drawScreen(g: CanvasRenderingContext2D, w: number, h: number) {
    if (this.flash <= 0) return;
    g.globalAlpha = this.flash * 0.55;
    g.fillStyle = this.flashColor;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
  }
}

/** Schneidet einen Bildteil (Rechteck) aus einem Bild. */
export function cutImage(img: CanvasImageSource, sx: number, sy: number, w: number, h: number): HTMLCanvasElement {
  const c = makeCanvas(Math.max(1, w), Math.max(1, h));
  ctx2d(c).drawImage(img, sx, sy, w, h, 0, 0, w, h);
  return c;
}

/** Teilt ein Bild entlang einer Linie in zwei Hälften (für "split"). */
export function splitImage(img: CanvasImageSource, w: number, h: number, slope: number): [HTMLCanvasElement, HTMLCanvasElement] {
  const left = makeCanvas(w, h);
  const right = makeCanvas(w, h);
  for (const [c, side] of [
    [left, -1],
    [right, 1],
  ] as const) {
    const g = ctx2d(c);
    g.save();
    g.beginPath();
    const topX = w / 2 + slope * h * 0.5;
    const botX = w / 2 - slope * h * 0.5;
    if (side < 0) {
      g.moveTo(0, 0);
      g.lineTo(topX, 0);
      g.lineTo(botX, h);
      g.lineTo(0, h);
    } else {
      g.moveTo(topX, 0);
      g.lineTo(w, 0);
      g.lineTo(w, h);
      g.lineTo(botX, h);
    }
    g.closePath();
    g.clip();
    g.drawImage(img, 0, 0);
    g.restore();
    // blutige Schnittkante
    g.globalCompositeOperation = 'source-atop';
    g.strokeStyle = PAL.blood2;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(topX, 0);
    g.lineTo(botX, h);
    g.stroke();
  }
  return [left, right];
}

/** Oberste sichtbare Zeile und Höhe eines Bildes (für Kopfhöhe). */
export function opaqueRows(img: CanvasImageSource, w: number, h: number): { top: number; bottom: number } {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h).data;
  let top = h;
  let bottom = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 0) {
        if (y < top) top = y;
        bottom = y;
        break;
      }
    }
  }
  return { top, bottom };
}
