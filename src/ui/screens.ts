import type { Color, Move, PieceSymbol } from '../../shared/rules.ts';
import { PIECE_NAMES } from '../../shared/rules.ts';
import { LEVEL_NAMES, LEVEL_TEXT, type AiLevel } from '../ai/levels.ts';
import { GAME_TITLE, GAME_VERSION } from '../config.ts';
import type { Settings } from '../game/settings.ts';
import type { SpriteSource } from '../scene/sprites.ts';
import { button, el } from './dom.ts';

export interface MenuHandlers {
  resume?: () => void;
  single: () => void;
  local: () => void;
  /** Fehlt, wenn es keinen Raumserver gibt: dann erscheint der Menüpunkt nicht. */
  online?: () => void;
  settings: () => void;
  credits: () => void;
}

/** Deutsche Figurenbuchstaben in der Zugliste. */
export function sanDe(san: string): string {
  return san.replace(/[KQRBN]/g, (c) => ({ K: 'K', Q: 'D', R: 'T', B: 'L', N: 'S' })[c]!);
}

/** Verwaltet alle DOM-Bildschirme über der Leinwand. */
export class Screens {
  private layer: HTMLElement;
  private hud: HTMLElement;
  /** Wird bei jedem Knopfdruck aufgerufen (Klickgeräusch). */
  onClick: () => void = () => {};

  constructor(
    private ui: HTMLElement,
    private sprites: () => SpriteSource,
  ) {
    this.hud = el('div', { class: 'hud passthrough hidden', 'data-testid': 'hud' });
    this.layer = el('div', { class: 'screen-layer passthrough' });
    ui.append(this.hud, this.layer);
  }

  private btn(label: string, fn: () => void, testid?: string, cls = 'btn') {
    return button(label, () => {
      this.onClick();
      fn();
    }, cls, testid);
  }

  clear() {
    this.layer.replaceChildren();
  }

  private show(node: HTMLElement) {
    this.layer.replaceChildren(node);
    const first = node.querySelector('button') as HTMLButtonElement | null;
    first?.focus({ preventScroll: true });
  }

  // ---------- Laden und Titel ----------

  loading(progress: number, text = 'Lade') {
    let box = this.layer.querySelector('[data-testid=loading]') as HTMLElement | null;
    if (!box) {
      box = el(
        'div',
        { class: 'screen center', 'data-testid': 'loading' },
        el('div', { class: 'title-big', text: GAME_TITLE }),
        el('div', { class: 'bar' }, el('div', { class: 'bar-fill' })),
        el('div', { class: 'muted loading-text' }),
      );
      this.layer.replaceChildren(box);
    }
    (box.querySelector('.bar-fill') as HTMLElement).style.width = Math.round(progress * 100) + '%';
    (box.querySelector('.loading-text') as HTMLElement).textContent = `${text} ${Math.round(progress * 100)} %`;
  }

