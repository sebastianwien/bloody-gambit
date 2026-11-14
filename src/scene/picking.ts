import type { Square } from '../../shared/rules.ts';
import { screenToSquare } from './iso.ts';
import type { Stage } from './stage.ts';
import type { Frame } from './sprites.ts';

const masks = new WeakMap<object, Uint8ClampedArray>();

function alphaAt(f: Frame, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= f.w || y >= f.h) return 0;
  let m = masks.get(f.img as object);
  if (!m) {
    const c = document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(f.img, 0, 0);
    m = g.getImageData(0, 0, f.w, f.h).data;
    masks.set(f.img as object, m);
  }
  return m[(y * f.w + x) * 4 + 3];
}

/**
 * Welches Feld meint ein Klick? Zuerst Figuren (vorderste zuerst, nach Pixel),
 * damit man auch auf den Körper einer hinten stehenden Figur klicken kann. Sonst das Feld darunter.
 */
export function pickSquare(stage: Stage, wx: number, wy: number, preferTile?: (sq: Square) => boolean): Square | null {
  const tile = screenToSquare(wx, wy, stage.flipped);
  // Belegtes Feld oder erlaubtes Ziel unter dem Zeiger gewinnt immer
  if (tile && (stage.actorAt(tile) || preferTile?.(tile))) return tile;
  const list = stage.actors
    .filter((a) => a.visible && a.sq)
    .sort((a, b) => b.screen(stage.flipped).y - a.screen(stage.flipped).y);
  for (const a of list) {
    const p = a.screen(stage.flipped);
    const { f } = a.frame(stage.sprites);
    const lx = Math.floor(wx - (Math.round(p.x) - f.ax));
    const ly = Math.floor(wy - (Math.round(p.y - a.z) - f.ay));
    if (alphaAt(f, lx, ly) > 40) return a.sq;
  }
  return tile;
}
