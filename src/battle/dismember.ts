import { PAL } from '../scene/palette.ts';
import { ctx2d, makeCanvas, type Frame } from '../scene/sprites.ts';

/** Gelenk relativ zum Fußpunkt (Pixel der Bildquelle). */
export type Joints = Record<string, [number, number]>;

interface P {
  x: number;
  y: number;
}

function distToSeg(p: P, a: P, b: P): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export interface Severed {
  /** Restkörper mit blutigem Stumpf, gleiche Maße und Anker wie das Ausgangsbild. */
  body: Frame;
  /** Abgetrenntes Teil (gleiche Leinwand, nur die Teilpixel). */
  part: HTMLCanvasElement;
  /** Schnittpunkt im Bild (für Blutfontäne). */
  cut: P;
  /** Schwerpunkt des Teils im Bild (Drehpunkt beim Fliegen). */
  center: P;
  /** Gehaltene Waffe, fällt einzeln zu Boden (oder null). */
  weapon: HTMLCanvasElement | null;
}

/**
 * Trennt einen Arm oder ein Bein von einem Einzelbild: alle Pixel nahe Ober- und Unterarm
 * jenseits der Schulter. Eine senkrecht gehaltene Stangenwaffe an der Hand wird als eigenes Teil erkannt.
 */
