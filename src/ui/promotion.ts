import type { Color, PieceSymbol } from '../../shared/rules.ts';
import { PIECE_NAMES } from '../../shared/rules.ts';
import type { SpriteSource } from '../scene/sprites.ts';
import { button, el } from './dom.ts';

/** Auswahl der Umwandlungsfigur. Escape bricht ab. */
export function choosePromotion(ui: HTMLElement, color: Color, sprites: SpriteSource, onClick?: () => void): Promise<PieceSymbol | null> {
  return new Promise((resolve) => {
    const row = el('div', { style: 'display:flex;gap:8px;margin-top:10px' });
    const close = (p: PieceSymbol | null) => {
      document.removeEventListener('keydown', onKey);
      modal.remove();
      resolve(p);
    };
    for (const p of ['q', 'r', 'b', 'n'] as PieceSymbol[]) {
      const f = sprites.still(p, color, 'front');
      const cv = el('canvas', { width: f.w, height: f.h, style: `width:${f.w}px;height:${f.h}px;image-rendering:pixelated;display:block;margin:0 auto 4px` });
      const g = cv.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      g.drawImage(f.img, 0, 0);
      const b = button('', () => {
        onClick?.();
        close(p);
      }, 'btn small', 'promo-' + p);
      b.append(cv, el('div', { style: 'text-align:center', text: PIECE_NAMES[p] }));
      row.append(b);
    }
    const modal = el(
      'div',
      { class: 'modal', 'data-testid': 'promotion' },
      el('div', { class: 'panel' }, el('div', { class: 'title-mid', text: 'Umwandlung' }), el('div', { class: 'muted', style: 'margin-top:6px', text: 'Wähle die neue Figur' }), row),
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(null);
    };
    document.addEventListener('keydown', onKey);
    ui.append(modal);
  });
}
