import {
  Rules,
  moveToUci,
  type Color,
  type GameEnd,
  type Move,
  type MoveInput,
  type PieceSymbol,
  type Square,
} from '../../shared/rules.ts';
import type { Director } from '../scene/director.ts';
import type { Mark, Stage } from '../scene/stage.ts';

export type PlayerKind = 'human' | 'ai' | 'remote';
export type GameMode = 'ai' | 'local' | 'online';

export interface GameSetup {
  mode: GameMode;
  players: Record<Color, PlayerKind>;
  aiLevel: 1 | 2 | 3;
  /** Welche Farbe unten sitzt. */
  bottom: Color;
  moves?: string[];
}

export interface ControllerEvents {
  moved?(move: Move, rules: Rules): void;
  turn?(rules: Rules): void;
  ended?(end: GameEnd, rules: Rules): void;
  /** Fragt den Spieler nach der Umwandlungsfigur. */
  choosePromotion?(color: Color): Promise<PieceSymbol | null>;
  /** Lokaler Zug, bevor er abgespielt wird (Online: an den Server schicken). */
  localMove?(m: MoveInput): void;
  /** Animation eines Zuges beginnt oder endet (Uhren, Online-Pause). */
  animating?(on: boolean): void;
}

/** Ein Zugwunsch, den ein Spieler abgibt; die KI ist ein Anbieter. */
export interface MoveProvider {
  request(rules: Rules, color: Color): Promise<MoveInput | null>;
  cancel?(): void;
}

/**
 * Hält die Partie: Regeln, Auswahl per Klick, Zugfolge zwischen Mensch, KI und Gegenseite.
 * Die Darstellung übernimmt der Director, Menüs hören über events mit.
 */
export class GameController {
  rules: Rules;
  selected: Square | null = null;
  hover: Square | null = null;
  busy = false;
  end: GameEnd | null = null;
  showHints = true;
  events: ControllerEvents = {};
  ai: MoveProvider | null = null;
  private queue: Promise<void> = Promise.resolve();
  private aiToken = 0;
  /** Ersetzt die automatische Spielende-Erkennung (Online: Server entscheidet). */
  externalEnd = false;

  constructor(
    readonly setup: GameSetup,
    readonly stage: Stage,
    readonly director: Director,
  ) {
    this.rules = Rules.fromMoves(setup.moves ?? []);
    stage.flipped = setup.bottom === 'b';
  }

  start() {
    this.syncActors();
    this.refreshMarks();
    this.events.turn?.(this.rules);
    this.end = this.externalEnd ? null : this.rules.end();
    if (this.end) this.events.ended?.(this.end, this.rules);
    else this.maybeAi();
  }

  isHumanTurn(): boolean {
    return !this.end && !this.busy && this.setup.players[this.rules.turn()] === 'human';
  }

  syncActors() {
    const pieces: { sq: Square; type: PieceSymbol; color: Color }[] = [];
    for (const row of this.rules.chess.board()) for (const p of row) if (p) pieces.push({ sq: p.square, type: p.type, color: p.color });
    this.director.setup(pieces);
  }

  /** Klick auf ein Feld (oder null daneben). */
  async click(sq: Square | null) {
    if (!this.isHumanTurn()) return;
    if (!sq) {
      this.selected = null;
      this.refreshMarks();
      return;
    }
    const piece = this.rules.pieceAt(sq);
    const turn = this.rules.turn();
    if (this.selected) {
      const legal = this.rules.movesFrom(this.selected).filter((m) => m.to === sq);
      if (legal.length) {
        const from = this.selected;
        let promotion: PieceSymbol | undefined;
        if (legal.some((m) => m.promotion)) {
          const choice = this.events.choosePromotion ? await this.events.choosePromotion(turn) : 'q';
          if (!choice) return;
          promotion = choice;
        }
        this.selected = null;
        await this.submit({ from, to: sq, promotion });
        return;
      }
    }
    if (piece && piece.color === turn) this.selected = this.selected === sq ? null : sq;
    else this.selected = null;
    this.refreshMarks();
  }

  setHover(sq: Square | null) {
    if (sq === this.hover) return;
    this.hover = sq;
    this.refreshMarks();
  }

