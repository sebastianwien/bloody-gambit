/**
 * Stil-Blatt Bloody Gambit: eine Palette für alles, was im Code gezeichnet wird.
 * Licht kommt von links oben (Mond) und warm von den Fackeln, Umriss in INK.
 * Abgeleitet aus bilder/moodboard_duester.webp.
 */
export const PAL = {
  ink: '#0d0a0e',
  night0: '#0e0c1a',
  night1: '#17142a',
  night2: '#24203f',
  night3: '#36325c',
  night4: '#565283',
  moon: '#d9dcef',
  stone0: '#1a171b',
  stone1: '#2a2629',
  stone2: '#3d3838',
  stone3: '#57504b',
  stone4: '#7a7166',
  stone5: '#9c917f',
  stone6: '#c2b8a2',
  earth0: '#1f140d',
  earth1: '#35210f',
  earth2: '#553620',
  wood0: '#2b1b10',
  wood1: '#4a2f1a',
  wood2: '#6d4727',
  fire0: '#6e1d0e',
  fire1: '#b8401a',
  fire2: '#e8862a',
  fire3: '#ffd25e',
  fire4: '#fff4c2',
  blood0: '#3c0609',
  blood1: '#6e0d12',
  blood2: '#a3161b',
  blood3: '#d42a26',
  cream: '#e4d9bf',
  silver: '#b8bcc4',
  wolfred: '#7a1c22',
  moss0: '#26301c',
  moss1: '#3a4a2a',
  bone: '#d8cfb4',
  rain: '#8d93c4',
  gold: '#d9a83a',
  // Markierungen auf dem Brett
  select: '#ffd25e',
  move: '#9fe0a8',
  capture: '#ff5a4a',
  last: '#7fb2ff',
  check: '#ff2a2a',
} as const;

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
