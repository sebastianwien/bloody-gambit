import { describe, expect, it } from 'vitest';
import { Rules, uciToMove } from '../../shared/rules.ts';
import { BOOK_LINES, bookMove } from '../../src/ai/book.ts';
import { Engine } from '../../src/ai/engine.ts';
import { chooseMove } from '../../src/ai/levels.ts';
import { mulberry32 } from '../../src/util/random.ts';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('Engine Zuggenerator (Perft)', () => {
  it('Grundstellung', () => {
    const e = new Engine();
    expect([1, 2, 3, 4].map((d) => e.perft(d))).toEqual([20, 400, 8902, 197281]);
  });

  it('Kiwipete (Rochaden, en passant, Umwandlung)', () => {
    const e = new Engine('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    expect([1, 2, 3].map((d) => e.perft(d))).toEqual([48, 2039, 97862]);
  });

  it('Stellung 3 (Fesselungen und en passant)', () => {
    const e = new Engine('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    expect([1, 2, 3, 4].map((d) => e.perft(d))).toEqual([14, 191, 2812, 43238]);
  });

  it('Stellung 4 (Umwandlungen, Schach)', () => {
    const e = new Engine('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
    expect([1, 2, 3].map((d) => e.perft(d))).toEqual([6, 264, 9467]);
  });

  it('Zugliste stimmt mit chess.js überein (zufällige Partie)', () => {
    const rnd = mulberry32(7);
    const r = new Rules();
    const e = new Engine();
    for (let i = 0; i < 120 && !r.end(); i++) {
      const a = r.allMoves().map((m) => m.from + m.to + (m.promotion ?? '')).sort();
      const b = e.legalMoves().map((m) => {
        const from = String.fromCharCode(97 + (m & 7)) + (((m >> 4) & 7) + 1);
        const to = String.fromCharCode(97 + ((m >> 7) & 7)) + (((m >> 11) & 7) + 1);
        const p = (m >> 14) & 7;
        return from + to + (p ? ' pnbrqk'[p] : '');
      }).sort();
      expect(b).toEqual(a);
      const pick = a[Math.floor(rnd() * a.length)];
      r.play(uciToMove(pick));
      expect(e.playUci(pick)).toBe(true);
    }
  });
});

describe('Suche', () => {
  it('findet Matt in eins', () => {
    const e = new Engine('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
    expect(e.think({ maxDepth: 4, timeMs: 1000 }).move).toBe('d1d8');
  });

  it('schlägt eine hängende Dame', () => {
    const e = new Engine('rnb1kbnr/pppp1ppp/8/4p1q1/4P3/3P4/PPP2PPP/RNBQKBNR w KQkq - 0 3');
    expect(e.think({ maxDepth: 4, timeMs: 1000 }).move).toBe('c1g5');
  });

  it('Hochmeister bleibt im Mittelspiel unter 2 s', () => {
    const fen = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 8';
    const t0 = Date.now();
    const m = chooseMove(fen, fen, [], 3);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(new Rules(fen).play(uciToMove(m!))).not.toBeNull();
  });

  it('alle Stufen liefern legale Züge', () => {
    const r = new Rules();
    for (const u of ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'f3g5']) r.play(uciToMove(u));
    for (const level of [1, 2, 3] as const) {
      const m = chooseMove(r.fen(), START, r.historyUci(), level, mulberry32(level));
      expect(r.isLegal(uciToMove(m!))).toBe(true);
    }
  });
});

describe('Eröffnungsbuch', () => {
  it('alle Linien sind legal', () => {
    for (const line of BOOK_LINES) {
      const r = new Rules();
      for (const u of line.split(' ')) expect(r.play(uciToMove(u)), line + ' ' + u).not.toBeNull();
    }
  });

  it('liefert Folgezüge passend zum Verlauf', () => {
    expect(['e2e4', 'd2d4', 'c2c4', 'g1f3']).toContain(bookMove([]));
    expect(bookMove(['e2e4', 'e7e5', 'g1f3'])).toBe('b8c6');
    expect(bookMove(['a2a3'])).toBeNull();
  });
});
