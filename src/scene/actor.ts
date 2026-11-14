import type { Color, PieceSymbol, Square } from '../../shared/rules.ts';
import { ANIM_FPS } from '../config.ts';
import { boardToScreen, squareToBoard } from './iso.ts';
import type { AnimName, Frame, SpriteSource, View } from './sprites.ts';

let nextId = 1;

/** Eine Figur auf der Bühne. Position in Brettkoordinaten (Feldmitte = x.5). */
export class Actor {
  readonly id = nextId++;
  kind: PieceSymbol;
  side: Color;
  sq: Square | null;
  bx: number;
  by: number;
  /** Höhe über dem Brett in Pixeln (Sprung, Wurf). */
  z = 0;
  /** Bildschirmversatz für Kampfszenen. */
  ox = 0;
  oy = 0;
  view: View = 'front';
  mirror = false;
  anim: AnimName = 'idle';
  animT = 0;
  loop = true;
  /** Bildrate dieser Animation. */
  fps = ANIM_FPS;
  alpha = 1;
  flash = 0;
  rot = 0;
  scale = 1;
  visible = true;
  /** Zeit bis zur nächsten Eigenheit im Ruhezustand. */
  quirkIn = 4 + Math.random() * 14;
  /** Wird ein Bild mit eigener Leinwand gezeigt (Todesvarianten), ersetzt es die Animation. */
  override: Frame | null = null;
  /** Vorgabe-Blickrichtung im Ruhezustand. */
  restView: View = 'front';
  restMirror = false;

  constructor(kind: PieceSymbol, side: Color, sq: Square) {
    this.kind = kind;
    this.side = side;
    this.sq = sq;
    const b = squareToBoard(sq);
    this.bx = b.x + 0.5;
    this.by = b.y + 0.5;
  }

  screen(flipped: boolean) {
    const p = boardToScreen(this.bx, this.by, flipped);
    return { x: p.x + this.ox, y: p.y + this.oy };
  }

  play(anim: AnimName, loop = false, fps = ANIM_FPS) {
    this.anim = anim;
    this.animT = 0;
    this.loop = loop;
    this.fps = fps;
  }

  rest() {
    this.view = this.restView;
    this.mirror = this.restMirror;
    this.play('idle', true);
  }

  /** Aktuelles Bild und ob die Animation durch ist. */
  frame(src: SpriteSource): { f: Frame; done: boolean } {
    if (this.override) return { f: this.override, done: true };
    const frames = src.frames(this.kind, this.side, this.anim, this.view);
    const n = frames.length;
    const idx = Math.floor(this.animT * this.fps);
    if (this.loop) return { f: frames[idx % n], done: false };
    return { f: frames[Math.min(idx, n - 1)], done: idx >= n };
  }

  duration(src: SpriteSource, anim: AnimName = this.anim): number {
    return src.frames(this.kind, this.side, anim, this.view).length / this.fps;
  }
}
