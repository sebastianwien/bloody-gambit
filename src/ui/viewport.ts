import { VIEW_H, VIEW_W } from '../config.ts';

/** Skaliert die logische 960x540-Fläche passend ins Fenster. */
export function fitViewport(root: HTMLElement) {
  const apply = () => {
    const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    // Ab 2x auf ganze Zahlen runden: gleichmäßige Pixel
    const scale = s >= 2 ? Math.floor(s) : s >= 1 ? Math.floor(s * 2) / 2 || s : s;
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
