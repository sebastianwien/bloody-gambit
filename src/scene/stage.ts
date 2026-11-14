import type { Square } from '../../shared/rules.ts';
import { VIEW_H, VIEW_W } from '../config.ts';
import { Actor } from './actor.ts';
import { drawBoardLabels, renderBoard } from './board.ts';
import { boardToScreen, squareToBoard } from './iso.ts';
import { PAL } from './palette.ts';
import type { SpriteSource } from './sprites.ts';
import { Tweens } from './tween.ts';
import { Effects, type Prop } from './effects.ts';

export interface Layer {
  update?(dt: number, stage: Stage): void;
  draw(g: CanvasRenderingContext2D, stage: Stage): void;
}

export type MarkKind = 'select' | 'move' | 'capture' | 'last' | 'check' | 'hover' | 'premove';
export interface Mark {
  sq: Square;
  kind: MarkKind;
}

export class Stage {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  flipped = false;
  sprites: SpriteSource;
  actors: Actor[] = [];
  marks: Mark[] = [];
  readonly tweens = new Tweens();
  /** Hinter dem Brett (Himmel, Ruine). */
  backLayers: Layer[] = [];
  /** Auf dem Brett unter den Figuren (Blutflecken). */
  floorLayers: Layer[] = [];
  /** Zwischen Figuren einsortierte Dinge zeichnet die Figurenschleife; das hier liegt darüber. */
  frontLayers: Layer[] = [];
  /** Nach der Kamera, also fest auf dem Bildschirm (Regen, Blitz, Vignette). */
  screenLayers: Layer[] = [];
  camera = { x: VIEW_W / 2, y: VIEW_H / 2, zoom: 1, shake: 0 };
  readonly effects = new Effects();
  /** Kampf-Sprites in doppelter Auflösung (nur für Figuren, die es dort gibt). */
  hd: (SpriteSource & { kinds: Set<string>; jointsFor?(kind: string, dir: string): { joints: Record<string, [number, number]>; mirror: boolean } | null }) | null = null;
  /** Abdunkeln der Umgebung während eines Kampfes (0..1). */
  dim = 0;
  time = 0;
  private board: HTMLCanvasElement;
  private shakeX = 0;
  private shakeY = 0;
  showLabels = true;

