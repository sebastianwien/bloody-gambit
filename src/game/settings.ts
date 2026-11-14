import type { BattleSetting } from '../battle/kit.ts';
import type { AiLevel } from '../ai/levels.ts';
import type { GameSetup } from './controller.ts';

export interface Settings {
  music: number;
  sfx: number;
  battles: BattleSetting;
  gore: boolean;
  aiLevel: AiLevel;
  hints: boolean;
  /** Bereits gesehene Paarungen (für "nur neue Paarungen"). */
  seen: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  music: 0.6,
  sfx: 0.8,
  battles: 'always',
  gore: true,
  aiLevel: 2,
  hints: true,
  seen: [],
};

const KEY = 'bloodygambit.settings.v1';
const SAVE_KEY = 'bloodygambit.save.v1';

/** Alle Zugriffe auf den Browser-Speicher sind abgesichert (privater Modus, gesperrter Speicher). */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ohne Speicher spielbar */
  }
}

export function loadSettings(): Settings {
  const raw = read(KEY);
  if (!raw) return { ...DEFAULT_SETTINGS, seen: [] };
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS, seen: [] };
  }
}

export function sanitize(x: Partial<Settings>): Settings {
  const clamp = (v: unknown, d: number) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
  return {
    music: clamp(x.music, DEFAULT_SETTINGS.music),
    sfx: clamp(x.sfx, DEFAULT_SETTINGS.sfx),
    battles: x.battles === 'new' || x.battles === 'off' ? x.battles : 'always',
    gore: x.gore !== false,
    aiLevel: x.aiLevel === 1 || x.aiLevel === 3 ? x.aiLevel : 2,
    hints: x.hints !== false,
    seen: Array.isArray(x.seen) ? x.seen.filter((s) => typeof s === 'string' && s.length === 2).slice(0, 30) : [],
  };
}

export function saveSettings(s: Settings) {
  write(KEY, JSON.stringify(s));
}

/** Gespeicherte Partie gegen KI oder lokal. */
export interface SavedGame {
  setup: GameSetup;
  moves: string[];
  savedAt: number;
}

export function loadGame(): SavedGame | null {
  const raw = read(SAVE_KEY);
  if (!raw) return null;
  try {
    const g = JSON.parse(raw) as SavedGame;
    if (!g?.setup || !Array.isArray(g.moves) || g.setup.mode === 'online') return null;
    return g;
  } catch {
    return null;
  }
}

export function saveGame(g: SavedGame | null) {
  write(SAVE_KEY, g ? JSON.stringify(g) : null);
}
