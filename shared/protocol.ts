import type { Color, GameEnd } from './rules.ts';

/** Bedenkzeit in Millisekunden. */
export interface ClockConfig {
  initial: number;
  increment: number;
}

export type ClientMsg =
  | { t: 'create'; clock: ClockConfig | null; color: Color | 'random' }
  | { t: 'join'; code: string }
  | { t: 'resume'; code: string; token: string }
  | { t: 'move'; uci: string; ply: number }
  | { t: 'resign' }
  | { t: 'offerDraw' }
  | { t: 'answerDraw'; accept: boolean }
  | { t: 'rematch' }
  | { t: 'leave' }
  | { t: 'ping' };

export interface ClockState {
  /** Restzeit je Farbe zum Zeitpunkt serverTime. */
  w: number;
  b: number;
  /** Wessen Uhr läuft (null = keine). */
  running: Color | null;
  /** Bis zu diesem Serverzeitpunkt steht die Uhr noch (Zeit für die Kampfanimation). */
  graceUntil: number;
  config: ClockConfig;
}

export interface RoomState {
  t: 'state';
  code: string;
  you: Color;
  moves: string[];
  players: Record<Color, 'here' | 'away' | 'empty'>;
  /** Frist (Serverzeit), bis ein abwesender Spieler zurück sein muss. */
  awayDeadline: number | null;
  clock: ClockState | null;
  result: GameEnd | null;
  drawOffer: Color | null;
  rematchOffer: Color | null;
  /** Zähler der Partie im Raum (steigt bei Revanche). */
  game: number;
  serverTime: number;
}

export type ServerMsg =
  | { t: 'welcome'; code: string; token: string; color: Color }
  | RoomState
  | { t: 'error'; code: ErrorCode; msg: string }
  | { t: 'pong'; serverTime: number };

export type ErrorCode = 'no-room' | 'full' | 'illegal' | 'not-your-turn' | 'bad-request' | 'over' | 'bad-token';

/** Schonfrist nach Verbindungsabbruch. */
export const RECONNECT_GRACE_MS = 60_000;
/** Uhr steht nach einem Zug kurz, damit die Animation nicht Zeit kostet. */
export const GRACE_MOVE_MS = 1500;
export const GRACE_CAPTURE_MS = 6000;

export const CLOCK_PRESETS: { label: string; clock: ClockConfig | null }[] = [
  { label: 'Ohne Uhr', clock: null },
  { label: '3 + 2', clock: { initial: 180_000, increment: 2000 } },
  { label: '5 + 3', clock: { initial: 300_000, increment: 3000 } },
  { label: '10 + 5', clock: { initial: 600_000, increment: 5000 } },
  { label: '15 + 10', clock: { initial: 900_000, increment: 10_000 } },
];

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
