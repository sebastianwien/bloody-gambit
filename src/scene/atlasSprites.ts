import type { Color, PieceSymbol } from '../../shared/rules.ts';
import type { Dir8 } from './iso.ts';
import { loadImage } from '../util/image.ts';
import { ctx2d, makeCanvas, mirrorFrame, type AnimName, type Frame, type SpriteSource } from './sprites.ts';

type Rect = [number, number, number, number, number, number];
interface AtlasJson {
  frames: Record<string, Rect>;
}

const MIRROR: Partial<Record<Dir8, Dir8>> = { w: 'e', e: 'w', sw: 'se', se: 'sw', nw: 'ne', ne: 'nw' };

/**
 * Palettentausch Weiß -> Schwarz: helle, ungesättigte Töne (Umhang, Leinen) werden
 * zu kühlem Anthrazit, Metall wird geschwärzt, Rot, Haut und Gold bleiben.
 * Die Helligkeitsreihenfolge bleibt erhalten, damit Schattierung lesbar bleibt.
 */
export function toBlackArmy(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  // Rote Töne (Wappen, Futter) und Haut/Gold behalten
  const isRed = r > g * 1.6 && r > b * 1.4 && s > 0.35;
  const isWarm = r > b + 25 && g > b + 10 && s > 0.3 && l < 0.75;
  if (isRed || isWarm) return [r, g, b];
  if (l > 0.5 && s < 0.45) {
    // Umhang: hell -> dunkel, Abstufung erhalten
    const nl = 0.1 + (l - 0.5) * 0.42;
    return hsl(262, 0.14, nl);
  }
  if (l > 0.18) {
    // Metall und Mittelton: geschwärzt, leicht kühl
    const nl = l * 0.62;
    return hsl(240, 0.08, nl);
  }
  return [Math.round(r * 0.8), Math.round(g * 0.8), Math.round(b * 0.85)];
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number] = [0, 0, 0];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [Math.round((rgb[0] + m) * 255), Math.round((rgb[1] + m) * 255), Math.round((rgb[2] + m) * 255)];
}

/** Lädt den Atlas, erzeugt Schwarz per Palettentausch und füllt fehlende Richtungen auf. */
export class AtlasSprites implements SpriteSource {
  private base = new Map<string, Frame>();
  private cache = new Map<string, Frame[]>();
  readonly kinds = new Set<PieceSymbol>();

  constructor(
    private fallback: SpriteSource,
    img?: HTMLImageElement,
    json?: AtlasJson,
  ) {
    if (img && json) this.ingest(img, json);
  }

  static async load(url: string, fallback: SpriteSource, onProgress?: (p: number) => void): Promise<AtlasSprites> {
    try {
      const json = (await (await fetch(url + '.json')).json()) as AtlasJson;
      onProgress?.(0.5);
      const img = await loadImage(url + '.png');
      onProgress?.(1);
      return new AtlasSprites(fallback, img, json);
    } catch {
      return new AtlasSprites(fallback);
    }
  }

  private ingest(img: HTMLImageElement, json: AtlasJson) {
    for (const [key, [x, y, w, h, ox, oy]] of Object.entries(json.frames)) {
      const c = makeCanvas(w, h);
      ctx2d(c).drawImage(img, x, y, w, h, 0, 0, w, h);
      const f: Frame = { img: c, w, h, ax: -ox, ay: -oy };
      this.base.set('w/' + key, f);
      this.base.set('b/' + key, recolor(f));
      this.kinds.add(key[0] as PieceSymbol);
    }
  }

  private lookup(side: Color, key: string): Frame | undefined {
    return this.base.get(side + '/' + key);
  }

  /** Bilder einer Animation in einer Richtung, sonst gespiegelt, sonst null. */
  private animFrames(kind: PieceSymbol, side: Color, anim: string, dir: Dir8, allowMirror = true): Frame[] | null {
    const direct: Frame[] = [];
    for (let i = 0; ; i++) {
      const f = this.lookup(side, `${kind}/${anim}/${dir}/${i}`);
      if (!f) break;
      direct.push(f);
    }
    if (direct.length) return direct;
    const m = MIRROR[dir];
    if (m && allowMirror) {
      const src = this.animFrames(kind, side, anim, m, false);
      if (src) return src.map(mirrorFrame);
    }
    return null;
  }

  frames(kind: PieceSymbol, side: Color, anim: AnimName, dir: Dir8): Frame[] {
    if (!this.kinds.has(kind)) return this.fallback.frames(kind, side, anim, dir);
    const key = `${kind}${side}${anim}${dir}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    let out = this.animFrames(kind, side, anim, dir);
    if (!out) out = [this.still(kind, side, dir)];
    this.cache.set(key, out);
    return out;
  }

  still(kind: PieceSymbol, side: Color, dir: Dir8): Frame {
    if (!this.kinds.has(kind)) return this.fallback.still(kind, side, dir);
    return this.lookup(side, `${kind}/rot/${dir}`) ?? this.lookup(side, `${kind}/rot/s`)!;
  }

  has(kind: PieceSymbol, anim: AnimName, dir: Dir8): boolean {
    return !!this.lookup('w', `${kind}/${anim}/${dir}/0`) || !!(MIRROR[dir] && this.lookup('w', `${kind}/${anim}/${MIRROR[dir]}/0`));
  }
}

function recolor(f: Frame): Frame {
  const c = makeCanvas(f.w, f.h);
  const g = ctx2d(c);
  g.drawImage(f.img, 0, 0);
  const d = g.getImageData(0, 0, f.w, f.h);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const [r, gg, b] = toBlackArmy(p[i], p[i + 1], p[i + 2]);
    p[i] = r;
    p[i + 1] = gg;
    p[i + 2] = b;
  }
  g.putImageData(d, 0, 0);
  return { ...f, img: c };
}