  title(onStart: () => void) {
    const node = el(
      'div',
      { class: 'screen title-screen', 'data-testid': 'title' },
      el('div', { class: 'title-logo' }, el('div', { class: 'title-huge', text: GAME_TITLE }), el('div', { class: 'title-sub', text: 'Schach mit Klinge und Blut' })),
      el('div', { class: 'press blink', text: 'Klicke oder drücke eine Taste' }),
    );
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', go);
      // Der Titel wurde schon von einem anderen Bildschirm ersetzt (Einstieg per Raumlink): nichts tun
      if (!node.isConnected) return;
      this.onClick();
      onStart();
    };
    node.addEventListener('pointerdown', go);
    document.addEventListener('keydown', go);
    this.show(node);
  }

  // ---------- Hauptmenü ----------

  menu(h: MenuHandlers) {
    const list = el('div', { class: 'menu-list' });
    if (h.resume) list.append(this.btn('Partie fortsetzen', h.resume, 'menu-resume', 'btn primary'));
    list.append(
      this.btn('Einzelspieler', h.single, 'menu-single'),
      this.btn('Zwei Spieler', h.local, 'menu-local'),
      ...(h.online ? [this.btn('Online', h.online, 'menu-online')] : []),
      this.btn('Einstellungen', h.settings, 'menu-settings'),
      this.btn('Mitwirkende', h.credits, 'menu-credits'),
    );
    this.show(
      el(
        'div',
        { class: 'screen menu-screen', 'data-testid': 'menu' },
        el('div', { class: 'menu-title title-big', text: GAME_TITLE }),
        el('div', { class: 'panel menu-panel' }, list),
        el('div', { class: 'version muted', text: 'Version ' + GAME_VERSION }),
      ),
    );
  }

  singlePlayer(defaultLevel: AiLevel, onStart: (color: Color | 'random', level: AiLevel) => void, onBack: () => void) {
    let color: Color | 'random' = 'w';
    let level = defaultLevel;
    const colorRow = el('div', { class: 'choice-row' });
    const levelRow = el('div', { class: 'choice-col' });
    const renderColor = () => {
      colorRow.replaceChildren(
        ...(
          [
            ['w', 'Weiß'],
            ['b', 'Schwarz'],
            ['random', 'Zufall'],
          ] as const
        ).map(([c, label]) => {
          const b = this.btn(label, () => {
            color = c;
            renderColor();
          }, 'color-' + c, 'btn small choice' + (color === c ? ' on' : ''));
          return b;
        }),
      );
    };
    const renderLevel = () => {
      levelRow.replaceChildren(
        ...([1, 2, 3] as AiLevel[]).map((l) => {
          const b = this.btn('', () => {
            level = l;
            renderLevel();
          }, 'level-' + l, 'btn small choice wide' + (level === l ? ' on' : ''));
          b.append(el('span', { class: 'choice-name', text: LEVEL_NAMES[l] }), el('span', { class: 'muted', text: LEVEL_TEXT[l] }));
          return b;
        }),
      );
    };
    renderColor();
    renderLevel();
    this.show(
      el(
        'div',
        { class: 'screen center', 'data-testid': 'single' },
        el(
          'div',
          { class: 'panel form-panel' },
          el('div', { class: 'title-mid', text: 'Einzelspieler' }),
          el('div', { class: 'label', text: 'Deine Farbe' }),
          colorRow,
          el('div', { class: 'label', text: 'Gegner' }),
          levelRow,
          el('div', { class: 'row-end' }, this.btn('Zurück', onBack, 'back', 'btn small'), this.btn('Kampf beginnen', () => onStart(color, level), 'start', 'btn small primary')),
        ),
      ),
    );
  }

  settings(s: Settings, onChange: (s: Settings) => void, onBack: () => void, inGame = false) {
    const slider = (label: string, key: 'music' | 'sfx', testid: string) => {
      const input = el('input', { type: 'range', min: 0, max: 100, value: Math.round(s[key] * 100), 'data-testid': testid, 'aria-label': label }) as HTMLInputElement;
      const val = el('span', { class: 'slider-val', text: Math.round(s[key] * 100) + ' %' });
      input.addEventListener('input', () => {
        s[key] = Number(input.value) / 100;
        val.textContent = input.value + ' %';
        onChange(s);
      });
      return el('div', { class: 'setting' }, el('span', { class: 'setting-label', text: label }), input, val);
    };
    const choice = <T extends string | boolean | number>(label: string, options: [T, string][], get: () => T, set: (v: T) => void, testid: string) => {
      const row = el('div', { class: 'choice-row' });
      const render = () =>
        row.replaceChildren(
          ...options.map(([v, text]) =>
            this.btn(text, () => {
              set(v);
              onChange(s);
              render();
            }, `${testid}-${v}`, 'btn small choice' + (get() === v ? ' on' : '')),
          ),
        );
      render();
      return el('div', { class: 'setting' }, el('span', { class: 'setting-label', text: label }), row);
    };
    this.show(
      el(
        'div',
        { class: 'screen center' + (inGame ? ' dim' : ''), 'data-testid': 'settings' },
        el(
          'div',
          { class: 'panel form-panel' },
          el('div', { class: 'title-mid', text: 'Einstellungen' }),
          slider('Musik', 'music', 'vol-music'),
          slider('Effekte', 'sfx', 'vol-sfx'),
          choice('Kämpfe', [['always', 'Immer'], ['new', 'Nur neue'], ['off', 'Aus']], () => s.battles, (v) => (s.battles = v), 'battles'),
          choice('Blut', [[true, 'An'], [false, 'Aus']], () => s.gore, (v) => (s.gore = v), 'gore'),
          choice('KI-Stufe', [[1, LEVEL_NAMES[1]], [2, LEVEL_NAMES[2]], [3, LEVEL_NAMES[3]]], () => s.aiLevel, (v) => (s.aiLevel = v as AiLevel), 'ai'),
          choice('Zugvorschau', [[true, 'An'], [false, 'Aus']], () => s.hints, (v) => (s.hints = v), 'hints'),
          el('div', { class: 'muted small-note', text: 'Wird in diesem Browser gespeichert.' }),
          el('div', { class: 'row-end' }, this.btn('Zurück', onBack, 'back', 'btn small primary')),
        ),
      ),
    );
  }

  credits(onBack: () => void) {
    const libs: [string, string, string][] = [
      ['chess.js', 'BSD-2-Clause', 'Schachregeln im Spiel und auf dem Server'],
      ['ws', 'MIT', 'WebSocket-Server für Online-Partien'],
      ['Vite', 'MIT', 'Entwicklung und Build'],
      ['TypeScript', 'Apache-2.0', 'Sprache'],
      ['opentype.js', 'MIT', 'Bau der eigenen Pixelschrift'],
      ['Vitest', 'MIT', 'Tests'],
      ['Playwright', 'Apache-2.0', 'Browser-Tests'],
    ];
    const rows = libs.map(([n, l, what]) => el('div', { class: 'credit-row' }, el('span', { class: 'credit-name', text: n }), el('span', { class: 'credit-lic', text: l }), el('span', { class: 'muted', text: what })));
    this.show(
      el(
        'div',
        { class: 'screen center', 'data-testid': 'credits' },
        el(
          'div',
          { class: 'panel form-panel wide' },
          el('div', { class: 'title-mid', text: 'Mitwirkende' }),
          el('div', { class: 'credit-block' }, el('div', { class: 'label', text: 'Idee' }), el('div', { text: 'Sebastian' })),
          el(
            'div',
            { class: 'credit-block' },
            el('div', { class: 'label', text: 'Spiel, Code, Musik, Klänge' }),
            el('div', { text: 'Claude (Anthropic). Musik und Effekte werden im Spiel per WebAudio erzeugt, keine fremden Aufnahmen.' }),
          ),
          el(
            'div',
            { class: 'credit-block' },
            el('div', { class: 'label', text: 'Grafik' }),
            el('div', { text: 'Figuren mit PixelLab, Vorlagen und Hintergrund mit OpenAI-Bildmodell, Brett und Effekte im Code. Schrift "Wolfsrune" eigens gebaut.' }),
          ),
          el('div', { class: 'label', text: 'Bibliotheken und Lizenzen' }),
          ...rows,
          el('div', { class: 'muted small-note', text: 'Lizenztexte liegen den Paketen in node_modules bei. Keine Konten, keine gespeicherten Nutzerdaten.' }),
          el('div', { class: 'row-end' }, this.btn('Zurück', onBack, 'back', 'btn small primary')),
        ),
      ),
    );
  }

  // ---------- Im Spiel ----------

  pause(h: { resume: () => void; undo?: () => void; settings: () => void; resign?: () => void; draw?: () => void; menu: () => void }) {
    const list = el('div', { class: 'menu-list' });
    list.append(this.btn('Weiter', h.resume, 'pause-resume', 'btn primary'));
    if (h.undo) list.append(this.btn('Zug zurücknehmen', h.undo, 'pause-undo'));
    if (h.draw) list.append(this.btn('Remis anbieten', h.draw, 'pause-draw'));
    if (h.resign) list.append(this.btn('Aufgeben', h.resign, 'pause-resign'));
    list.append(this.btn('Einstellungen', h.settings, 'pause-settings'), this.btn('Hauptmenü', h.menu, 'pause-menu'));
    this.show(el('div', { class: 'screen center dim', 'data-testid': 'pause' }, el('div', { class: 'panel menu-panel' }, el('div', { class: 'title-mid', text: 'Pause' }), list)));
  }

  gameOver(o: { title: string; reason: string; good: boolean | null; rematch?: () => void; rematchText?: string; menu: () => void; view: () => void }) {
    const btns = el('div', { class: 'menu-list' });
    if (o.rematch) btns.append(this.btn(o.rematchText ?? 'Revanche', o.rematch, 'over-rematch', 'btn primary'));
    btns.append(this.btn('Brett ansehen', o.view, 'over-view'), this.btn('Hauptmenü', o.menu, 'over-menu'));
    this.show(
      el(
        'div',
        { class: 'screen center dim', 'data-testid': 'gameover' },
        el(
          'div',
          { class: 'panel menu-panel over ' + (o.good === true ? 'win' : o.good === false ? 'lose' : 'draw') },
          el('div', { class: 'title-big over-title', text: o.title, 'data-testid': 'over-title' }),
          el('div', { class: 'muted over-reason', text: o.reason }),
          btns,
        ),
      ),
    );
  }

  /** Kurze Einblendung in der Bildmitte (Schach!, Remis angeboten). */
  banner(text: string, kind: 'check' | 'info' = 'info', ms = 1400) {
    const b = el('div', { class: 'banner ' + kind, text, 'data-testid': 'banner' });
    this.ui.append(b);
    setTimeout(() => b.remove(), ms);
  }

  // ---------- HUD ----------

  hudShow(on: boolean) {
    this.hud.classList.toggle('hidden', !on);
  }

  hudSetup(o: { top: { name: string; color: Color }; bottom: { name: string; color: Color }; menu: () => void; undo?: () => void; clock: boolean }) {
    const block = (who: 'top' | 'bottom', info: { name: string; color: Color }) =>
      el(
        'div',
        { class: 'panel player ' + who, 'data-color': info.color },
        el('div', { class: 'player-row' }, el('span', { class: 'swatch ' + info.color }), el('span', { class: 'player-name', text: info.name }), el('span', { class: 'clock' + (o.clock ? '' : ' hidden'), 'data-clock': info.color, text: '' })),
        el('div', { class: 'captured', 'data-captured': info.color }),
      );
    const buttons = el('div', { class: 'hud-buttons' }, this.btn('Menü', o.menu, 'hud-menu', 'btn small'));
    if (o.undo) buttons.append(this.btn('Zurück', o.undo, 'hud-undo', 'btn small'));
    this.hud.replaceChildren(
      el('div', { class: 'status', 'data-testid': 'status' }),
      block('top', o.top),
      block('bottom', o.bottom),
      el('div', { class: 'panel movelist-panel' }, el('div', { class: 'label', text: 'Züge' }), el('div', { class: 'movelist', 'data-testid': 'movelist' })),
      buttons,
    );
  }

  hudStatus(text: string, alert = false) {
    const s = this.hud.querySelector('.status') as HTMLElement | null;
    if (!s) return;
    s.textContent = text;
    s.classList.toggle('alert', alert);
  }

  hudTurn(turn: Color) {
    for (const p of this.hud.querySelectorAll<HTMLElement>('.player')) p.classList.toggle('active', p.dataset.color === turn);
  }

  hudClock(color: Color, ms: number, running: boolean) {
    const c = this.hud.querySelector(`[data-clock=${color}]`) as HTMLElement | null;
    if (!c) return;
    const s = Math.max(0, Math.ceil(ms / 1000));
    c.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    c.classList.toggle('low', s < 20);
    c.classList.toggle('run', running);
  }

  hudMoves(history: Move[]) {
    const list = this.hud.querySelector('.movelist') as HTMLElement | null;
    if (!list) return;
    const rows: HTMLElement[] = [];
    for (let i = 0; i < history.length; i += 2) {
      const w = history[i];
      const b = history[i + 1];
      const last = i + 2 >= history.length;
      rows.push(
        el(
          'div',
          { class: 'move-row' },
          el('span', { class: 'move-no', text: i / 2 + 1 + '.' }),
          el('span', { class: 'move' + (last && !b ? ' last' : ''), text: sanDe(w.san) }),
          el('span', { class: 'move' + (last && b ? ' last' : ''), text: b ? sanDe(b.san) : '' }),
        ),
      );
    }
    list.replaceChildren(...rows);
    list.scrollTop = list.scrollHeight;
    // geschlagene Figuren
    for (const color of ['w', 'b'] as Color[]) {
      const box = this.hud.querySelector(`[data-captured=${color}]`) as HTMLElement | null;
      if (!box) continue;
      const taken = history.filter((m) => m.color === color && m.captured).map((m) => m.captured!) as PieceSymbol[];
      const order: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];
      taken.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      box.replaceChildren(...taken.map((p) => this.portrait(p, color === 'w' ? 'b' : 'w')));
    }
  }

  /** Kleines Brustbild einer Figur (oberer Teil des Sprites). */
  private portrait(p: PieceSymbol, color: Color): HTMLElement {
    const f = this.sprites().still(p, color, 's');
    const c = el('canvas', { width: 22, height: 22, class: 'portrait', title: PIECE_NAMES[p] }) as HTMLCanvasElement;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    // Kopf und Schultern: Ausschnitt um den oberen Teil der Figur
    const top = Math.max(0, f.ay - 58);
    g.drawImage(f.img, Math.round(f.ax - 11), top + (p === 'r' ? 4 : 2), 22, 22, 0, 0, 22, 22);
    return c;
  }

  hudClear() {
    this.hud.replaceChildren();
  }
}
