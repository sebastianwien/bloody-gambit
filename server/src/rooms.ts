import { randomBytes } from 'node:crypto';
import {
  CODE_ALPHABET,
  GRACE_CAPTURE_MS,
  GRACE_MOVE_MS,
  RECONNECT_GRACE_MS,
  normalizeCode,
  type ClientMsg,
  type ClockConfig,
  type ClockState,
  type ErrorCode,
  type RoomState,
  type ServerMsg,
} from '../../shared/protocol.ts';
import { Rules, uciToMove, type Color, type GameEnd } from '../../shared/rules.ts';

/** Eine Verbindung, wie sie die Raumlogik sieht (im Test ein Fake, im Server ein WebSocket). */
export interface Conn {
  send(msg: ServerMsg): void;
}

interface Seat {
  token: string;
  conn: Conn | null;
  awaySince: number | null;
}

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

/** Ein Raum ohne Verbindungen, so wie er einen Neustart des Servers übersteht. */
export interface SavedRoom {
  code: string;
  clockConfig: ClockConfig | null;
  /** left: Platz mit "Verlassen" geräumt, läuft also nicht in die Schonfrist. */
  seats: Record<Color, { token: string; left: boolean } | null>;
  moves: string[];
  result: GameEnd | null;
  clock: ClockState | null;
  lastClockMark: number;
  drawOffer: Color | null;
  rematchOffer: Color | null;
  game: number;
}

export interface SavedRooms {
  savedAt: number;
  rooms: SavedRoom[];
}

/**
 * Ein Raum mit zwei Plätzen. Autoritativ: prüft jeden Zug mit chess.js, führt die Uhr,
 * entscheidet Spielende, Abbruch und Revanche. Keine Nutzerdaten, nur Zufallstoken.
 */
export class Room {
  readonly code: string;
  seats: Record<Color, Seat | null> = { w: null, b: null };
  rules = new Rules();
  result: GameEnd | null = null;
  clock: ClockState | null = null;
  drawOffer: Color | null = null;
  rematchOffer: Color | null = null;
  game = 1;
  lastActivity: number;

  readonly clockConfig: ClockConfig | null;
  private now: () => number;

  constructor(code: string, clockConfig: ClockConfig | null, now: () => number) {
    this.code = code;
    this.clockConfig = clockConfig;
    this.now = now;
    this.lastActivity = now();
    this.resetClock();
  }

  private resetClock() {
    this.clock = this.clockConfig
      ? { w: this.clockConfig.initial, b: this.clockConfig.initial, running: null, graceUntil: 0, config: this.clockConfig }
      : null;
  }

  colorOf(conn: Conn): Color | null {
    if (this.seats.w?.conn === conn) return 'w';
    if (this.seats.b?.conn === conn) return 'b';
    return null;
  }

  seat(color: Color, conn: Conn): string {
    const token = randomBytes(12).toString('hex');
    this.seats[color] = { token, conn, awaySince: null };
    this.lastActivity = this.now();
    return token;
  }

  freeColor(): Color | null {
    if (!this.seats.w) return 'w';
    if (!this.seats.b) return 'b';
    return null;
  }

  bothSeated(): boolean {
    return !!this.seats.w && !!this.seats.b;
  }

  /** Aktuelle Restzeit der laufenden Uhr (ohne zu buchen). */
  remaining(color: Color, at = this.now()): number {
    if (!this.clock) return Infinity;
    const base = this.clock[color];
    if (this.clock.running !== color) return base;
    return base - Math.max(0, at - this.lastClockMark);
  }

  /** Zeitpunkt, ab dem die laufende Uhr zuletzt gebucht wurde. */
  private lastClockMark = 0;

  private book(at: number) {
    if (!this.clock || !this.clock.running) return;
    const c = this.clock.running;
    this.clock[c] = this.remaining(c, at);
    this.lastClockMark = Math.max(at, this.lastClockMark);
  }

