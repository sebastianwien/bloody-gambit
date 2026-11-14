import type { Square } from '../../shared/rules.ts';
import { BOARD_CX, BOARD_FAR_Y, BOARD_NEAR_Y, FAR_SCALE, TILE_W } from '../config.ts';

/**
 * Projektion des Bretts aus Sicht des unten sitzenden Spielers mit Fluchtpunkt-Perspektive.
 * Brettkoordinaten: bx = Linie (a=0 … h=7), by = Reihe (1=0 … 8=7), Feldmitte bei +0.5.
 * Bei flipped=true sitzt Schwarz unten (Brett um 180° gedreht).
 * Sprites werden nicht skaliert (Retro-Art), nur das Brett hat Perspektive.
 */
export interface Pt {
  x: number;
  y: number;
}

const A = (1 / FAR_SCALE - 1) / 8;
/** Horizont so gewählt, dass die hintere Kante bei BOARD_FAR_Y liegt. */
const HORIZON = (BOARD_FAR_Y - BOARD_NEAR_Y * FAR_SCALE) / (1 - FAR_SCALE);

/** Maßstab in Tiefe t (0 = vordere Kante, 8 = hintere). */
export function depthScale(t: number): number {
  return 1 / (1 + A * t);
}

export function squareToBoard(sq: Square): Pt {
  return { x: sq.charCodeAt(0) - 97, y: sq.charCodeAt(1) - 49 };
}

export function boardToSquare(f: number, r: number): Square | null {
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return (String.fromCharCode(97 + f) + String.fromCharCode(49 + r)) as Square;
}

/** Brettpunkt (kontinuierlich, 0..8, Rand darf darüber hinaus) zu Bildschirm. */
export function boardToScreen(bx: number, by: number, flipped: boolean): Pt {
  const u = flipped ? 8 - bx : bx;
  const v = flipped ? 8 - by : by;
  const s = depthScale(v);
  return { x: BOARD_CX + (u - 4) * TILE_W * s, y: HORIZON + (BOARD_NEAR_Y - HORIZON) * s };
}

export function squareCenter(sq: Square, flipped: boolean): Pt {
  const b = squareToBoard(sq);
  return boardToScreen(b.x + 0.5, b.y + 0.5, flipped);
}

/** Bildschirm zu Brettpunkt (kontinuierlich). */
export function screenToBoard(x: number, y: number, flipped: boolean): Pt {
  const s = (y - HORIZON) / (BOARD_NEAR_Y - HORIZON);
  const v = (1 / s - 1) / A;
  const u = (x - BOARD_CX) / (TILE_W * s) + 4;
  return flipped ? { x: 8 - u, y: 8 - v } : { x: u, y: v };
}

export function screenToSquare(x: number, y: number, flipped: boolean): Square | null {
  const b = screenToBoard(x, y, flipped);
  return boardToSquare(Math.floor(b.x), Math.floor(b.y));
}

/** Acht Blickrichtungen auf dem Bildschirm (s = zum Betrachter). */
export type Dir8 = 's' | 'n' | 'e' | 'w' | 'se' | 'sw' | 'ne' | 'nw';
const DIRS: Dir8[] = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];

/** Richtung aus einer Bildschirmbewegung. */
export function dirFromDelta(dx: number, dy: number): Dir8 {
  // Tiefe ist perspektivisch gestaucht: vertikale Bewegung stärker gewichten
  const ang = Math.atan2(dy * 1.6, dx);
  const i = Math.round(ang / (Math.PI / 4));
  return DIRS[(i + 8) % 8];
}
