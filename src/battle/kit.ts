import type { PieceSymbol } from '../../shared/rules.ts';
import { mulberry32 } from '../util/random.ts';

/**
 * Kampf-Baukasten: Anlauf je Angreifer, Finisher je Paarung, Tod-Varianten je Opfer.
 * Reine Daten und Logik ohne Grafik, damit Vitest alle 30 Paarungen prüfen kann.
 * Die Bühne (battle/runner.ts) spielt die Schritte ab.
 */

export type Victim = Exclude<PieceSymbol, 'k'>;

export type DeathVariant =
  | 'fall' // kippt nach hinten um
  | 'behead' // Kopf fliegt
  | 'split' // in zwei Hälften
  | 'gib' // zerplatzt in Pixelbrocken
  | 'squash' // plattgedrückt
  | 'burn' // verkohlt und zerfällt zu Asche
  | 'pincushion' // mit Pfeilen gespickt, sinkt zusammen
  | 'crumble'; // Turm: stürzt ein

/** Welche Tode jedes Opfer sterben kann (2 bis 3). */
export const DEATHS: Record<Victim, DeathVariant[]> = {
  p: ['fall', 'behead', 'gib'],
  n: ['fall', 'split', 'gib'],
  b: ['fall', 'burn', 'behead'],
  r: ['crumble', 'gib'],
  q: ['fall', 'behead', 'split'],
};

export type Step =
  /** Angreifer läuft bis auf stop Felder an das Opfer heran (ist er schon näher, bleibt er stehen). */
  | { t: 'approach'; stop: number }
  /** Beide drehen sich zueinander. */
  | { t: 'face' }
  /** Angreifer spielt eine Animation (oder Ausfallschritt im Code, wenn keine Bilder da sind). */
  | { t: 'anim'; who: 'a' | 'v'; anim: 'attack' | 'hurt' | 'victory'; lunge?: number }
  /** Ausfallschritt Richtung Opfer und zurück (Pixel). */
  | { t: 'lunge'; px: number; dur: number }
  /** Treffer: Blitz, Wackeln, Blut. */
  | { t: 'hit'; blood: number; shake: number; sound: HitSound }
  /** Geschoss vom Angreifer zum Opfer. */
  | { t: 'projectile'; kind: 'arrow' | 'bolt' | 'spear'; count: number }
  /** Sprung über das Opfer (Springer). */
  | { t: 'leap'; height: number }
  /** Opfer stirbt. */
  | { t: 'death'; variant: DeathVariant }
  | { t: 'wait'; s: number }
  /** Kleine Geste nach dem Kampf. */
  | { t: 'gag'; gag: Gag }
  /** Angreifer geht auf das Zielfeld. */
  | { t: 'finish' };

export type HitSound = 'stab' | 'slash' | 'blunt' | 'magic' | 'arrow' | 'trample';
export type Gag = 'wipe' | 'shrug' | 'bless' | 'kickHelmet' | 'bow' | 'none';

export interface BattlePlan {
  attacker: PieceSymbol;
  victim: Victim;
  finisher: string;
  death: DeathVariant;
  steps: Step[];
}

interface Finisher {
  id: string;
  /** Bevorzugte Tode dieses Finishers; geschnitten mit den Toden des Opfers. */
  deaths: DeathVariant[];
  build(death: DeathVariant): Step[];
}

