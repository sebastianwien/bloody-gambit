import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

export type { Color, Move, PieceSymbol, Square };

export type EndReason =
  | 'checkmate'
  | 'stalemate'
  | 'threefold'
  | 'fifty'
  | 'insufficient'
  | 'resign'
  | 'timeout'
  | 'agreement'
  | 'abandon';

export interface GameEnd {
  /** 'w' oder 'b' hat gewonnen, sonst Remis. */
  winner: Color | null;
  reason: EndReason;
}

/** Ein Zug in Kurzform (UCI-ähnlich), so wird gespeichert und übertragen. */
export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function moveToUci(m: MoveInput): string {
  return m.from + m.to + (m.promotion ?? '');
}

export function uciToMove(uci: string): MoveInput {
  const m: MoveInput = { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square };
  if (uci.length > 4) m.promotion = uci[4] as PieceSymbol;
  return m;
}

/**
 * Dünne Schicht über chess.js. Gleiche Klasse im Client und auf dem Server,
 * damit beide exakt dieselben Regeln anwenden.
 */
export class Rules {
  readonly chess: Chess;

  constructor(fen: string = START_FEN) {
    this.chess = new Chess(fen);
  }

  static fromMoves(moves: string[], fen: string = START_FEN): Rules {
    const r = new Rules(fen);
    for (const uci of moves) {
      if (!r.play(uciToMove(uci))) throw new Error('Ungültiger Zug in Verlauf: ' + uci);
    }
    return r;
  }

  turn(): Color {
    return this.chess.turn();
  }

  fen(): string {
    return this.chess.fen();
  }

  inCheck(): boolean {
    return this.chess.inCheck();
  }

  movesFrom(sq: Square): Move[] {
    return this.chess.moves({ square: sq, verbose: true });
  }

  allMoves(): Move[] {
    return this.chess.moves({ verbose: true });
  }

  /** True, wenn von->nach ein Bauernzug auf die letzte Reihe ist (Auswahl nötig). */
  needsPromotion(from: Square, to: Square): boolean {
    return this.movesFrom(from).some((m) => m.to === to && m.promotion);
  }

  isLegal(m: MoveInput): boolean {
    return this.movesFrom(m.from).some(
      (x) => x.to === m.to && (x.promotion ?? undefined) === (m.promotion ?? undefined),
    );
  }

  /** Führt den Zug aus, gibt null bei illegalem Zug zurück (wirft nie). */
  play(m: MoveInput): Move | null {
    if (!this.isLegal(m)) return null;
    try {
      return this.chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    } catch {
      return null;
    }
  }

  undo(): Move | null {
    return this.chess.undo();
  }

  history(): Move[] {
    return this.chess.history({ verbose: true });
  }

  historyUci(): string[] {
    return this.history().map((m) => moveToUci({ from: m.from, to: m.to, promotion: m.promotion }));
  }

  pieceAt(sq: Square) {
    return this.chess.get(sq) ?? null;
  }

  kingSquare(color: Color): Square | null {
    const sqs = this.chess.findPiece({ type: 'k', color });
    return sqs[0] ?? null;
  }

  /** Spielende nach Brettlage (Matt, Patt, Wiederholung, 50 Züge, Material). */
  end(): GameEnd | null {
    const c = this.chess;
    if (c.isCheckmate()) return { winner: c.turn() === 'w' ? 'b' : 'w', reason: 'checkmate' };
    if (c.isStalemate()) return { winner: null, reason: 'stalemate' };
    if (c.isInsufficientMaterial()) return { winner: null, reason: 'insufficient' };
    if (c.isThreefoldRepetition()) return { winner: null, reason: 'threefold' };
    if (c.isDrawByFiftyMoves()) return { winner: null, reason: 'fifty' };
    return null;
  }
}

export const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'Bauer',
  n: 'Springer',
  b: 'Läufer',
  r: 'Turm',
  q: 'Dame',
  k: 'König',
};

export const END_TEXT: Record<EndReason, string> = {
  checkmate: 'Schachmatt',
  stalemate: 'Patt',
  threefold: 'Dreifache Wiederholung',
  fifty: '50-Züge-Regel',
  insufficient: 'Zu wenig Material',
  resign: 'Aufgabe',
  timeout: 'Zeit abgelaufen',
  agreement: 'Remis vereinbart',
  abandon: 'Gegner nicht zurückgekehrt',
};
