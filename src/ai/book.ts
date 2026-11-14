/**
 * Kleines Eröffnungsbuch: bekannte Hauptlinien als UCI-Folgen.
 * Passt der bisherige Partieverlauf zum Anfang einer Linie, kommt der nächste Zug daraus.
 */
export const BOOK_LINES: string[] = [
  // Italienisch
  'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4 c3d4 c5b4',
  'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8c5 c2c3 d7d6 e1g1 e8g8',
  // Spanisch
  'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6',
  'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6',
  // Schottisch
  'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6 b7c6',
  // Sizilianisch
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6',
  'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5',
  'e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7',
  // Französisch, Caro-Kann, Skandinavisch
  'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7',
  'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6',
  'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6',
  // Damengambit, Slawisch
  'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8',
  'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5',
  'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6 f1c4 c7c5',
  // Indische Verteidigungen
  'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5',
  'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8',
  'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7 f1g2 f8e7',
  // Englisch, Réti
  'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5',
  'g1f3 d7d5 g2g3 g8f6 f1g2 c7c6 e1g1 c8g4',
];

export function bookMove(history: string[], random: () => number = Math.random): string | null {
  const candidates = new Map<string, number>();
  for (const line of BOOK_LINES) {
    const moves = line.split(' ');
    if (moves.length <= history.length) continue;
    let ok = true;
    for (let i = 0; i < history.length; i++) {
      if (moves[i] !== history[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      const next = moves[history.length];
      candidates.set(next, (candidates.get(next) ?? 0) + 1);
    }
  }
  if (!candidates.size) return null;
  const total = [...candidates.values()].reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (const [m, w] of candidates) {
    r -= w;
    if (r <= 0) return m;
  }
  return [...candidates.keys()][0];
}
