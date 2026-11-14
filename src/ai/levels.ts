import { bookMove } from './book.ts';
import { Engine, type SearchOptions } from './engine.ts';

export type AiLevel = 1 | 2 | 3;

export const LEVEL_NAMES: Record<AiLevel, string> = {
  1: 'Knappe',
  2: 'Ritter',
  3: 'Hochmeister',
};

export const LEVEL_TEXT: Record<AiLevel, string> = {
  1: 'Macht Fehler, gut zum Lernen',
  2: 'Solide, bestraft grobe Patzer',
  3: 'Rechnet tief, kaum zu schlagen',
};

/** Suchparameter je Stufe. Alle bleiben unter 2 s je Zug. */
export const LEVEL_SEARCH: Record<AiLevel, SearchOptions> = {
  1: { maxDepth: 2, timeMs: 300, noise: 140 },
  2: { maxDepth: 4, timeMs: 800, noise: 18 },
  3: { maxDepth: 30, timeMs: 1600 },
};

/** Wählt einen Zug: Buch (Stufe 2 und 3, Stufe 1 nur selten), sonst Suche. */
export function chooseMove(fen: string, startFen: string, history: string[], level: AiLevel, random: () => number = Math.random): string | null {
  const useBook = level > 1 || random() < 0.5;
  if (useBook && startFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w')) {
    const b = bookMove(history, random);
    if (b) return b;
  }
  const e = new Engine(startFen);
  for (const m of history) {
    if (!e.playUci(m)) {
      // Verlauf passt nicht (sollte nicht vorkommen): direkt aus der Stellung
      e.setFen(fen);
      break;
    }
  }
  return e.think({ ...LEVEL_SEARCH[level], random }).move;
}