export function sever(f: Frame, joints: Joints, part: 'arm' | 'leg', mirror: boolean): Severed | null {
  const j = (n: string): P | null => {
    const v = joints[n];
    if (!v) return null;
    return { x: f.ax + (mirror ? -v[0] : v[0]), y: f.ay + v[1] };
  };
  const shoulder = j(part === 'arm' ? 'rShoulder' : 'rHip');
  const elbow = j(part === 'arm' ? 'rElbow' : 'rKnee');
  const wrist = j(part === 'arm' ? 'rWrist' : 'rAnkle');
  const neck = j('neck');
  const hip = j('rHip');
  if (!shoulder || !elbow || !wrist || !neck || !hip) return null;

  const { w, h } = f;
  const src = makeCanvas(w, h);
  const sg = src.getContext('2d', { willReadFrequently: true })!;
  sg.drawImage(f.img, 0, 0);
  const data = sg.getImageData(0, 0, w, h);
  const d = data.data;
  const scale = Math.max(1, h / 64);
  const r = 3.2 * scale; // Gliedstärke
  const mask = new Uint8Array(w * h);
  const ux = elbow.x - shoulder.x;
  const uy = elbow.y - shoulder.y;

  // 1. Gliedpixel
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i * 4 + 3] < 20) continue;
      const p = { x: x + 0.5, y: y + 0.5 };
      const beyond = (p.x - shoulder.x) * ux + (p.y - shoulder.y) * uy > 0;
      if (!beyond) continue;
      if (distToSeg(p, shoulder, elbow) < r || distToSeg(p, elbow, wrist) < r) {
        mask[i] = 1;
      }
    }
  }
  if (!mask.some((m) => m)) return null;
  // 2. Waffe in der Hand: lange senkrechte Linie durch das Handgelenk (Speer, Stab)
  const weapon = new Uint8Array(w * h);
  if (part === 'arm') {
    const minRun = Math.round(h * 0.12);
    for (let x = Math.round(wrist.x - 3 * scale); x <= Math.round(wrist.x + 3 * scale); x++) {
      if (x < 0 || x >= w) continue;
      let y = 0;
      while (y < h) {
        while (y < h && d[(y * w + x) * 4 + 3] < 20) y++;
        const y0 = y;
        while (y < h && d[(y * w + x) * 4 + 3] >= 20) y++;
        if (y - y0 >= minRun) for (let yy = y0; yy < y; yy++) weapon[yy * w + x] = 1;
      }
    }
    // Nur schmale Stangen: Spalten, die breiter als 3 Pixel am Stück sind (Körper, Schild), herausnehmen
    for (let y = 0; y < h; y++) {
      let run = 0;
      for (let x = 0; x <= w; x++) {
        const on = x < w && weapon[y * w + x] === 1;
        if (on) run++;
        else {
          if (run > 3 * scale) for (let k = x - run; k < x; k++) weapon[y * w + k] = 0;
          run = 0;
        }
      }
    }
    // Wo der Schaft vor dem Körper liegt: gleiche Spalten, Pixel in Schaftfarbe
    const cols = new Set<number>();
    const colors: [number, number, number][] = [];
    let y0w = h;
    let y1w = 0;
    for (let i = 0; i < w * h; i++) {
      if (!weapon[i]) continue;
      cols.add(i % w);
      const y = (i / w) | 0;
      y0w = Math.min(y0w, y);
      y1w = Math.max(y1w, y);
      if (colors.length < 200) colors.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
    }
    const near = (i: number) => colors.some(([r, g, b]) => Math.abs(r - d[i * 4]) + Math.abs(g - d[i * 4 + 1]) + Math.abs(b - d[i * 4 + 2]) < 24);
    for (const x of cols) {
      for (let y = y0w; y <= y1w + Math.round(20 * scale) && y < h; y++) {
        const i = y * w + x;
        if (!weapon[i] && d[i * 4 + 3] >= 20 && near(i)) weapon[i] = 1;
      }
    }
    for (let i = 0; i < w * h; i++) if (weapon[i]) mask[i] = 0;
  }

  // 3. Aufteilen in Körper und Teil
  const bodyC = makeCanvas(w, h);
  const partC = makeCanvas(w, h);
  const bd = new ImageData(new Uint8ClampedArray(d), w, h);
  const pd = new ImageData(w, h);
  const wd = new ImageData(w, h);
  let wn = 0;
  for (let i = 0; i < w * h; i++) {
    if (!weapon[i]) continue;
    for (let k = 0; k < 4; k++) wd.data[i * 4 + k] = d[i * 4 + k];
    bd.data[i * 4 + 3] = 0;
    wn++;
  }
  // Löcher im Rumpf (dort lagen Arm oder Schaft vor dem Körper) mit den nächsten Körperfarben füllen,
  // aber nur, wo links und rechts noch Körper ist; außerhalb des Umrisses bleibt es durchsichtig
  const removed = (i: number) => mask[i] === 1 || weapon[i] === 1;
  const reach = Math.round(14 * scale);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!removed(i)) continue;
      let left = -1;
      let right = -1;
      for (let k = 1; k <= reach && (left < 0 || right < 0); k++) {
        const lx = x - k;
        const rx = x + k;
        if (left < 0 && lx >= 0 && d[(i - k) * 4 + 3] >= 20 && !removed(i - k)) left = i - k;
        if (right < 0 && rx < w && d[(i + k) * 4 + 3] >= 20 && !removed(i + k)) right = i + k;
      }
      if (left < 0 || right < 0) continue;
      const src = x - (left % w) <= (right % w) - x ? left : right;
      for (let c = 0; c < 4; c++) bd.data[i * 4 + c] = d[src * 4 + c];
    }
  }
  let cx = 0;
  let cy = 0;
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    for (let k = 0; k < 4; k++) pd.data[i * 4 + k] = d[i * 4 + k];
    bd.data[i * 4 + 3] = 0;
    cx += i % w;
    cy += (i / w) | 0;
    n++;
  }
  ctx2d(bodyC).putImageData(bd, 0, 0);
  ctx2d(partC).putImageData(pd, 0, 0);
  let weaponC: HTMLCanvasElement | null = null;
  if (wn > 10) {
    weaponC = makeCanvas(w, h);
    ctx2d(weaponC).putImageData(wd, 0, 0);
  }

  // 4. Blutiger Stumpf am Körper, rote Kante am Teil
  const bg = ctx2d(bodyC);
  const sr = Math.round(1.6 * scale);
  bg.fillStyle = PAL.blood1;
  bg.fillRect(Math.round(shoulder.x - sr), Math.round(shoulder.y - sr / 2), sr * 2, sr);
  bg.fillStyle = PAL.blood3;
  bg.fillRect(Math.round(shoulder.x - sr / 2), Math.round(shoulder.y - sr / 2), sr, Math.max(1, sr / 2));
  bg.fillStyle = PAL.bone;
  bg.fillRect(Math.round(shoulder.x), Math.round(shoulder.y - 1), Math.max(1, Math.round(scale)), Math.max(1, Math.round(scale)));
  const pg = ctx2d(partC);
  pg.globalCompositeOperation = 'source-atop';
  pg.fillStyle = PAL.blood2;
  pg.fillRect(Math.round(shoulder.x - r), Math.round(shoulder.y - r), Math.round(r * 2), Math.round(r * 1.2));

  return {
    body: { img: bodyC, w, h, ax: f.ax, ay: f.ay },
    part: partC,
    cut: shoulder,
    center: n ? { x: cx / n, y: cy / n } : wrist,
    weapon: weaponC,
  };
}
