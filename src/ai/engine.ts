/**
 * Eigene Schach-Engine für die KI: 0x88-Brett, Alpha-Beta mit Ruhesuche,
 * Transpositionstabelle, Zugsortierung (Tabelle, MVV-LVA, Killer, History),
 * iterative Vertiefung mit Zeitlimit. Unabhängig von chess.js, damit sie schnell ist;
 * die Perft-Tests prüfen sie gegen chess.js.
 */

export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const BLACK_BIT = 8;
const WHITE = 0, BLACK = 1;

const FLAG_CAPTURE = 1, FLAG_EP = 2, FLAG_CASTLE = 4, FLAG_DOUBLE = 8;

const N_DIRS = [33, 31, 18, 14, -33, -31, -18, -14];
const B_DIRS = [17, 15, -17, -15];
const R_DIRS = [16, -16, 1, -1];
const K_DIRS = [17, 15, -17, -15, 16, -16, 1, -1];

const VALUE = [0, 100, 320, 330, 500, 900, 0];
const PHASE = [0, 0, 1, 1, 2, 4, 0];

// Figurenfeld-Tabellen (Sicht Weiß, Zeile 0 = Reihe 8), nach "Simplified Evaluation Function".
const PST_P = [
  0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
];
const PST_N = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
];
const PST_B = [
  -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
];
const PST_R = [
  0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
];
const PST_Q = [
  -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
];
const PST_K_MID = [
  -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
];
const PST_K_END = [
  -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50,
];
const PST = [null, PST_P, PST_N, PST_B, PST_R, PST_Q, PST_K_MID];

/** Tabellenindex für ein 0x88-Feld aus Sicht der jeweiligen Farbe. */
function pstIndex(sq: number, color: number): number {
  const file = sq & 7;
  const rank = sq >> 4;
  return color === WHITE ? (7 - rank) * 8 + file : rank * 8 + file;
}

// Zobrist-Schlüssel (zwei 32-Bit-Hälften), deterministisch
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) | 0;
  };
}
const R = rng(20261114);
const Z_PIECE_LO = new Int32Array(16 * 128).map(() => R());
const Z_PIECE_HI = new Int32Array(16 * 128).map(() => R());
const Z_CASTLE_LO = new Int32Array(16).map(() => R());
const Z_CASTLE_HI = new Int32Array(16).map(() => R());
const Z_EP_LO = new Int32Array(128).map(() => R());
const Z_EP_HI = new Int32Array(128).map(() => R());
const Z_SIDE_LO = R();
const Z_SIDE_HI = R();

const CASTLE_MASK = new Int32Array(128).fill(15);
CASTLE_MASK[4] = 15 & ~3;
CASTLE_MASK[7] = 15 & ~1;
CASTLE_MASK[0] = 15 & ~2;
CASTLE_MASK[116] = 15 & ~12;
CASTLE_MASK[119] = 15 & ~4;
CASTLE_MASK[112] = 15 & ~8;

export const MATE = 100000;
const INF = 1000000;

export function sqName(sq: number): string {
  return String.fromCharCode(97 + (sq & 7)) + String((sq >> 4) + 1);
}
export function sqIndex(name: string): number {
  return (name.charCodeAt(1) - 49) * 16 + (name.charCodeAt(0) - 97);
}

export const mFrom = (m: number) => m & 127;
export const mTo = (m: number) => (m >> 7) & 127;
export const mPromo = (m: number) => (m >> 14) & 7;
export const mFlags = (m: number) => (m >> 17) & 15;
const mk = (from: number, to: number, promo: number, flags: number) => from | (to << 7) | (promo << 14) | (flags << 17);

export function moveToUci(m: number): string {
  const p = mPromo(m);
  return sqName(mFrom(m)) + sqName(mTo(m)) + (p ? ' pnbrqk'[p] : '');
}

interface Undo {
  move: number;
  captured: number;
  castle: number;
  ep: number;
  half: number;
  hlo: number;
  hhi: number;
}

export interface SearchOptions {
  maxDepth: number;
  timeMs: number;
  /** Zufallsrauschen in Centipawn auf die Wurzelzüge (schwächere Stufen). */
  noise?: number;
  random?: () => number;
}

export interface SearchResult {
  move: string | null;
  score: number;
  depth: number;
  nodes: number;
}