  state(you: Color): RoomState {
    const at = this.now();
    const players = (['w', 'b'] as Color[]).reduce(
      (acc, c) => {
        const s = this.seats[c];
        acc[c] = !s ? 'empty' : s.conn ? 'here' : 'away';
        return acc;
      },
      {} as Record<Color, 'here' | 'away' | 'empty'>,
    );
    let awayDeadline: number | null = null;
    for (const c of ['w', 'b'] as Color[]) {
      const s = this.seats[c];
      if (s && !s.conn && s.awaySince !== null) awayDeadline = s.awaySince + RECONNECT_GRACE_MS;
    }
    let clock: ClockState | null = null;
    if (this.clock) {
      clock = { ...this.clock, w: this.remaining('w', at), b: this.remaining('b', at) };
      // Bereits verstrichene Zeit ist eingerechnet; die Uhr läuft ab serverTime weiter
      if (clock.running && at >= this.clock.graceUntil) clock.graceUntil = at;
    }
    return {
      t: 'state',
      code: this.code,
      you,
      moves: this.rules.historyUci(),
      players,
      awayDeadline,
      clock,
      result: this.result,
      drawOffer: this.drawOffer,
      rematchOffer: this.rematchOffer,
      game: this.game,
      serverTime: at,
    };
  }

  broadcast() {
    for (const c of ['w', 'b'] as Color[]) {
      const s = this.seats[c];
      s?.conn?.send(this.state(c));
    }
  }

  private finish(result: GameEnd) {
    if (this.result) return;
    const at = this.now();
    this.book(at);
    if (this.clock) this.clock.running = null;
    this.result = result;
    this.drawOffer = null;
  }

  move(color: Color, uci: string, ply: number): ErrorCode | null {
    if (this.result) return 'over';
    if (!this.bothSeated()) return 'not-your-turn';
    const hist = this.rules.history().length;
    if (ply !== hist) return 'illegal';
    if (this.rules.turn() !== color) return 'not-your-turn';
    const at = this.now();
    if (this.clock && this.remaining(color, at) <= 0) {
      this.finish({ winner: other(color), reason: 'timeout' });
      return 'over';
    }
    let m;
    try {
      m = this.rules.play(uciToMove(uci));
    } catch {
      m = null;
    }
    if (!m) return 'illegal';
    this.lastActivity = at;
    this.drawOffer = null;
    if (this.clock) {
      // Uhr des Ziehenden buchen, Inkrement gutschreiben, Gegner startet nach Schonzeit
      if (this.clock.running === color) this.book(at);
      if (hist >= 1) this.clock[color] += this.clock.config.increment;
      this.clock.running = other(color);
      this.clock.graceUntil = at + (m.captured ? GRACE_CAPTURE_MS : GRACE_MOVE_MS);
      this.lastClockMark = this.clock.graceUntil;
      // Erst nach dem ersten Zug von Schwarz laufen die Uhren (Weiß darf in Ruhe eröffnen)
      if (hist === 0) {
        this.clock.running = 'b';
      }
    }
    const end = this.rules.end();
    if (end) this.finish(end);
    return null;
  }

  /** Zeit- und Abwesenheitsprüfung, regelmäßig aufgerufen. */
  tick(): boolean {
    const at = this.now();
    let changed = false;
    if (!this.result && this.clock?.running && this.rules.history().length >= 1) {
      const c = this.clock.running;
      if (this.remaining(c, at) <= 0) {
        this.finish({ winner: other(c), reason: 'timeout' });
        changed = true;
      }
    }
    if (!this.result) {
      for (const c of ['w', 'b'] as Color[]) {
        const s = this.seats[c];
        if (s && !s.conn && s.awaySince !== null && at - s.awaySince >= RECONNECT_GRACE_MS && this.seats[other(c)]) {
          this.finish({ winner: other(c), reason: 'abandon' });
          changed = true;
        }
      }
    }
    return changed;
  }

  disconnect(conn: Conn) {
    const c = this.colorOf(conn);
    if (!c) return;
    const s = this.seats[c]!;
    s.conn = null;
    s.awaySince = this.now();
  }

