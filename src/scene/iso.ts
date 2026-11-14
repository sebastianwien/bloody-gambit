import type { Square } from '../../shared/rules.ts';
import { BOARD_OX, BOARD_OY, TILE_H, TILE_W } from '../config.ts';

/**
 * Brettkoordinaten: bx = Linie (a=0 … h=7), by = Reihe (1=0 … 8=7), Feldmitte bei +0.5.
 * Aus Sicht des unteren Spielers liegt seine Grundreihe an der linken unteren Kante,
 * der Gegner oben rechts. Bei flipped=true sitzt Schwarz unten.
 */
export interface Pt {
  x: number;
  y: number;
}

export function squareToBoard(sq: Square): Pt {
  return { x: sq.charCodeAt(0) - 97, y: sq.charCodeAt(1) - 49 };
}

export function boardToSquare(f: number, r: number): Square | null {
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return (String.fromCharCode(97 + f) + String.fromCharCode(49 + r)) as Square;
}

/** Brettpunkt (kontinuierlich, 0..8) zu Bildschirm. */
export function boardToScreen(bx: number, by: number, flipped: boolean): Pt {
  const u = flipped ? 8 - bx : bx;
  const v = flipped ? 8 - by : by;
  return { x: BOARD_OX + ((u + v) * TILE_W) / 2, y: BOARD_OY + ((u - v) * TILE_H) / 2 };
}

/** Feldmitte in Bildschirmkoordinaten. */
export function squareCenter(sq: Square, flipped: boolean): Pt {
  const b = squareToBoard(sq);
  return boardToScreen(b.x + 0.5, b.y + 0.5, flipped);
}

/** Bildschirm zu Brettpunkt (kontinuierlich). */
export function screenToBoard(x: number, y: number, flipped: boolean): Pt {
  const s = (x - BOARD_OX) / (TILE_W / 2);
  const d = (y - BOARD_OY) / (TILE_H / 2);
  let u = (s + d) / 2;
  let v = (s - d) / 2;
  if (flipped) {
    u = 8 - u;
    v = 8 - v;
  }
  return { x: u, y: v };
}

export function screenToSquare(x: number, y: number, flipped: boolean): Square | null {
  const b = screenToBoard(x, y, flipped);
  return boardToSquare(Math.floor(b.x), Math.floor(b.y));
}

/** Zeichenreihenfolge: weiter unten auf dem Bildschirm = später zeichnen. */
export function depthOf(bx: number, by: number, flipped: boolean): number {
  return boardToScreen(bx, by, flipped).y;
}

/**
 * Blickrichtung auf dem Bildschirm für eine Bewegung von a nach b (Brettpunkte).
 * Rückgabe: front = Figur kommt auf den Betrachter zu (nach unten), mirror = nach links.
 */
export function facingFor(dx: number, dy: number): { front: boolean; mirror: boolean } {
  return { front: dy >= 0, mirror: dx < 0 };
}