  /** Lokaler Zug des Menschen. */
  async submit(m: MoveInput): Promise<boolean> {
    if (!this.rules.isLegal(m)) return false;
    this.events.localMove?.(m);
    await this.apply(m);
    return true;
  }

  /** Zug von außen (KI, Gegenseite, Wiederherstellung). Wird nacheinander abgespielt. */
  apply(m: MoveInput): Promise<void> {
    this.queue = this.queue.then(() => this.applyNow(m));
    return this.queue;
  }

  private async applyNow(m: MoveInput) {
    const move = this.rules.play(m);
    if (!move) return;
    this.busy = true;
    this.selected = null;
    this.refreshMarks(true);
    this.events.animating?.(true);
    try {
      await this.director.play(move);
    } finally {
      this.events.animating?.(false);
      this.busy = false;
    }
    this.events.moved?.(move, this.rules);
    this.refreshMarks();
    if (!this.externalEnd) {
      const end = this.rules.end();
      if (end) {
        this.finish(end);
        return;
      }
    }
    this.events.turn?.(this.rules);
    this.maybeAi();
  }

  finish(end: GameEnd) {
    if (this.end) return;
    this.end = end;
    this.selected = null;
    this.refreshMarks();
    this.ai?.cancel?.();
    this.events.ended?.(end, this.rules);
  }

  private maybeAi() {
    if (this.end) return;
    const turn = this.rules.turn();
    if (this.setup.players[turn] !== 'ai' || !this.ai) return;
    const token = ++this.aiToken;
    const fen = this.rules.fen();
    this.ai.request(this.rules, turn).then((m) => {
      if (token !== this.aiToken || this.end || this.rules.fen() !== fen) return;
      if (m) this.apply(m);
    });
  }

  /** Nimmt den letzten eigenen Zug zurück (gegen KI zwei Halbzüge). */
  undo(): boolean {
    if (this.busy || this.setup.mode === 'online') return false;
    const hist = this.rules.history();
    if (!hist.length) return false;
    this.aiToken++;
    this.ai?.cancel?.();
    let n = 1;
    if (this.setup.mode === 'ai') {
      const human = this.setup.players.w === 'human' ? 'w' : 'b';
      // Bis der Mensch wieder am Zug ist, mindestens einen seiner Züge
      n = this.rules.turn() === human ? 2 : 1;
      if (n > hist.length) n = hist.length;
      if (hist.length - n < 0) return false;
      // Nur KI-Zug vorhanden (Mensch ist Schwarz und hat noch nicht gezogen)
      if (hist.length === 1 && human === 'b') return false;
    }
    for (let i = 0; i < n; i++) this.rules.undo();
    this.end = null;
    this.selected = null;
    this.syncActors();
    this.refreshMarks();
    this.events.turn?.(this.rules);
    this.maybeAi();
    return true;
  }

  historyUci(): string[] {
    return this.rules.historyUci();
  }

  refreshMarks(moving = false) {
    const marks: Mark[] = [];
    const hist = this.rules.history();
    const last = hist[hist.length - 1];
    if (last && !moving) {
      marks.push({ sq: last.from, kind: 'last' }, { sq: last.to, kind: 'last' });
    }
    if (!moving && this.rules.inCheck()) {
      const k = this.rules.kingSquare(this.rules.turn());
      if (k) marks.push({ sq: k, kind: 'check' });
    }
    if (!moving && !this.end && this.setup.players[this.rules.turn()] === 'human') {
      if (this.hover && this.hover !== this.selected) marks.push({ sq: this.hover, kind: 'hover' });
      if (this.selected) {
        marks.push({ sq: this.selected, kind: 'select' });
        if (this.showHints) {
          for (const m of this.rules.movesFrom(this.selected)) {
            if (m.promotion && m.promotion !== 'q') continue;
            marks.push({ sq: m.to, kind: m.captured ? 'capture' : 'move' });
          }
        }
      }
    }
    this.stage.marks = marks;
  }

  lastMoveUci(): string | null {
    const h = this.rules.history();
    const m = h[h.length - 1];
    return m ? moveToUci(m) : null;
  }
}