  handle(color: Color, msg: ClientMsg): ErrorCode | null {
    switch (msg.t) {
      case 'move':
        return typeof msg.uci === 'string' && Number.isInteger(msg.ply) ? this.move(color, msg.uci, msg.ply) : 'bad-request';
      case 'resign':
        if (this.result) return 'over';
        if (!this.bothSeated()) return 'bad-request';
        this.finish({ winner: other(color), reason: 'resign' });
        return null;
      case 'offerDraw':
        if (this.result) return 'over';
        if (this.drawOffer === other(color)) {
          this.finish({ winner: null, reason: 'agreement' });
          return null;
        }
        this.drawOffer = color;
        return null;
      case 'answerDraw':
        if (this.result) return 'over';
        if (this.drawOffer !== other(color)) return 'bad-request';
        if (msg.accept) this.finish({ winner: null, reason: 'agreement' });
        else this.drawOffer = null;
        return null;
      case 'rematch':
        if (!this.result) return 'bad-request';
        if (this.rematchOffer === other(color)) {
          this.startRematch();
          return null;
        }
        this.rematchOffer = color;
        return null;
      case 'leave':
        if (!this.result && this.bothSeated()) this.finish({ winner: other(color), reason: 'resign' });
        return null;
      default:
        return 'bad-request';
    }
  }

  private startRematch() {
    // Farben tauschen: Plätze vertauschen
    const w = this.seats.w;
    this.seats.w = this.seats.b;
    this.seats.b = w;
    this.rules = new Rules();
    this.result = null;
    this.drawOffer = null;
    this.rematchOffer = null;
    this.game++;
    this.resetClock();
    this.lastClockMark = 0;
  }

  empty(): boolean {
    return !this.seats.w?.conn && !this.seats.b?.conn;
  }

  save(): SavedRoom {
    const seat = (s: Seat | null) => (s ? { token: s.token, left: !s.conn && s.awaySince === null } : null);
    return {
      code: this.code,
      clockConfig: this.clockConfig,
      seats: { w: seat(this.seats.w), b: seat(this.seats.b) },
      moves: this.rules.historyUci(),
      result: this.result,
      clock: this.clock && { ...this.clock },
      lastClockMark: this.lastClockMark,
      drawOffer: this.drawOffer,
      rematchOffer: this.rematchOffer,
      game: this.game,
    };
  }

  /**
   * Baut einen gespeicherten Raum wieder auf. Die Zeit, in der der Server weg war, zählt für
   * keine Uhr; beide Spieler gelten als abwesend und haben die übliche Schonfrist zum Wiederverbinden.
   */
  static restore(s: SavedRoom, savedAt: number, now: () => number): Room {
    const at = now();
    const shift = at - savedAt;
    const room = new Room(s.code, s.clockConfig, now);
    for (const c of ['w', 'b'] as Color[]) {
      const seat = s.seats[c];
      room.seats[c] = seat ? { token: seat.token, conn: null, awaySince: seat.left ? null : at } : null;
    }
    for (const uci of s.moves) if (!room.rules.play(uciToMove(uci))) throw new Error(`Zug ${uci} passt nicht`);
    room.result = s.result;
    room.clock = s.clock && { ...s.clock, graceUntil: s.clock.graceUntil + shift };
    room.lastClockMark = s.lastClockMark + shift;
    room.drawOffer = s.drawOffer;
    room.rematchOffer = s.rematchOffer;
    room.game = s.game;
    return room;
  }
}

/** Verwaltet alle Räume im Speicher und übersetzt Nachrichten. */
export class RoomManager {
  rooms = new Map<string, Room>();
  private byConn = new Map<Conn, Room>();

