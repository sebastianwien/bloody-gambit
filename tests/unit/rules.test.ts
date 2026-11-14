import { describe, expect, it } from 'vitest';
import { Rules, uciToMove, moveToUci } from '../../shared/rules.ts';
import { boardToScreen, screenToSquare, squareCenter } from '../../src/scene/iso.ts';

const play = (r: Rules, ...ucis: string[]) => {
  for (const u of ucis) expect(r.play(uciToMove(u)), u).not.toBeNull();
};

describe('Regeln', () => {
  it('lehnt illegale Züge ab, ohne zu werfen', () => {
    const r = new Rules();
    expect(r.play({ from: 'e2', to: 'e5' })).toBeNull();
    expect(r.play({ from: 'e7', to: 'e5' })).toBeNull();
    expect(r.play({ from: 'e2', to: 'e4' })).not.toBeNull();
  });

  it('kurze und lange Rochade', () => {
    const r = new Rules('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    const m = r.play({ from: 'e1', to: 'g1' })!;
    expect(m.isKingsideCastle()).toBe(true);
    expect(r.pieceAt('f1')?.type).toBe('r');
    const m2 = r.play({ from: 'e8', to: 'c8' })!;
    expect(m2.isQueensideCastle()).toBe(true);
    expect(r.pieceAt('d8')?.type).toBe('r');
  });

  it('keine Rochade durch ein bedrohtes Feld', () => {
    const r = new Rules('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1');
    expect(r.isLegal({ from: 'e1', to: 'g1' })).toBe(false);
  });

  it('en passant', () => {
    const r = new Rules();
    play(r, 'e2e4', 'a7a6', 'e4e5', 'd7d5');
    const m = r.play({ from: 'e5', to: 'd6' })!;
    expect(m.isEnPassant()).toBe(true);
    expect(r.pieceAt('d5')).toBeNull();
  });

  it('Umwandlung braucht eine Auswahl', () => {
    const r = new Rules('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    expect(r.needsPromotion('a7', 'a8')).toBe(true);
    expect(r.play({ from: 'a7', to: 'a8' })).toBeNull();
    const m = r.play({ from: 'a7', to: 'a8', promotion: 'n' })!;
    expect(m.promotion).toBe('n');
    expect(r.pieceAt('a8')?.type).toBe('n');
  });

  it('Schach und Matt', () => {
    const r = new Rules();
    play(r, 'f2f3', 'e7e5', 'g2g4');
    expect(r.end()).toBeNull();
    play(r, 'd8h4');
    expect(r.inCheck()).toBe(true);
    expect(r.end()).toEqual({ winner: 'b', reason: 'checkmate' });
  });

  it('Patt', () => {
    const r = new Rules('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(r.end()).toEqual({ winner: null, reason: 'stalemate' });
  });

  it('dreifache Wiederholung', () => {
    const r = new Rules();
    play(r, 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    expect(r.end()).toEqual({ winner: null, reason: 'threefold' });
  });

  it('50-Züge-Regel', () => {
    const r = new Rules('4k3/8/8/8/8/8/8/R3K3 w - - 99 80');
    play(r, 'a1a2');
    expect(r.end()).toEqual({ winner: null, reason: 'fifty' });
  });

  it('zu wenig Material', () => {
    expect(new Rules('4k3/8/8/8/8/8/8/4KB2 w - - 0 1').end()).toEqual({ winner: null, reason: 'insufficient' });
    expect(new Rules('4k3/8/8/8/8/8/8/4KR2 w - - 0 1').end()).toBeNull();
  });

  it('Verlauf als UCI speichern und wiederherstellen', () => {
    const r = new Rules();
    play(r, 'e2e4', 'e7e5', 'g1f3');
    const again = Rules.fromMoves(r.historyUci());
    expect(again.fen()).toBe(r.fen());
    expect(moveToUci({ from: 'a7', to: 'a8', promotion: 'q' })).toBe('a7a8q');
  });
});

describe('Isometrie', () => {
  it('Feld zu Bildschirm und zurück, beide Blickrichtungen', () => {
    for (const flipped of [false, true]) {
      for (const sq of ['a1', 'h1', 'a8', 'h8', 'e4', 'd5'] as const) {
        const p = squareCenter(sq, flipped);
        expect(screenToSquare(p.x, p.y, flipped)).toBe(sq);
      }
    }
  });

  it('Weiß unten: a1 vorne links, h1 vorne rechts, a8 hinten links', () => {
    const a1 = boardToScreen(0.5, 0.5, false);
    const h1 = boardToScreen(7.5, 0.5, false);
    const a8 = boardToScreen(0.5, 7.5, false);
    const h8 = boardToScreen(7.5, 7.5, false);
    expect(a1.x).toBeLessThan(h1.x);
    expect(a1.y).toBeCloseTo(h1.y);
    expect(a8.y).toBeLessThan(a1.y);
    // hintere Reihe schmaler (Perspektive)
    expect(h8.x - a8.x).toBeLessThan(h1.x - a1.x);
    // Schwarz unten: h8 vorne links
    expect(boardToScreen(7.5, 7.5, true).x).toBeCloseTo(a1.x);
  });
});
