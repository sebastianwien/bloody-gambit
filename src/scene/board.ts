import { VIEW_H, VIEW_W } from '../config.ts';
import { ctx2d, makeCanvas } from './sprites.ts';
import { PAL, hexToRgb } from './palette.ts';
import { boardToScreen, depthScale, screenToBoard } from './iso.ts';
import { mulberry32 } from '../util/random.ts';

/** Randbreite in Feldern und Höhe der vorderen Wand in Pixeln. */
export const RIM = 0.38;
export const WALL = 20;

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * Zeichnet das Steinbrett mit Rand und vorderer Wand einmal in eine Leinwand.
 * Das Muster ist 180° symmetrisch (a1 und h8 dunkel), darum gleich für beide Seiten.
 */
export function renderBoard(): HTMLCanvasElement {
  const c = makeCanvas(VIEW_W, VIEW_H);
  const g = ctx2d(c);
  const img = g.createImageData(VIEW_W, VIEW_H);
  const d = img.data;
  const rnd = mulberry32(1337);

  // Helle Felder gedämpft, damit das Brett in der Nachtszene nicht leuchtet
  const light: RGB[] = [hexToRgb('#6e665c'), hexToRgb('#7d7467'), hexToRgb('#736a5f')];
  const dark: RGB[] = [hexToRgb(PAL.stone1), hexToRgb('#302b2d'), hexToRgb('#28232a')];
  const rimCol: RGB[] = [hexToRgb(PAL.stone2), hexToRgb(PAL.stone3)];
  const wallCol = hexToRgb(PAL.stone2);
  const grout = hexToRgb(PAL.stone0);
  const moss = hexToRgb(PAL.moss1);
  const hi: RGB = [230, 220, 200];

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

  const put = (i: number, col: RGB, n: number) => {
    d[i] = Math.max(0, Math.min(255, col[0] + n));
    d[i + 1] = Math.max(0, Math.min(255, col[1] + n));
    d[i + 2] = Math.max(0, Math.min(255, col[2] + n));
    d[i + 3] = 255;
  };

  const o0 = -RIM;
  const o1 = 8 + RIM;
  const nearL = boardToScreen(o0, o0, false);
  const nearR = boardToScreen(o1, o0, false);
  const farY = Math.floor(boardToScreen(o0, o1, false).y);

  for (let y = farY - 1; y <= Math.ceil(nearL.y + WALL) + 1; y++) {
    for (let x = Math.floor(nearL.x) - 1; x <= Math.ceil(nearR.x) + 1; x++) {
      if (x < 0 || y < 0 || x >= VIEW_W || y >= VIEW_H) continue;
      const i = (y * VIEW_W + x) * 4;
      const noise = (rnd() - 0.5) * 14;
      if (y > nearL.y) {
        // Vordere Wand: Mauerwerk, nach unten dunkler
        const dy = y - nearL.y;
        if (dy > WALL || x < nearL.x || x > nearR.x) continue;
        const row = Math.floor(dy / 7);
        const bx = Math.floor(x + (row % 2) * 9) % 18;
        let col = wallCol;
        if (dy % 7 === 0 || bx === 0) col = grout;
        put(i, mix(col, grout, dy / WALL / 1.8), noise);
        continue;
      }
      const p = screenToBoard(x + 0.5, y + 0.5, false);
      // Pixelgröße schrumpft nach hinten: Kantenbreiten in Feldern anpassen
      const px = 1 / (60 * depthScale(Math.max(0, p.y)));
      if (p.x >= 0 && p.x < 8 && p.y >= 0 && p.y < 8) {
        const f = Math.floor(p.x);
        const r = Math.floor(p.y);
        const fx = p.x - f;
        const fy = p.y - r;
        let col = tileBase[f][r];
        const edge = Math.min(fx, fy * 0.6, 1 - fx, (1 - fy) * 0.6);
        if (edge < px * 0.9) {
          put(i, grout, noise * 0.3);
          continue;
        }
        // Licht von links oben: obere und linke Kante hell, rechte und vordere dunkel
        if (1 - fy < px * 3 || fx < px * 2.5) col = mix(col, hi, 0.13);
        if (fx > 1 - px * 2.5 || fy < px * 3) col = mix(col, grout, 0.35);
        const ck = crack[f][r];
        if (ck.s >= 0) {
          const line = Math.abs(fy - (ck.a + (ck.b - ck.a) * fx) * 0.8 - 0.1 + Math.sin(fx * 9 + ck.s * 6) * 0.04);
          if (line < px * 1.2 && fx > ck.s * 0.4 && fx < 0.4 + ck.s * 0.6) col = mix(col, grout, 0.7);
        }
        if ((f + r) % 2 === 1 && edge < px * 4 && rnd() < 0.18) col = mix(col, moss, 0.45);
        put(i, col, noise);
      } else if (p.x >= o0 && p.x < o1 && p.y >= o0 && p.y < o1) {
        // Ein Randstein je Feld, Fugen genau an den Feldgrenzen; Ecken sind eigene Steine
        const sideX = p.x < 0 || p.x >= 8;
        const sideY = p.y < 0 || p.y >= 8;
        const along = sideX && !sideY ? p.y : p.x;
        const blk = sideX && sideY ? 100 + (p.x < 0 ? 0 : 1) + (p.y < 0 ? 0 : 2) : Math.floor(along) + (sideX ? 20 : 0) + (p.x >= 8 || p.y >= 8 ? 40 : 0);
        const shade = ((blk * 2654435761) >>> 0) % 3;
        let col = mix(rimCol[0], rimCol[1], 0.25 + shade * 0.25);
        const inner = Math.min(Math.abs(p.x), Math.abs(p.y), Math.abs(8 - p.x), Math.abs(8 - p.y));
        const joint = !(sideX && sideY) && Math.abs(along - Math.round(along)) < px * 1.2;
        const cornerJoint = (sideX || sideY) && (Math.abs(p.x) < px * 1.2 || Math.abs(p.x - 8) < px * 1.2 || Math.abs(p.y) < px * 1.2 || Math.abs(p.y - 8) < px * 1.2);
        if (joint || cornerJoint || inner < px * 1.2) col = grout;
        // Vorderkante des Rands leicht heller (Kante im Licht)
        if (p.y < o0 + px * 2) col = mix(col, hi, 0.15);
        put(i, col, noise);
      }
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Beschriftung a-h vorne und 1-8 links auf dem Rand. */
export function drawBoardLabels(g: CanvasRenderingContext2D, flipped: boolean) {
  g.save();
  g.font = '10px Wolfsrune';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const put = (t: string, x: number, y: number) => {
    // Pixelgenau: Mitte auf ganze Pixel, dunkler Schatten unten rechts
    const px = Math.round(x);
    const py = Math.round(y);
    g.fillStyle = PAL.ink;
    g.fillText(t, px + 1, py + 1);
    g.fillStyle = PAL.stone6;
    g.fillText(t, px, py);
  };
  for (let i = 0; i < 8; i++) {
    const fi = flipped ? 7 - i : i;
    const pf = boardToScreen(i + 0.5, -RIM / 2, false);
    put(String.fromCharCode(97 + fi), pf.x, pf.y);
    const pr = boardToScreen(-RIM / 2, i + 0.5, false);
    put(String(fi + 1), pr.x, pr.y);
  }
  g.restore();
}

/** Ecken des Bretts mit Rand (Bildschirm). */
export function boardCorners() {
  return {
    nearLeft: boardToScreen(-RIM, -RIM, false),
    nearRight: boardToScreen(8 + RIM, -RIM, false),
    farLeft: boardToScreen(-RIM, 8 + RIM, false),
    farRight: boardToScreen(8 + RIM, 8 + RIM, false),
  };
}
