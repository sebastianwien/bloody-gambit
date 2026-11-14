import type { Square } from '../../shared/rules.ts';
import { TILE_H, TILE_W, VIEW_H, VIEW_W } from '../config.ts';
import { Actor } from './actor.ts';
import { drawBoardLabels, renderBoard } from './board.ts';
import { boardToScreen, squareToBoard } from './iso.ts';
import { PAL } from './palette.ts';
import type { SpriteSource } from './sprites.ts';
import { Tweens } from './tween.ts';

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
      if (a.anim === 'idle' && a.loop) {
        a.quirkIn -= dt;
        if (a.quirkIn <= 0) {
          a.quirkIn = 8 + Math.random() * 18;
          if (this.sprites.frames(a.kind, a.side, 'quirk', a.view).length > 1) {
            a.play('quirk', false);
          }
        }
      } else if (a.anim === 'quirk' && a.animT * a.fps >= this.sprites.frames(a.kind, a.side, 'quirk', a.view).length) {
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
    for (const l of this.floorLayers) l.draw(g, this);
    const sorted = this.actors
      .filter((a) => a.visible)
      .sort((a, b) => a.screen(this.flipped).y - b.screen(this.flipped).y || a.id - b.id);
    for (const a of sorted) this.drawActor(g, a);
    for (const l of this.frontLayers) l.draw(g, this);
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const l of this.screenLayers) l.draw(g, this);
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
    const { f } = a.frame(this.sprites);
    g.save();
    g.globalAlpha = a.alpha;
    g.translate(x, Math.round(y - a.z));
    if (a.rot) g.rotate(a.rot);
    if (a.scale !== 1) g.scale(a.scale, a.scale);
    if (a.mirror) g.scale(-1, 1);
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
      const p = boardToScreen(b.x + 0.5, b.y + 0.5, this.flipped);
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      g.save();
      switch (m.kind) {
        case 'last':
          diamond(g, x, y, TILE_W / 2 - 2, TILE_H / 2 - 1);
          g.globalAlpha = 0.22;
          g.fillStyle = PAL.last;
          g.fill();
          break;
        case 'hover':
          diamond(g, x, y, TILE_W / 2 - 2, TILE_H / 2 - 1);
          g.globalAlpha = 0.5;
          g.strokeStyle = PAL.stone6;
          g.lineWidth = 1;
          g.stroke();
          break;
        case 'select':
          diamond(g, x, y, TILE_W / 2 - 2, TILE_H / 2 - 1);
          g.globalAlpha = 0.25 + 0.15 * pulse;
          g.fillStyle = PAL.select;
          g.fill();
          g.globalAlpha = 0.9;
          g.strokeStyle = PAL.select;
          g.lineWidth = 2;
          g.stroke();
          break;
        case 'move':
          diamond(g, x, y, 7, 3.5);
          g.globalAlpha = 0.55 + 0.25 * pulse;
          g.fillStyle = PAL.move;
          g.fill();
          break;
        case 'premove':
          diamond(g, x, y, 7, 3.5);
          g.globalAlpha = 0.5;
          g.fillStyle = PAL.stone6;
          g.fill();
          break;
        case 'capture':
          diamond(g, x, y, TILE_W / 2 - 3, TILE_H / 2 - 1.5);
          g.globalAlpha = 0.5 + 0.4 * pulse;
          g.strokeStyle = PAL.capture;
          g.lineWidth = 2;
          g.stroke();
          break;
        case 'check':
          diamond(g, x, y, TILE_W / 2 - 1, TILE_H / 2);
          g.globalAlpha = 0.3 + 0.35 * pulse;
          g.fillStyle = PAL.check;
          g.fill();
          break;
      }
      g.restore();
    }
  }

  shake(amount: number) {
    this.camera.shake = Math.max(this.camera.shake, amount);
  }
}

export function diamond(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  g.beginPath();
  g.moveTo(x - rx, y);
  g.lineTo(x, y - ry);
  g.lineTo(x + rx, y);
  g.lineTo(x, y + ry);
  g.closePath();
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

export const STAGE_TILE = { w: TILE_W, h: TILE_H };
export { VIEW_H, VIEW_W };
