import { BOARD_OX, BOARD_OY, TILE_H, TILE_W, VIEW_H, VIEW_W } from '../config.ts';
import { ctx2d, makeCanvas } from './sprites.ts';
import { PAL, hexToRgb } from './palette.ts';
import { boardToScreen, screenToBoard } from './iso.ts';
import { mulberry32 } from '../util/random.ts';

/** Randbreite in Feldern und Höhe der Seitenwand in Pixeln. */
export const RIM = 0.42;
export const WALL = 22;

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * Zeichnet das Steinbrett mit Rand und Seitenwänden einmal in eine Leinwand.
 * Das Muster ist 180° symmetrisch, darum gleich für beide Blickrichtungen.
 */
export function renderBoard(): HTMLCanvasElement {
  const c = makeCanvas(VIEW_W, VIEW_H);
  const g = ctx2d(c);
  const img = g.createImageData(VIEW_W, VIEW_H);
  const d = img.data;
  const rnd = mulberry32(1337);

  const light: RGB[] = [hexToRgb(PAL.stone4), hexToRgb(PAL.stone5), hexToRgb('#8b8273')];
  const dark: RGB[] = [hexToRgb(PAL.stone1), hexToRgb(PAL.stone2), hexToRgb('#332e30')];
  const rimCol: RGB[] = [hexToRgb(PAL.stone2), hexToRgb(PAL.stone3)];
  const wallL = hexToRgb(PAL.stone2);
  const wallR = hexToRgb(PAL.stone1);
  const grout = hexToRgb(PAL.stone0);
  const moss = hexToRgb(PAL.moss1);

  // Pro Feld eine Grundfarbe und eine Risslinie
  const tileBase: RGB[][] = [];
  const crack: { a: number; b: number; s: number }[][] = [];
  for (let f = 0; f < 8; f++) {
    tileBase[f] = [];
    crack[f] = [];
    for (let r = 0; r < 8; r++) {
      const isLight = (f + r) % 2 === 1;
      const pal = isLight ? light : dark;
      tileBase[f][r] = mix(pal[Math.floor(rnd() * pal.length)], pal[0], 0.3);
      crack[f][r] = { a: rnd(), b: rnd(), s: rnd() < 0.45 ? rnd() : -1 };
    }
  }
  // Randsteine: 8 Blöcke je Seite + Ecken
  const rimBlock = (t: number) => Math.floor(t * 1.5);

  const outer0 = -RIM;
  const outer1 = 8 + RIM;
  const L = boardToScreen(outer0, outer0, false); // linke Ecke
  const B = boardToScreen(outer1, outer0, false); // untere Ecke
  const R = boardToScreen(outer1, outer1, false); // rechte Ecke

  const put = (i: number, col: RGB, n: number) => {
    d[i] = Math.max(0, Math.min(255, col[0] + n));
    d[i + 1] = Math.max(0, Math.min(255, col[1] + n));
    d[i + 2] = Math.max(0, Math.min(255, col[2] + n));
    d[i + 3] = 255;
  };

  const yMin = Math.floor(boardToScreen(outer0, outer1, false).y) - 1;
  const yMax = Math.ceil(B.y + WALL) + 1;
  for (let y = yMin; y <= yMax; y++) {
    for (let x = Math.floor(L.x) - 1; x <= Math.ceil(R.x) + 1; x++) {
      if (x < 0 || y < 0 || x >= VIEW_W || y >= VIEW_H) continue;
      const i = (y * VIEW_W + x) * 4;
      const p = screenToBoard(x + 0.5, y + 0.5, false);
      const noise = (rnd() - 0.5) * 14;
      if (p.x >= 0 && p.x < 8 && p.y >= 0 && p.y < 8) {
        const f = Math.floor(p.x);
        const r = Math.floor(p.y);
        const fx = p.x - f;
        const fy = p.y - r;
        let col = tileBase[f][r];
        // Fugen: dunkle Linie an den Kanten, heller Grat oben links (Licht von links oben)
        const edge = Math.min(fx, fy, 1 - fx, 1 - fy);
        if (edge < 0.025) {
          put(i, grout, noise * 0.3);
          continue;
        }
        if (fy > 0.95 || fx < 0.06) col = mix(col, [230, 220, 200], 0.12);
        if (fx > 0.94 || fy < 0.06) col = mix(col, grout, 0.35);
        // Riss als schräge Linie
        const ck = crack[f][r];
        if (ck.s >= 0) {
          const line = Math.abs(fy - (ck.a + (ck.b - ck.a) * fx) * 0.8 - 0.1 + Math.sin(fx * 9 + ck.s * 6) * 0.04);
          if (line < 0.02 && fx > ck.s * 0.4 && fx < 0.4 + ck.s * 0.6) col = mix(col, grout, 0.7);
        }
        // Moos in Fugennähe auf hellen Feldern
        if ((f + r) % 2 === 1 && edge < 0.08 && rnd() < 0.18) col = mix(col, moss, 0.45);
        put(i, col, noise);
      } else if (p.x >= outer0 && p.x < outer1 && p.y >= outer0 && p.y < outer1) {
        // Randsteine
        const along = p.x < 0 || p.x >= 8 ? p.y : p.x;
        const blk = rimBlock(along);
        let col = rimCol[((blk % 2) + 2) % 2];
        const inner = Math.min(Math.abs(p.x), Math.abs(p.y), Math.abs(8 - p.x), Math.abs(8 - p.y));
        if (Math.abs(along * 1.5 - Math.round(along * 1.5)) < 0.03) col = grout;
        else if (inner < 0.04) col = grout;
        put(i, col, noise);
      } else {
        // Seitenwände: linke Wand unter Kante L-B, rechte unter B-R
        if (x <= B.x) {
          const t = (x - L.x) / (B.x - L.x);
          const ey = L.y + (B.y - L.y) * t;
          if (y > ey && y <= ey + WALL && t >= 0) {
            const dy = y - ey;
            const brickRow = Math.floor(dy / 7);
            const bx = (x + (brickRow % 2) * 8) % 16;
            let col = wallL;
            if (dy % 7 === 0 || bx === 0) col = grout;
            put(i, mix(col, grout, dy / WALL / 2.2), noise);
          }
        } else {
          const t = (x - B.x) / (R.x - B.x);
          const ey = B.y + (R.y - B.y) * t;
          if (y > ey && y <= ey + WALL && t <= 1) {
            const dy = y - ey;
            const brickRow = Math.floor(dy / 7);
            const bx = (x + (brickRow % 2) * 8) % 16;
            let col = wallR;
            if (dy % 7 === 0 || bx === 0) col = grout;
            put(i, mix(col, grout, dy / WALL / 2.2), noise);
          }
        }
      }
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Beschriftung a-h und 1-8 auf dem Rand. */
export function drawBoardLabels(g: CanvasRenderingContext2D, flipped: boolean) {
  g.save();
  g.font = '10px Wolfsrune';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = PAL.stone5;
  for (let i = 0; i < 8; i++) {
    // Linien entlang der unteren rechten Kante (Reihe -RIM/2 aus Sicht unten)
    const fi = flipped ? 7 - i : i;
    const pf = boardToScreen(i + 0.5, -RIM / 2, false);
    g.fillText(String.fromCharCode(97 + fi), Math.round(pf.x), Math.round(pf.y + 4));
    const ri = flipped ? 7 - i : i;
    const pr = boardToScreen(-RIM / 2, i + 0.5, false);
    g.fillText(String(ri + 1), Math.round(pr.x), Math.round(pr.y + 4));
  }
  g.restore();
}

export const BOARD_CORNERS = {
  left: boardToScreen(-RIM, -RIM, false),
  bottom: boardToScreen(8 + RIM, -RIM, false),
  right: boardToScreen(8 + RIM, 8 + RIM, false),
  top: boardToScreen(-RIM, 8 + RIM, false),
};

export const TILE = { w: TILE_W, h: TILE_H, ox: BOARD_OX, oy: BOARD_OY };