  constructor(canvas: HTMLCanvasElement, sprites: SpriteSource) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.sprites = sprites;
    this.board = renderBoard();
  }

  /** Bildquelle einer Figur: Kampf-Sprites, wenn aktiv und vorhanden. */
  srcFor(a: Actor): SpriteSource {
    return a.hd && this.hd?.kinds.has(a.kind) ? this.hd : this.sprites;
  }

  /** Zeichenmaßstab einer Figur (Kampf-Sprites sind doppelt aufgelöst). */
  scaleOf(a: Actor): number {
    return a.hd && this.hd?.kinds.has(a.kind) ? 0.5 : 1;
  }

  actorAt(sq: Square): Actor | undefined {
    return this.actors.find((a) => a.sq === sq && a.visible);
  }

  removeActor(a: Actor) {
    this.actors = this.actors.filter((x) => x !== a);
  }

  update(dt: number) {
    this.time += dt;
    this.tweens.update(dt);
    for (const a of this.actors) {
      a.animT += dt;
      if (a.lookT > 0) {
        a.lookT -= dt;
        if (a.lookT <= 0 && a.anim === 'idle') a.dir = a.restDir;
      }
      if (a.anim === 'idle' && a.loop && a.dir === a.restDir && !a.override) {
        a.quirkIn -= dt;
        if (a.quirkIn <= 0) {
          a.quirkIn = 8 + Math.random() * 18;
          if (this.sprites.frames(a.kind, a.side, 'quirk', a.dir).length > 1) {
            a.play('quirk', false);
          } else {
            // Ohne eigene Bilder: kurz zur Seite schauen
            const side = Math.random() < 0.5 ? 'e' : 'w';
            const d = a.restDir === 'n' ? (side === 'e' ? 'ne' : 'nw') : a.restDir === 's' ? (side === 'e' ? 'se' : 'sw') : a.restDir;
            a.dir = d;
            a.lookT = 0.8 + Math.random() * 1.2;
          }
        }
      } else if (a.anim === 'quirk' && a.animT * a.fps >= this.sprites.frames(a.kind, a.side, 'quirk', a.dir).length) {
        a.play('idle', true);
      }
    }
    if (this.camera.shake > 0) {
      this.camera.shake = Math.max(0, this.camera.shake - dt * 18);
      const s = this.camera.shake;
      this.shakeX = Math.round((Math.random() * 2 - 1) * s);
      this.shakeY = Math.round((Math.random() * 2 - 1) * s);
    } else {
      this.shakeX = this.shakeY = 0;
    }
    this.effects.update(dt, this);
    for (const l of [...this.backLayers, ...this.floorLayers, ...this.frontLayers, ...this.screenLayers]) l.update?.(dt, this);
  }

  /** Weltkoordinaten -> Bildschirm unter Berücksichtigung der Kamera. */
  worldToView(x: number, y: number) {
    const c = this.camera;
    return { x: (x - c.x) * c.zoom + VIEW_W / 2, y: (y - c.y) * c.zoom + VIEW_H / 2 };
  }

  viewToWorld(x: number, y: number) {
    const c = this.camera;
    return { x: (x - VIEW_W / 2) / c.zoom + c.x, y: (y - VIEW_H / 2) / c.zoom + c.y };
  }

  draw() {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = PAL.night0;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    const c = this.camera;
    g.setTransform(c.zoom, 0, 0, c.zoom, VIEW_W / 2 - (c.x - this.shakeX) * c.zoom, VIEW_H / 2 - (c.y - this.shakeY) * c.zoom);
    for (const l of this.backLayers) l.draw(g, this);
    g.drawImage(this.board, 0, 0);
    if (this.showLabels) drawBoardLabels(g, this.flipped);
    this.drawMarks(g);
    this.effects.drawFloor(g, this);
    for (const l of this.floorLayers) l.draw(g, this);
    if (this.dim > 0) {
      // Umgebung abdunkeln, Figuren und Effekte bleiben hell
      const tl = this.viewToWorld(0, 0);
      g.globalAlpha = this.dim * 0.45;
      g.fillStyle = PAL.night0;
      g.fillRect(tl.x - 20, tl.y - 20, VIEW_W / c.zoom + 40, VIEW_H / c.zoom + 40);
      g.globalAlpha = 1;
    }
    type Item = { y: number; id: number; a?: Actor; p?: Prop };
    const items: Item[] = [];
    for (const a of this.actors) if (a.visible) items.push({ y: a.screen(this.flipped).y, id: a.id, a });
    this.effects.props.forEach((p, i) => items.push({ y: p.y, id: 100000 + i, p }));
    items.sort((a, b) => a.y - b.y || a.id - b.id);
    for (const it of items) {
      if (it.a) this.drawActor(g, it.a);
      else if (it.p) this.effects.drawProp(g, it.p);
    }
    this.effects.draw(g);
    for (const l of this.frontLayers) l.draw(g, this);
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const l of this.screenLayers) l.draw(g, this);
    this.effects.drawScreen(g, VIEW_W, VIEW_H);
  }

  /** Schatten unter der Figur. */
  private drawShadow(g: CanvasRenderingContext2D, x: number, y: number, z: number, alpha: number) {
    const s = Math.max(0.4, 1 - z / 80);
    g.globalAlpha = 0.45 * alpha * s;
    g.fillStyle = PAL.ink;
    g.beginPath();
    g.ellipse(x, y, 13 * s, 5 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }

  drawActor(g: CanvasRenderingContext2D, a: Actor) {
    const p = a.screen(this.flipped);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (!a.override) this.drawShadow(g, x, y, a.z, a.alpha);
    const { f } = a.frame(this.srcFor(a));
    const sc = this.scaleOf(a) * a.scale;
    g.save();
    g.globalAlpha = a.alpha;
    // Laufen ohne eigene Bilder: kleines Hüpfen
    const bob = a.bob ? Math.round(Math.abs(Math.sin(a.bob * Math.PI)) * -2) : 0;
    g.translate(x, Math.round(y - a.z) + bob);
    if (a.rot) g.rotate(a.rot);
    if (sc !== 1) g.scale(sc, sc);
    g.drawImage(f.img, -f.ax, -f.ay);
    if (a.flash > 0) {
      g.globalAlpha = a.flash * a.alpha;
      g.drawImage(flashCanvas(f), -f.ax, -f.ay);
    }
    g.restore();
  }

  private drawMarks(g: CanvasRenderingContext2D) {
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
    for (const m of this.marks) {
      const b = squareToBoard(m.sq);
      g.save();
      switch (m.kind) {
        case 'last':
          this.quad(g, b.x, b.y, 0.04);
          g.globalAlpha = 0.22;
          g.fillStyle = PAL.last;
          g.fill();
          break;
        case 'hover':
          this.quad(g, b.x, b.y, 0.04);
          g.globalAlpha = 0.5;
          g.strokeStyle = PAL.stone6;
          g.lineWidth = 1;
          g.stroke();
          break;
        case 'select':
          this.quad(g, b.x, b.y, 0.05);
          g.globalAlpha = 0.25 + 0.15 * pulse;
          g.fillStyle = PAL.select;
          g.fill();
          g.globalAlpha = 0.9;
          g.strokeStyle = PAL.select;
          g.lineWidth = 2;
          g.stroke();
          break;
        case 'move':
        case 'premove':
          this.quad(g, b.x, b.y, 0.38);
          g.globalAlpha = m.kind === 'move' ? 0.55 + 0.25 * pulse : 0.5;
          g.fillStyle = m.kind === 'move' ? PAL.move : PAL.stone6;
          g.fill();
          break;
        case 'capture':
          this.quad(g, b.x, b.y, 0.07);
          g.globalAlpha = 0.5 + 0.4 * pulse;
          g.strokeStyle = PAL.capture;
          g.lineWidth = 2;
          g.stroke();
          break;
        case 'check':
          this.quad(g, b.x, b.y, 0.02);
          g.globalAlpha = 0.3 + 0.35 * pulse;
          g.fillStyle = PAL.check;
          g.fill();
          break;
      }
      g.restore();
    }
  }

  /** Pfad eines Feldes (f, r), um inset Felder nach innen gerückt. */
  quad(g: CanvasRenderingContext2D, f: number, r: number, inset: number) {
    const fl = this.flipped;
    const a = boardToScreen(f + inset, r + inset, fl);
    const b = boardToScreen(f + 1 - inset, r + inset, fl);
    const c = boardToScreen(f + 1 - inset, r + 1 - inset, fl);
    const d = boardToScreen(f + inset, r + 1 - inset, fl);
    g.beginPath();
    g.moveTo(Math.round(a.x), Math.round(a.y));
    g.lineTo(Math.round(b.x), Math.round(b.y));
    g.lineTo(Math.round(c.x), Math.round(c.y));
    g.lineTo(Math.round(d.x), Math.round(d.y));
    g.closePath();
  }

  shake(amount: number) {
    this.camera.shake = Math.max(this.camera.shake, amount);
  }
}

const flashCache = new WeakMap<object, HTMLCanvasElement>();
/** Weiße Silhouette eines Bildes für den Trefferblitz. */
export function flashCanvas(f: { img: CanvasImageSource; w: number; h: number }): HTMLCanvasElement {
  const hit = flashCache.get(f.img as object);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = f.w;
  c.height = f.h;
  const g = c.getContext('2d')!;
  g.drawImage(f.img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#fff8e8';
  g.fillRect(0, 0, f.w, f.h);
  flashCache.set(f.img as object, c);
  return c;
}

export { VIEW_H, VIEW_W };