export class Engine {
  board = new Int8Array(128);
  side = WHITE;
  castle = 0;
  ep = -1;
  half = 0;
  kings = [4, 116];
  hlo = 0;
  hhi = 0;
  private stack: Undo[] = [];
  /** Hash-Verlauf für Wiederholungserkennung. */
  private hist: number[] = [];
  nodes = 0;
  private stopAt = 0;
  private aborted = false;
  private killers = new Int32Array(128 * 2);
  private history = new Int32Array(16 * 128);
  // Transpositionstabelle
  private readonly ttSize = 1 << 18;
  private ttLo = new Int32Array(this.ttSize);
  private ttHi = new Int32Array(this.ttSize);
  private ttMove = new Int32Array(this.ttSize);
  private ttScore = new Int32Array(this.ttSize);
  private ttDepth = new Int8Array(this.ttSize);
  private ttFlag = new Int8Array(this.ttSize);

  constructor(fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
    this.setFen(fen);
  }

  setFen(fen: string) {
    this.board.fill(0);
    const [pos, side, castle, ep, half] = fen.split(' ');
    let rank = 7;
    let file = 0;
    for (const ch of pos) {
      if (ch === '/') {
        rank--;
        file = 0;
      } else if (ch >= '1' && ch <= '8') file += Number(ch);
      else {
        const lower = ch.toLowerCase();
        const type = 'pnbrqk'.indexOf(lower) + 1;
        const color = ch === lower ? BLACK_BIT : 0;
        const sq = rank * 16 + file;
        this.board[sq] = type | color;
        if (type === KING) this.kings[color ? 1 : 0] = sq;
        file++;
      }
    }
    this.side = side === 'b' ? BLACK : WHITE;
    this.castle = (castle.includes('K') ? 1 : 0) | (castle.includes('Q') ? 2 : 0) | (castle.includes('k') ? 4 : 0) | (castle.includes('q') ? 8 : 0);
    this.ep = ep && ep !== '-' ? sqIndex(ep) : -1;
    this.half = Number(half ?? 0) || 0;
    this.stack = [];
    this.computeHash();
    this.hist = [this.hlo];
  }

