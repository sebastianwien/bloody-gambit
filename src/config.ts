/** Arbeitstitel an genau einer Stelle. */
export const GAME_TITLE = 'Wolfsschach';
export const GAME_VERSION = '0.1.0';

/** Logische Auflösung, wird ganzzahlig bzw. pixelig hochskaliert. */
export const VIEW_W = 960;
export const VIEW_H = 540;

/**
 * Brett aus Sicht des Spielers mit leichter Perspektive: die vordere Kante ist breit und unten,
 * die hintere schmaler und oben. Feldbreite vorne in Pixeln, Verkleinerung hinten als Faktor.
 */
export const BOARD_CX = VIEW_W / 2;
export const BOARD_NEAR_Y = 492;
export const BOARD_FAR_Y = 156;
export const TILE_W = 60;
export const FAR_SCALE = 0.76;

/** Kampf- und Laufanimationen laufen mit 8 Bildern pro Sekunde. */
export const ANIM_FPS = 8;
/** Gehen ist langsamer: 6 Bilder pro Sekunde, also drei Schritte pro Sekunde bei vier Laufbildern. */
export const WALK_FPS = 6;
/** Bildrate für einen Laufzyklus aus n Bildern: immer drei Schritte pro Sekunde, egal wie fein gezeichnet. */
export const walkFps = (frames: number) => WALK_FPS * Math.max(1, frames / 4);

/** Getragene Bewegungen (Zusammensinken, Siegergeste, Taumeln) laufen etwas langsamer als Angriffe. */
export const POSE_FPS = 7;

export const SERVER_PORT = 8790;