  private now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  private newCode(): string {
    for (;;) {
      let s = '';
      const bytes = randomBytes(5);
      for (let i = 0; i < 5; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
      if (!this.rooms.has(s)) return s;
    }
  }

  private error(conn: Conn, code: ErrorCode, msg: string) {
    conn.send({ t: 'error', code, msg });
  }

  receive(conn: Conn, raw: unknown) {
    const msg = raw as ClientMsg;
    if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return this.error(conn, 'bad-request', 'Unbekannte Nachricht');
    switch (msg.t) {
      case 'ping':
        conn.send({ t: 'pong', serverTime: this.now() });
        return;
      case 'create': {
        this.leaveCurrent(conn);
        const clock = validClock(msg.clock);
        const code = this.newCode();
        const room = new Room(code, clock, this.now);
        this.rooms.set(code, room);
        const color: Color = msg.color === 'w' || msg.color === 'b' ? msg.color : Math.random() < 0.5 ? 'w' : 'b';
        const token = room.seat(color, conn);
        this.byConn.set(conn, room);
        conn.send({ t: 'welcome', code, token, color });
        room.broadcast();
        return;
      }
      case 'join': {
        const code = normalizeCode(String(msg.code ?? ''));
        const room = this.rooms.get(code);
        if (!room) return this.error(conn, 'no-room', 'Diesen Raum gibt es nicht');
        const color = room.freeColor();
        if (!color) return this.error(conn, 'full', 'Der Raum ist schon voll');
        this.leaveCurrent(conn);
        const token = room.seat(color, conn);
        this.byConn.set(conn, room);
        conn.send({ t: 'welcome', code, token, color });
        room.broadcast();
        return;
      }
      case 'resume': {
        const room = this.rooms.get(normalizeCode(String(msg.code ?? '')));
        if (!room) return this.error(conn, 'no-room', 'Diesen Raum gibt es nicht mehr');
        const color = (['w', 'b'] as Color[]).find((c) => room.seats[c]?.token === msg.token);
        if (!color) return this.error(conn, 'bad-token', 'Platz nicht gefunden');
        const seat = room.seats[color]!;
        this.leaveCurrent(conn);
        if (seat.conn && seat.conn !== conn) this.byConn.delete(seat.conn);
        seat.conn = conn;
        seat.awaySince = null;
        this.byConn.set(conn, room);
        conn.send({ t: 'welcome', code: room.code, token: seat.token, color });
        room.broadcast();
        return;
      }
      default: {
        const room = this.byConn.get(conn);
        if (!room) return this.error(conn, 'no-room', 'Kein Raum');
        const color = room.colorOf(conn);
        if (!color) return this.error(conn, 'no-room', 'Kein Platz');
        const err = room.handle(color, msg);
        if (err) {
          this.error(conn, err, errorText(err));
          conn.send(room.state(color));
          return;
        }
        if (msg.t === 'leave') this.leaveCurrent(conn, true);
        room.broadcast();
      }
    }
  }

  private leaveCurrent(conn: Conn, hard = false) {
    const room = this.byConn.get(conn);
    if (!room) return;
    const color = room.colorOf(conn);
    this.byConn.delete(conn);
    if (color && hard) {
      room.seats[color]!.conn = null;
      room.seats[color]!.awaySince = null;
    } else room.disconnect(conn);
    room.broadcast();
  }

  close(conn: Conn) {
    const room = this.byConn.get(conn);
    this.byConn.delete(conn);
    if (!room) return;
    room.disconnect(conn);
    room.broadcast();
  }

  save(): SavedRooms {
    return { savedAt: this.now(), rooms: [...this.rooms.values()].map((r) => r.save()) };
  }

  /** Lädt gespeicherte Räume; ein kaputter Raum wird übersprungen, statt den Start zu verhindern. */
  restore(saved: SavedRooms): number {
    let n = 0;
    for (const s of saved.rooms ?? []) {
      try {
        const room = Room.restore(s, saved.savedAt, this.now);
        this.rooms.set(room.code, room);
        n++;
      } catch {
        /* Raum verworfen */
      }
    }
    return n;
  }

  tick() {
    const at = this.now();
    for (const [code, room] of this.rooms) {
      if (room.tick()) room.broadcast();
      // Aufräumen: leere Räume nach 10 Minuten ohne Aktivität
      if (room.empty() && at - room.lastActivity > 10 * 60_000) this.rooms.delete(code);
    }
  }
}

function validClock(c: unknown): ClockConfig | null {
  if (!c || typeof c !== 'object') return null;
  const { initial, increment } = c as ClockConfig;
  if (!Number.isFinite(initial) || !Number.isFinite(increment)) return null;
  if (initial < 30_000 || initial > 3 * 3600_000 || increment < 0 || increment > 60_000) return null;
  return { initial: Math.round(initial), increment: Math.round(increment) };
}

function errorText(e: ErrorCode): string {
  return (
    {
      'no-room': 'Raum nicht gefunden',
      full: 'Raum ist voll',
      illegal: 'Zug nicht erlaubt',
      'not-your-turn': 'Du bist nicht am Zug',
      'bad-request': 'Ungültige Anfrage',
      over: 'Die Partie ist vorbei',
      'bad-token': 'Platz nicht gefunden',
    } as Record<ErrorCode, string>
  )[e];
}
