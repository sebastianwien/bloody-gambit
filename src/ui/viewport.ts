import { VIEW_H, VIEW_W } from '../config.ts';

/** Skaliert die logische 960x540-Fläche so groß wie möglich ins Fenster (Rand nur durch das Seitenverhältnis). */
export function fitViewport(root: HTMLElement) {
  const apply = () => {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    root.style.transform = `scale(${scale}) translate(-50%, -50%)`;
    root.style.transformOrigin = '0 0';
    root.style.left = '50%';
    root.style.top = '50%';
    root.dataset.scale = String(scale);
  };
  window.addEventListener('resize', apply);
  apply();
}

/** Bildschirmpunkt -> logische Koordinate. */
export function toLogical(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const r = canvas.getBoundingClientRect();
  return { x: ((clientX - r.left) / r.width) * VIEW_W, y: ((clientY - r.top) / r.height) * VIEW_H };
}