  private computeHash() {
    let lo = 0;
    let hi = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      const p = this.board[sq];
      if (p) {
        lo ^= Z_PIECE_LO[p * 128 + sq];
        hi ^= Z_PIECE_HI[p * 128 + sq];
      }
    }
    lo ^= Z_CASTLE_LO[this.castle];
    hi ^= Z_CASTLE_HI[this.castle];
    if (this.ep >= 0) {
      lo ^= Z_EP_LO[this.ep];
      hi ^= Z_EP_HI[this.ep];
    }
    if (this.side === BLACK) {
      lo ^= Z_SIDE_LO;
      hi ^= Z_SIDE_HI;
    }
    this.hlo = lo;
    this.hhi = hi;
  }

  /** Spielt einen Zug in UCI-Schreibweise (für den Partieverlauf). */
  playUci(uci: string): boolean {
    const moves = this.legalMoves();
    const m = moves.find((x) => moveToUci(x) === uci);
    if (m === undefined) return false;
    this.make(m);
    return true;
  }

  attacked(sq: number, by: number): boolean {
    const b = this.board;
    const col = by === WHITE ? 0 : BLACK_BIT;
    // Bauern
    if (by === WHITE) {
      const a = sq - 15, c = sq - 17;
      if (!(a & 0x88) && b[a] === (PAWN | col)) return true;
      if (!(c & 0x88) && b[c] === (PAWN | col)) return true;
    } else {
      const a = sq + 15, c = sq + 17;
      if (!(a & 0x88) && b[a] === (PAWN | col)) return true;
      if (!(c & 0x88) && b[c] === (PAWN | col)) return true;
    }
    for (const d of N_DIRS) {
      const t = sq + d;
      if (!(t & 0x88) && b[t] === (KNIGHT | col)) return true;
    }
    for (const d of K_DIRS) {
      const t = sq + d;
      if (!(t & 0x88) && b[t] === (KING | col)) return true;
    }
    for (const d of B_DIRS) {
      let t = sq + d;
      while (!(t & 0x88)) {
        const p = b[t];
        if (p) {
          if (p === (BISHOP | col) || p === (QUEEN | col)) return true;
          break;
        }
        t += d;
      }
    }
    for (const d of R_DIRS) {
      let t = sq + d;
      while (!(t & 0x88)) {
        const p = b[t];
        if (p) {
          if (p === (ROOK | col) || p === (QUEEN | col)) return true;
          break;
        }
        t += d;
      }
    }
    return false;
  }

  inCheck(side = this.side): boolean {
    return this.attacked(this.kings[side], side ^ 1);
  }

  /** Pseudo-legale Züge; mit capturesOnly nur Schlagzüge und Umwandlungen. */
  gen(out: number[], capturesOnly = false) {
    const b = this.board;
    const us = this.side;
    const col = us === WHITE ? 0 : BLACK_BIT;
    const them = col ^ BLACK_BIT;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = b[sq];
      if (!p || (p & BLACK_BIT) !== col) continue;
      const type = p & 7;
      if (type === PAWN) {
        const fwd = us === WHITE ? 16 : -16;
        const startRank = us === WHITE ? 1 : 6;
        const promoRank = us === WHITE ? 7 : 0;
        const t = sq + fwd;
        if (!(t & 0x88) && !b[t]) {
          if (t >> 4 === promoRank) {
            for (const pr of [QUEEN, KNIGHT, ROOK, BISHOP]) out.push(mk(sq, t, pr, 0));
          } else if (!capturesOnly) {
            out.push(mk(sq, t, 0, 0));
            const t2 = t + fwd;
            if (sq >> 4 === startRank && !b[t2]) out.push(mk(sq, t2, 0, FLAG_DOUBLE));
          }
        }
        for (const dc of [fwd - 1, fwd + 1]) {
          const c = sq + dc;
          if (c & 0x88) continue;
          if (b[c] && (b[c] & BLACK_BIT) === them) {
            if (c >> 4 === promoRank) for (const pr of [QUEEN, KNIGHT, ROOK, BISHOP]) out.push(mk(sq, c, pr, FLAG_CAPTURE));
            else out.push(mk(sq, c, 0, FLAG_CAPTURE));
          } else if (c === this.ep) out.push(mk(sq, c, 0, FLAG_CAPTURE | FLAG_EP));
        }
        continue;
      }
      if (type === KNIGHT || type === KING) {
        const dirs = type === KNIGHT ? N_DIRS : K_DIRS;
        for (const d of dirs) {
          const t = sq + d;
          if (t & 0x88) continue;
          const q = b[t];
          if (!q) {
            if (!capturesOnly) out.push(mk(sq, t, 0, 0));
          } else if ((q & BLACK_BIT) === them) out.push(mk(sq, t, 0, FLAG_CAPTURE));
        }
        if (type === KING && !capturesOnly) this.genCastles(out, sq);
        continue;
      }
      const dirs = type === BISHOP ? B_DIRS : type === ROOK ? R_DIRS : K_DIRS;
      for (const d of dirs) {
        let t = sq + d;
        while (!(t & 0x88)) {
          const q = b[t];
          if (!q) {
            if (!capturesOnly) out.push(mk(sq, t, 0, 0));
          } else {
            if ((q & BLACK_BIT) === them) out.push(mk(sq, t, 0, FLAG_CAPTURE));
            break;
          }
          t += d;
        }
      }
    }
  }

  private genCastles(out: number[], sq: number) {
    const b = this.board;
    const us = this.side;
    const them = us ^ 1;
    if (us === WHITE && sq === 4) {
      if (this.castle & 1 && !b[5] && !b[6] && b[7] === ROOK && !this.attacked(4, them) && !this.attacked(5, them) && !this.attacked(6, them))
        out.push(mk(4, 6, 0, FLAG_CASTLE));
      if (this.castle & 2 && !b[3] && !b[2] && !b[1] && b[0] === ROOK && !this.attacked(4, them) && !this.attacked(3, them) && !this.attacked(2, them))
        out.push(mk(4, 2, 0, FLAG_CASTLE));
    } else if (us === BLACK && sq === 116) {
      const r = ROOK | BLACK_BIT;
      if (this.castle & 4 && !b[117] && !b[118] && b[119] === r && !this.attacked(116, them) && !this.attacked(117, them) && !this.attacked(118, them))
        out.push(mk(116, 118, 0, FLAG_CASTLE));
      if (this.castle & 8 && !b[115] && !b[114] && !b[113] && b[112] === r && !this.attacked(116, them) && !this.attacked(115, them) && !this.attacked(114, them))
        out.push(mk(116, 114, 0, FLAG_CASTLE));
    }
  }

  private xorPiece(p: number, sq: number) {
    this.hlo ^= Z_PIECE_LO[p * 128 + sq];
    this.hhi ^= Z_PIECE_HI[p * 128 + sq];
  }

  /** Führt einen pseudo-legalen Zug aus. Gibt false zurück (und nimmt zurück), wenn der eigene König im Schach steht. */
  make(m: number): boolean {
    const b = this.board;
    const from = mFrom(m);
    const to = mTo(m);
    const promo = mPromo(m);
    const flags = mFlags(m);
    const piece = b[from];
    const us = this.side;
    let captured = b[to];
    this.stack.push({ move: m, captured, castle: this.castle, ep: this.ep, half: this.half, hlo: this.hlo, hhi: this.hhi });

    if (flags & FLAG_EP) {
      const capSq = to + (us === WHITE ? -16 : 16);
      captured = b[capSq];
      this.stack[this.stack.length - 1].captured = captured;
      b[capSq] = 0;
      this.xorPiece(captured, capSq);
    } else if (captured) {
      this.xorPiece(captured, to);
    }
    this.xorPiece(piece, from);
    const placed = promo ? promo | (piece & BLACK_BIT) : piece;
    b[to] = placed;
    b[from] = 0;
    this.xorPiece(placed, to);

    if (flags & FLAG_CASTLE) {
      let rf = 0, rt = 0;
      if (to === 6) (rf = 7), (rt = 5);
      else if (to === 2) (rf = 0), (rt = 3);
      else if (to === 118) (rf = 119), (rt = 117);
      else (rf = 112), (rt = 115);
      const rook = b[rf];
      b[rt] = rook;
      b[rf] = 0;
      this.xorPiece(rook, rf);
      this.xorPiece(rook, rt);
    }
    if ((piece & 7) === KING) this.kings[us] = to;

    if (this.ep >= 0) {
      this.hlo ^= Z_EP_LO[this.ep];
      this.hhi ^= Z_EP_HI[this.ep];
    }
    this.ep = flags & FLAG_DOUBLE ? (from + to) >> 1 : -1;
    if (this.ep >= 0) {
      this.hlo ^= Z_EP_LO[this.ep];
      this.hhi ^= Z_EP_HI[this.ep];
    }
    this.hlo ^= Z_CASTLE_LO[this.castle];
    this.hhi ^= Z_CASTLE_HI[this.castle];
    this.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    this.hlo ^= Z_CASTLE_LO[this.castle];
    this.hhi ^= Z_CASTLE_HI[this.castle];
    this.half = (piece & 7) === PAWN || captured ? 0 : this.half + 1;
    this.side ^= 1;
    this.hlo ^= Z_SIDE_LO;
    this.hhi ^= Z_SIDE_HI;
    this.hist.push(this.hlo);

    if (this.attacked(this.kings[us], us ^ 1)) {
      this.unmake();
      return false;
    }
    return true;
  }

  unmake() {
    const u = this.stack.pop()!;
    this.hist.pop();
    const b = this.board;
    this.side ^= 1;
    const us = this.side;
    const m = u.move;
    const from = mFrom(m);
    const to = mTo(m);
    const flags = mFlags(m);
    const placed = b[to];
    const piece = mPromo(m) ? PAWN | (placed & BLACK_BIT) : placed;
    b[from] = piece;
    if (flags & FLAG_EP) {
      b[to] = 0;
      b[to + (us === WHITE ? -16 : 16)] = u.captured;
    } else b[to] = u.captured;
    if (flags & FLAG_CASTLE) {
      let rf = 0, rt = 0;
      if (to === 6) (rf = 7), (rt = 5);
      else if (to === 2) (rf = 0), (rt = 3);
      else if (to === 118) (rf = 119), (rt = 117);
      else (rf = 112), (rt = 115);
      b[rf] = b[rt];
      b[rt] = 0;
    }
    if ((piece & 7) === KING) this.kings[us] = from;
    this.castle = u.castle;
    this.ep = u.ep;
    this.half = u.half;
    this.hlo = u.hlo;
    this.hhi = u.hhi;
  }

  legalMoves(): number[] {
    const list: number[] = [];
    this.gen(list);
    const legal: number[] = [];
    for (const m of list) {
      if (this.make(m)) {
        legal.push(m);
        this.unmake();
      }
    }
    return legal;
  }

  perft(depth: number): number {
    if (depth === 0) return 1;
    const list: number[] = [];
    this.gen(list);
    let n = 0;
    for (const m of list) {
      if (!this.make(m)) continue;
      n += this.perft(depth - 1);
      this.unmake();
    }
    return n;
  }

  /** Bewertung aus Sicht der Seite am Zug. */
  evaluate(): number {
    const b = this.board;
    let mid = 0;
    let end = 0;
    let phase = 0;
    let bishops0 = 0, bishops1 = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = b[sq];
      if (!p) continue;
      const type = p & 7;
      const color = p & BLACK_BIT ? BLACK : WHITE;
      const sign = color === WHITE ? 1 : -1;
      const idx = pstIndex(sq, color);
      phase += PHASE[type];
      if (type === KING) {
        mid += sign * PST_K_MID[idx];
        end += sign * PST_K_END[idx];
      } else {
        const v = VALUE[type] + PST[type]![idx];
        mid += sign * v;
        end += sign * (type === PAWN ? v + ((color === WHITE ? sq >> 4 : 7 - (sq >> 4)) * 8) : v);
        if (type === BISHOP) color === WHITE ? bishops0++ : bishops1++;
      }
    }
    if (bishops0 >= 2) (mid += 30), (end += 40);
    if (bishops1 >= 2) (mid -= 30), (end -= 40);
    const ph = Math.min(24, phase);
    const score = Math.round((mid * ph + end * (24 - ph)) / 24);
    return this.side === WHITE ? score : -score;
  }

  private isRepetition(): boolean {
    const n = this.hist.length;
    const key = this.hlo;
    const limit = Math.max(0, n - 1 - this.half);
    for (let i = n - 3; i >= limit; i -= 2) if (this.hist[i] === key) return true;
    return false;
  }

  private orderScore(m: number, ttMove: number, ply: number): number {
    if (m === ttMove) return 10_000_000;
    const flags = mFlags(m);
    if (flags & FLAG_CAPTURE) {
      const victim = flags & FLAG_EP ? PAWN : this.board[mTo(m)] & 7;
      const attacker = this.board[mFrom(m)] & 7;
      return 1_000_000 + victim * 100 - attacker;
    }
    if (mPromo(m)) return 900_000 + mPromo(m);
    if (this.killers[ply * 2] === m) return 800_000;
    if (this.killers[ply * 2 + 1] === m) return 700_000;
    return this.history[(this.board[mFrom(m)] & 15) * 128 + mTo(m)];
  }

  private sortMoves(list: number[], ttMove: number, ply: number) {
    const scores = list.map((m) => this.orderScore(m, ttMove, ply));
    const idx = list.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
    const copy = idx.map((i) => list[i]);
    for (let i = 0; i < list.length; i++) list[i] = copy[i];
  }

  private timeUp(): boolean {
    if ((this.nodes & 1023) === 0 && Date.now() > this.stopAt) this.aborted = true;
    return this.aborted;
  }

  private quiesce(alpha: number, beta: number, ply: number): number {
    this.nodes++;
    if (this.timeUp()) return 0;
    const stand = this.evaluate();
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (ply > 60) return stand;
    const list: number[] = [];
    this.gen(list, true);
    this.sortMoves(list, 0, Math.min(ply, 127));
    for (const m of list) {
      if (!this.make(m)) continue;
      const s = -this.quiesce(-beta, -alpha, ply + 1);
      this.unmake();
      if (this.aborted) return 0;
      if (s >= beta) return beta;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }

  private search(depth: number, alpha: number, beta: number, ply: number): number {
    this.nodes++;
    if (this.timeUp()) return 0;
    if (ply > 0 && (this.half >= 100 || this.isRepetition())) return 0;
    const check = this.inCheck();
    if (check) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);

    const ti = this.hlo & (this.ttSize - 1);
    let ttMove = 0;
    if (this.ttLo[ti] === this.hlo && this.ttHi[ti] === this.hhi) {
      ttMove = this.ttMove[ti];
      if (ply > 0 && this.ttDepth[ti] >= depth) {
        let s = this.ttScore[ti];
        if (s > MATE - 1000) s -= ply;
        else if (s < -MATE + 1000) s += ply;
        const f = this.ttFlag[ti];
        if (f === 0) return s;
        if (f === 1 && s >= beta) return s;
        if (f === 2 && s <= alpha) return s;
      }
    }

    const list: number[] = [];
    this.gen(list);
    this.sortMoves(list, ttMove, Math.min(ply, 127));
    let legal = 0;
    let best = -INF;
    let bestMove = 0;
    const alpha0 = alpha;
    for (const m of list) {
      if (!this.make(m)) continue;
      legal++;
      let s: number;
      if (legal === 1) s = -this.search(depth - 1, -beta, -alpha, ply + 1);
      else {
        // Nullfenster-Suche, bei Überraschung voll
        s = -this.search(depth - 1, -alpha - 1, -alpha, ply + 1);
        if (s > alpha && s < beta) s = -this.search(depth - 1, -beta, -alpha, ply + 1);
      }
      this.unmake();
      if (this.aborted) return 0;
      if (s > best) {
        best = s;
        bestMove = m;
      }
      if (s > alpha) alpha = s;
      if (alpha >= beta) {
        if (!(mFlags(m) & FLAG_CAPTURE)) {
          const k = Math.min(ply, 127) * 2;
          if (this.killers[k] !== m) {
            this.killers[k + 1] = this.killers[k];
            this.killers[k] = m;
          }
          this.history[(this.board[mFrom(m)] & 15) * 128 + mTo(m)] += depth * depth;
        }
        break;
      }
    }
    if (!legal) return check ? -MATE + ply : 0;

    let store = best;
    if (store > MATE - 1000) store += ply;
    else if (store < -MATE + 1000) store -= ply;
    this.ttLo[ti] = this.hlo;
    this.ttHi[ti] = this.hhi;
    this.ttMove[ti] = bestMove;
    this.ttScore[ti] = store;
    this.ttDepth[ti] = depth;
    this.ttFlag[ti] = best >= beta ? 1 : best <= alpha0 ? 2 : 0;
    return best;
  }

  /** Bester Zug mit iterativer Vertiefung. */
  think(opts: SearchOptions): SearchResult {
    const start = Date.now();
    this.stopAt = start + opts.timeMs;
    this.aborted = false;
    this.nodes = 0;
    this.killers.fill(0);
    this.history.fill(0);
    const root = this.legalMoves();
    if (!root.length) return { move: null, score: this.inCheck() ? -MATE : 0, depth: 0, nodes: 0 };
    if (root.length === 1) return { move: moveToUci(root[0]), score: 0, depth: 0, nodes: 0 };

    const random = opts.random ?? Math.random;
    let bestMove = root[0];
    let bestScore = -INF;
    let doneDepth = 0;
    let scores = new Map<number, number>();
    for (let depth = 1; depth <= opts.maxDepth; depth++) {
      const cur = new Map<number, number>();
      // Bester Zug der letzten Tiefe zuerst
      root.sort((a, b) => (scores.get(b) ?? -INF) - (scores.get(a) ?? -INF));
      let alpha = -INF;
      let iterBest = root[0];
      let iterScore = -INF;
      for (const m of root) {
        this.make(m);
        // Mit Rauschen braucht jede Wurzel einen genauen Wert, sonst reicht Alpha-Beta
        const s = opts.noise ? -this.search(depth - 1, -INF, INF, 1) : -this.search(depth - 1, -INF, -alpha, 1);
        this.unmake();
        if (this.aborted) break;
        cur.set(m, s);
        if (s > iterScore) {
          iterScore = s;
          iterBest = m;
        }
        if (s > alpha) alpha = s;
      }
      if (this.aborted && depth > 1) break;
      scores = cur;
      bestMove = iterBest;
      bestScore = iterScore;
      doneDepth = depth;
      if (Math.abs(bestScore) > MATE - 1000) break;
      // Weitere Tiefe nur, wenn die Zeit wahrscheinlich reicht
      if (Date.now() - start > opts.timeMs * 0.45) break;
    }
    if (opts.noise && scores.size) {
      let pick = bestMove;
      let pickScore = -INF;
      for (const [m, s] of scores) {
        // Matt nie übersehen, sonst verrauschen
        const n = Math.abs(s) > MATE - 1000 ? s : s + (random() * 2 - 1) * opts.noise;
        if (n > pickScore) {
          pickScore = n;
          pick = m;
        }
      }
      bestMove = pick;
    }
    return { move: moveToUci(bestMove), score: bestScore, depth: doneDepth, nodes: this.nodes };
  }
}
