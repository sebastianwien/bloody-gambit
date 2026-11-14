import type { Color, PieceSymbol } from '../../shared/rules.ts';

/** Ein Einzelbild mit Fußpunkt (Anker) relativ zur linken oberen Ecke. */
export interface Frame {
  img: CanvasImageSource;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

export type { Dir8 } from './iso.ts';
import type { Dir8 } from './iso.ts';

/** Animationsnamen. Die Quelle liefert je Richtung passende Bilder (notfalls gespiegelt). */
export type AnimName =
  | 'idle'
  | 'quirk'
  | 'walk'
  | 'attack'
  | 'hurt'
  | 'parry'
  | 'stance'
  | 'victory'
  | 'defeat'
  | 'kick'
  | 'stomp'
  | 'die'
  | 'die2'
  | 'attack2'
  | 'dazed';

export interface SpriteSource {
  frames(kind: PieceSymbol, side: Color, anim: AnimName, dir: Dir8): Frame[];
  /** Ein Standbild (Ruhe). */
  still(kind: PieceSymbol, side: Color, dir: Dir8): Frame;
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = c.getContext('2d', { willReadFrequently: false })!;
  x.imageSmoothingEnabled = false;
  return x;
}

/** Spiegelt ein Bild horizontal in eine neue Leinwand. */
export function mirrorFrame(f: Frame): Frame {
  const c = makeCanvas(f.w, f.h);
  const g = ctx2d(c);
  g.translate(f.w, 0);
  g.scale(-1, 1);
  g.drawImage(f.img, 0, 0);
  return { img: c, w: f.w, h: f.h, ax: f.w - f.ax, ay: f.ay };
}