/** Ein allgemeiner Finisher je Angreifer: damit laufen alle 30 Paarungen sofort. */
const GENERIC: Record<PieceSymbol, Finisher> = {
  p: {
    id: 'speerstoss',
    deaths: ['fall', 'gib', 'behead'],
    build: (death) => [
      { t: 'approach', stop: 0.72 },
      { t: 'face' },
      { t: 'anim', who: 'a', anim: 'attack', lunge: 6 },
      { t: 'hit', blood: 10, shake: 2, sound: 'stab' },
      { t: 'lunge', px: 8, dur: 0.18 },
      { t: 'hit', blood: 18, shake: 4, sound: 'stab' },
      { t: 'death', variant: death },
      { t: 'gag', gag: 'shrug' },
    ],
  },
  n: {
    id: 'niederreiten',
    deaths: ['squash', 'gib', 'fall', 'split'],
    build: (death) => [
      { t: 'approach', stop: 1.1 },
      { t: 'face' },
      { t: 'leap', height: 30 },
      { t: 'hit', blood: 26, shake: 6, sound: 'trample' },
      { t: 'death', variant: death },
    ],
  },
  b: {
    id: 'heiliger-zorn',
    deaths: ['burn', 'gib', 'fall'],
    build: (death) => [
      { t: 'approach', stop: 1.7 },
      { t: 'face' },
      { t: 'anim', who: 'a', anim: 'attack' },
      { t: 'projectile', kind: 'bolt', count: 1 },
      { t: 'hit', blood: 8, shake: 5, sound: 'magic' },
      { t: 'death', variant: death },
      { t: 'gag', gag: 'bless' },
    ],
  },
  r: {
    id: 'pfeilhagel',
    deaths: ['pincushion', 'fall', 'crumble', 'gib'],
    build: (death) => [
      { t: 'approach', stop: 2.4 },
      { t: 'face' },
      { t: 'anim', who: 'a', anim: 'attack' },
      { t: 'projectile', kind: 'arrow', count: 3 },
      { t: 'hit', blood: 14, shake: 3, sound: 'arrow' },
      { t: 'death', variant: death },
    ],
  },
  q: {
    id: 'hellebardenschwung',
    deaths: ['behead', 'split', 'fall'],
    build: (death) => [
      { t: 'approach', stop: 0.85 },
      { t: 'face' },
      { t: 'anim', who: 'a', anim: 'attack', lunge: 4 },
      { t: 'hit', blood: 24, shake: 5, sound: 'slash' },
      { t: 'death', variant: death },
      { t: 'gag', gag: 'bow' },
    ],
  },
  k: {
    id: 'koenigshieb',
    deaths: ['split', 'behead', 'squash'],
    build: (death) => [
      { t: 'approach', stop: 0.75 },
      { t: 'face' },
      { t: 'wait', s: 0.25 },
      { t: 'anim', who: 'a', anim: 'attack', lunge: 5 },
      { t: 'hit', blood: 30, shake: 8, sound: 'slash' },
      { t: 'death', variant: death },
      { t: 'gag', gag: 'wipe' },
    ],
  },
};

/** Eigene Finisher für bestimmte Paarungen (Phase 10), Schlüssel "<angreifer><opfer>". */
export const CUSTOM: Partial<Record<string, Finisher>> = {};

export function registerCustom(attacker: PieceSymbol, victim: Victim, f: Finisher) {
  CUSTOM[attacker + victim] = f;
}

export function allPairings(): [PieceSymbol, Victim][] {
  const out: [PieceSymbol, Victim][] = [];
  for (const a of ['p', 'n', 'b', 'r', 'q', 'k'] as PieceSymbol[]) for (const v of ['p', 'n', 'b', 'r', 'q'] as Victim[]) out.push([a, v]);
  return out;
}

/**
 * Plant einen Kampf. Der Tod kommt aus der Schnittmenge von Finisher und Opfer,
 * sonst aus den Toden des Opfers. seed macht den Ablauf reproduzierbar.
 */
export function planBattle(attacker: PieceSymbol, victim: PieceSymbol, seed: number): BattlePlan {
  if (victim === 'k') throw new Error('Der König wird nie geschlagen');
  const v = victim as Victim;
  const rnd = mulberry32(seed);
  const f = CUSTOM[attacker + v] ?? GENERIC[attacker];
  let pool = f.deaths.filter((d) => DEATHS[v].includes(d));
  // Turm kann nur einstürzen oder zerplatzen; andere Opfer nie einstürzen
  if (!pool.length) pool = DEATHS[v];
  const death = pool[Math.floor(rnd() * pool.length)];
  return { attacker, victim: v, finisher: f.id, death, steps: f.build(death) };
}

export type BattleSetting = 'always' | 'new' | 'off';

/** Entscheidet, ob ein Kampf gezeigt wird; merkt sich gesehene Paarungen. */
export function shouldShowBattle(setting: BattleSetting, seen: Set<string>, attacker: PieceSymbol, victim: PieceSymbol): boolean {
  if (setting === 'off') return false;
  const key = attacker + victim;
  if (setting === 'new' && seen.has(key)) return false;
  seen.add(key);
  return true;
}

/** Grobe Dauer eines Plans in Sekunden (ohne Anlauf), für Tests und Online-Uhr. */
export function estimateDuration(plan: BattlePlan): number {
  let s = 0;
  for (const st of plan.steps) {
    switch (st.t) {
      case 'approach':
        s += 1;
        break;
      case 'anim':
        s += 0.8;
        break;
      case 'lunge':
        s += st.dur * 2;
        break;
      case 'hit':
        s += 0.15;
        break;
      case 'projectile':
        s += 0.45 * st.count;
        break;
      case 'leap':
        s += 0.8;
        break;
      case 'death':
        s += 1.4;
        break;
      case 'wait':
        s += st.s;
        break;
      case 'gag':
        s += 0.6;
        break;
      default:
        break;
    }
  }
  return s + 0.9;
}
