/** Arbeitstitel an genau einer Stelle. */
export const GAME_TITLE = 'Wolfsschach';
export const GAME_VERSION = '0.1.0';

/** Logische Auflösung, wird ganzzahlig bzw. pixelig hochskaliert. */
export const VIEW_W = 960;
export const VIEW_H = 540;

/** Isometrische Kachel (Raute). */
export const TILE_W = 64;
export const TILE_H = 32;

/** Linke Ecke des Bretts (Feld a1 aus Sicht Weiß) in Bildschirmkoordinaten. */
export const BOARD_OX = VIEW_W / 2 - 4 * TILE_W;
export const BOARD_OY = 300;

/** Kampf- und Laufanimationen laufen mit 8 Bildern pro Sekunde. */
export const ANIM_FPS = 8;

export const SERVER_PORT = 8790;
