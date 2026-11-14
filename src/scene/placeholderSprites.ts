import type { Color, PieceSymbol } from '../../shared/rules.ts';
import { ctx2d, makeCanvas, type AnimName, type Frame, type SpriteSource, type View } from './sprites.ts';

/**
 * Einfache gezeichnete Figuren, bis die PixelLab-Grafiken da sind (und als Rückfall,
 * falls ein Atlas nicht lädt).
 */
const SHAPES: Record<PieceSymbol, string[]> = {
  p: [
    '....##....',
    '...####...',
    '...####...',
    '....##....',
    '..######..',
    '..######..',
    '...####...',
    '...####...',
    '..######..',
    '.########.',
  ],
  n: [
    '...###....',
    '..#####...',
    '.###.##...',
    '.##..###..',
    '.....###..',
    '....####..',
    '...#####..',
    '...#####..',
    '..######..',
    '.########.',
  ],
  b: [
    '....##....',
    '...###....',
    '..##.##...',
    '..#.###...',
    '..#####...',
    '...###....',
    '..#####...',
    '..#####...',
    '..######..',
    '.########.',
  ],
  r: [
    '.#.##.#.#.',
    '.########.',
    '..######..',
    '..######..',
    '..######..',
    '..######..',
    '..######..',
    '..######..',
    '.########.',
    '.########.',
  ],
  q: [
    '.#..#..#..',
    '.#.###.#..',
    '..#####...',
    '...###....',
    '..#####...',
    '...###....',
    '..#####...',
    '..#####...',
    '.#######..',
    '.########.',
  ],
  k: [
    '....##....',
    '...####...',
    '....##....',
    '..######..',
    '...####...',
    '..######..',
    '...####...',
    '..######..',
    '.########.',
    '.########.',
  ],
};

const COLORS: Record<Color, { fill: string; shade: string; line: string }> = {
  w: { fill: '#d8ccb0', shade: '#a39577', line: '#1a1418' },
  b: { fill: '#3a3138', shade: '#241e24', line: '#0b080b' },
};

export class PlaceholderSprites implements SpriteSource {
  private cache = new Map<string, Frame>();

  private make(kind: PieceSymbol, side: Color, view: View, bob: number): Frame {
    const key = `${kind}${side}${view}${bob}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const px = 4;
    const shape = SHAPES[kind];
    const w = 10 * px + 2;
    const h = 10 * px + 2 + 4;
    const c = makeCanvas(w, h);
    const g = ctx2d(c);
    const col = COLORS[side];
    const fill = (dx: number, dy: number, color: string) => {
      shape.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if (row[x] !== '#') continue;
          g.fillStyle = color;
          g.fillRect(1 + x * px + dx, 1 + y * px + dy + bob, px, px);
        }
      });
    };
    // Umriss: vier versetzte Kopien in Linienfarbe
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) fill(dx, dy, col.line);
    fill(0, 0, col.fill);
    // Schatten rechte Hälfte, bei Rückansicht dunkler
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = col.shade;
    g.fillRect(w / 2 + 2, 0, w / 2, h);
    if (view === 'back') {
      g.globalAlpha = 0.35;
      g.fillRect(0, 0, w, h);
    }
    // Wappenfleck vorne
    if (view === 'front' && kind !== 'r') {
      g.globalAlpha = 1;
      g.fillStyle = '#7a1c22';
      g.fillRect(w / 2 - 4, 5 * px + bob, 6, 6);
    }
    const f: Frame = { img: c, w, h, ax: w / 2, ay: h - 3 };
    this.cache.set(key, f);
    return f;
  }

  frames(kind: PieceSymbol, side: Color, anim: AnimName, view: View): Frame[] {
    if (anim === 'walk') return [0, -2, 0, -2].map((b) => this.make(kind, side, view, b));
    if (anim === 'idle') return [this.make(kind, side, view, 0), this.make(kind, side, view, 0), this.make(kind, side, view, 1)];
    return [this.make(kind, side, view, 0)];
  }

  still(kind: PieceSymbol, side: Color, view: View): Frame {
    return this.make(kind, side, view, 0);
  }
}
