import { CLOCK_PRESETS, normalizeCode, type ClockConfig, type RoomState } from '../shared/protocol.ts';
import { END_TEXT, type Color, type GameEnd } from '../shared/rules.ts';
import { App } from './app.ts';
import type { GameSetup } from './game/controller.ts';
import { NetClient } from './net/client.ts';
import { button, el } from './ui/dom.ts';

/** App mit Online-Modus: Räume, Abgleich mit dem autoritativen Server, Uhr. */
export class OnlineApp extends App {
  net: NetClient | null = null;
  private room: RoomState | null = null;
  private gameNo = 0;
  private offerBox: HTMLElement | null = null;
  private rematchSent = false;

  async start() {
    await super.start();
    const room = new URLSearchParams(location.search).get('room');
    if (room) this.joinRoom(normalizeCode(room));
  }

  private ensureNet(): NetClient {
    if (!this.net) {
      this.net = new NetClient();
      this.net.events = {
        welcome: () => {},
        state: (s) => this.onRoomState(s),
        error: (code, msg) => this.onNetError(code, msg),
        connection: (st) => this.onConnection(st),
      };
    }
    this.net.connect();
    return this.net;
  }

  // ---------- Menü ----------

  showOnline() {
    this.mode = 'menu';
    let clock: ClockConfig | null = CLOCK_PRESETS[2].clock;
    let color: Color | 'random' = 'random';
    const clockRow = el('div', { class: 'choice-row' });
    const colorRow = el('div', { class: 'choice-row' });
    const renderClock = () =>
      clockRow.replaceChildren(
        ...CLOCK_PRESETS.map((p, i) =>
          button(p.label, () => {
            this.screens.onClick();
            clock = p.clock;
            renderClock();
          }, 'btn small choice' + (clock === p.clock ? ' on' : ''), 'clock-' + i),
        ),
      );
    const renderColor = () =>
      colorRow.replaceChildren(
        ...(
          [
            ['w', 'Weiß'],
            ['b', 'Schwarz'],
            ['random', 'Zufall'],
          ] as const
        ).map(([c, label]) =>
          button(label, () => {
            this.screens.onClick();
            color = c;
            renderColor();
          }, 'btn small choice' + (color === c ? ' on' : ''), 'ocolor-' + c),
        ),
      );
    renderClock();
    renderColor();
    const code = el('input', { type: 'text', maxlength: 6, placeholder: 'CODE', 'data-testid': 'join-code', 'aria-label': 'Raumcode' }) as HTMLInputElement;
    const err = el('div', { class: 'muted', 'data-testid': 'online-error' });
    const join = () => {
      const c = normalizeCode(code.value);
      if (c.length < 5) {
        err.textContent = 'Der Code hat fünf Zeichen.';
        return;
      }
      this.joinRoom(c);
    };
    code.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join();
    });
    const node = el(
      'div',
      { class: 'screen center', 'data-testid': 'online' },
      el(
        'div',
        { class: 'panel form-panel' },
        el('div', { class: 'title-mid', text: 'Online gegen einen Freund' }),
        el('div', { class: 'label', text: 'Neuen Raum erstellen' }),
        el('div', { class: 'muted', text: 'Bedenkzeit' }),
        clockRow,
        el('div', { class: 'muted', text: 'Deine Farbe' }),
        colorRow,
        el('div', { class: 'row-end' }, button('Raum erstellen', () => {
          this.screens.onClick();
          this.createRoom(clock, color);
        }, 'btn small primary', 'create-room')),
        el('div', { class: 'label', text: 'Einem Raum beitreten' }),
        el('div', { class: 'choice-row' }, code, button('Beitreten', () => {
          this.screens.onClick();
          join();
        }, 'btn small primary', 'join-room')),
        err,
        el('div', { class: 'row-end' }, button('Zurück', () => {
          this.screens.onClick();
          this.leaveOnline();
          this.showMenu();
        }, 'btn small', 'back')),
      ),
    );
    this.screens.clear();
    (this.ui.querySelector('.screen-layer') as HTMLElement).replaceChildren(node);
  }

  private createRoom(clock: ClockConfig | null, color: Color | 'random') {
    const net = this.ensureNet();
    net.forget();
    this.room = null;
    net.send({ t: 'create', clock, color });
    this.showWaiting('Erstelle Raum');
  }

  joinRoom(code: string) {
    const net = this.ensureNet();
    if (net.code !== code) net.forget();
    this.room = null;
    net.send({ t: 'join', code });
    this.showWaiting('Trete bei');
  }

  private showWaiting(text: string, code?: string) {
    this.mode = 'menu';
    const link = code ? `${location.origin}${location.pathname}?room=${code}` : '';
    const node = el(
      'div',
      { class: 'screen center', 'data-testid': 'waiting' },
      el(
        'div',
        { class: 'panel form-panel' },
        el('div', { class: 'title-mid', text: code ? 'Raum ' + code : text }),
        code ? el('div', { class: 'room-code', 'data-testid': 'room-code', text: code }) : el('div', { class: 'muted blink', text: '…' }),
        code ? el('div', { class: 'muted', text: 'Schicke deinem Freund den Code oder diesen Link:' }) : null,
        code ? el('div', { class: 'room-link', text: link }) : null,
        code
          ? el('div', { class: 'choice-row' }, button('Link kopieren', () => {
              this.screens.onClick();
              navigator.clipboard?.writeText(link).then(() => this.screens.banner('Link kopiert'), () => {});
            }, 'btn small', 'copy-link'))
          : null,
        code ? el('div', { class: 'muted blink', text: 'Warte auf den Gegner' }) : null,
        el('div', { class: 'row-end' }, button('Abbrechen', () => {
          this.screens.onClick();
          this.leaveOnline();
          this.showMenu();
        }, 'btn small', 'cancel')),
      ),
    );
    (this.ui.querySelector('.screen-layer') as HTMLElement).replaceChildren(node);
  }

  private leaveOnline() {
    if (this.net) {
      if (this.net.code) this.net.send({ t: 'leave' });
      this.net.forget();
      setTimeout(() => this.net?.close(), 200);
    }
    this.net = null;
    this.room = null;
    this.gameNo = 0;
  }

  // ---------- Abgleich ----------

  private onNetError(code: string, msg: string) {
    if (this.game?.setup.mode === 'online') {
      if (code === 'illegal' || code === 'not-your-turn') this.screens.banner(msg);
      return;
    }
    const err = this.ui.querySelector('[data-testid=online-error]');
    if (err) err.textContent = msg;
    else {
      this.showOnline();
      const e2 = this.ui.querySelector('[data-testid=online-error]');
      if (e2) e2.textContent = msg;
    }
  }

  private onConnection(st: 'connecting' | 'open' | 'lost') {
    if (st === 'lost' && this.game?.setup.mode === 'online') this.screens.hudStatus('Verbindung weg, verbinde neu', true);
    if (st === 'open' && this.game?.setup.mode === 'online' && this.room) this.onTurn(this.game.rules.turn());
  }

  private onRoomState(s: RoomState) {
    this.room = s;
    const both = s.players.w !== 'empty' && s.players.b !== 'empty';
    if (!both) {
      if (this.game?.setup.mode !== 'online') this.showWaiting('', s.code);
      return;
    }
    if (!this.game || this.game.setup.mode !== 'online' || s.game !== this.gameNo) {
      this.startOnline(s);
      return;
    }
    this.syncGame(s);
  }

  private startOnline(s: RoomState) {
    this.gameNo = s.game;
    this.rematchSent = false;
    const setup: GameSetup = {
      mode: 'online',
      players: s.you === 'w' ? { w: 'human', b: 'remote' } : { w: 'remote', b: 'human' },
      aiLevel: this.settings.aiLevel,
      bottom: s.you,
      moves: s.moves,
    };
    this.newGame(setup);
    this.syncGame(s);
  }

  newGame(setup: GameSetup) {
    super.newGame(setup);
    if (setup.mode !== 'online' || !this.game) return;
    const g = this.game;
    g.externalEnd = true;
    const prevLocal = g.events.localMove;
    g.events.localMove = (m) => {
      prevLocal?.(m);
      const ply = g.rules.history().length;
      this.net?.send({ t: 'move', uci: m.from + m.to + (m.promotion ?? ''), ply });
    };
  }

  private syncGame(s: RoomState) {
    const g = this.game;
    if (!g) return;
    const local = g.rules.historyUci();
    const server = s.moves;
    const prefix = local.every((m, i) => server[i] === m);
    if (!prefix || local.length > server.length + 1) {
      // Abweichung: Server hat recht
      g.resync(server);
    } else if (server.length > local.length) {
      for (const uci of server.slice(local.length)) {
        g.apply({ from: uci.slice(0, 2) as never, to: uci.slice(2, 4) as never, promotion: (uci[4] as never) || undefined });
      }
    }
    this.updateOffers(s);
    this.updatePresence(s);
    if (s.result && !g.end) {
      const result = s.result;
      g.whenIdle().then(() => {
        if (this.game === g && !g.end) g.finish(result);
      });
    }
    if (s.result && this.mode === 'over') this.refreshOver(s);
  }

  private updatePresence(s: RoomState) {
    const opp: Color = s.you === 'w' ? 'b' : 'w';
    if (s.players[opp] === 'away' && !s.result && s.awayDeadline) {
      const left = Math.max(0, Math.round((s.awayDeadline - s.serverTime) / 1000));
      this.screens.hudStatus(`Gegner getrennt. Kommt er nicht in ${left} s zurück, gewinnst du.`, true);
    } else if (this.game && !s.result) this.onTurn(this.game.rules.turn());
  }

  private updateOffers(s: RoomState) {
    this.offerBox?.remove();
    this.offerBox = null;
    const opp: Color = s.you === 'w' ? 'b' : 'w';
    if (s.drawOffer === opp && !s.result) {
      this.offerBox = el(
        'div',
        { class: 'panel offer', 'data-testid': 'draw-offer' },
        el('div', { text: 'Der Gegner bietet Remis an.' }),
        el(
          'div',
          { class: 'choice-row' },
          button('Annehmen', () => this.net?.send({ t: 'answerDraw', accept: true }), 'btn small primary', 'draw-accept'),
          button('Ablehnen', () => this.net?.send({ t: 'answerDraw', accept: false }), 'btn small', 'draw-decline'),
        ),
      );
      this.ui.append(this.offerBox);
    }
  }

  // ---------- Spielende, Pause ----------

  protected resultFor(end: GameEnd, setup: GameSetup) {
    if (setup.mode !== 'online') return super.resultFor(end, setup);
    if (!end.winner) return { title: 'Remis', good: null };
    return end.winner === setup.bottom ? { title: 'Sieg!', good: true } : { title: 'Niederlage', good: false };
  }

  protected onEnded(end: GameEnd) {
    if (this.game?.setup.mode !== 'online') return super.onEnded(end);
    const g = this.game;
    this.screens.hudMoves(g.rules.history());
    const r = this.resultFor(end, g.setup);
    this.screens.hudStatus(`${r.title} - ${END_TEXT[end.reason]}`);
    this.mode = 'over';
    setTimeout(() => {
      if (this.game === g && this.room) this.refreshOver(this.room);
    }, 900);
  }

  private refreshOver(s: RoomState) {
    const g = this.game;
    if (!g?.end || g.setup.mode !== 'online') return;
    const r = this.resultFor(g.end, g.setup);
    const opp: Color = s.you === 'w' ? 'b' : 'w';
    const theyWant = s.rematchOffer === opp;
    const iWant = s.rematchOffer === s.you || this.rematchSent;
    this.screens.gameOver({
      title: r.title,
      reason: END_TEXT[g.end.reason] + (theyWant ? ' · Der Gegner will eine Revanche' : iWant ? ' · Warte auf den Gegner' : ''),
      good: r.good,
      rematch: iWant
        ? undefined
        : () => {
            this.rematchSent = true;
            this.net?.send({ t: 'rematch' });
            if (this.room) this.refreshOver(this.room);
          },
      rematchText: theyWant ? 'Revanche annehmen' : 'Revanche anbieten',
      menu: () => {
        this.leaveOnline();
        this.showMenu();
      },
      view: () => this.screens.clear(),
    });
  }

  openPause() {
    const g = this.game;
    if (!g || g.setup.mode !== 'online') return super.openPause();
    if (this.mode === 'over') {
      if (this.room) this.refreshOver(this.room);
      return;
    }
    this.mode = 'pause';
    const back = () => {
      this.mode = 'game';
      this.screens.clear();
    };
    this.screens.pause({
      resume: back,
      draw: () => {
        this.net?.send({ t: 'offerDraw' });
        this.screens.banner('Remis angeboten');
        back();
      },
      resign: () => {
        this.net?.send({ t: 'resign' });
        back();
      },
      settings: () => this.screens.settings(this.settings, (s) => this.changeSettings(s), () => this.openPause(), true),
      menu: () => {
        this.leaveOnline();
        this.showMenu();
      },
    });
  }

  protected setupHud(setup: GameSetup) {
    if (setup.mode !== 'online') return super.setupHud(setup);
    const top: Color = setup.bottom === 'w' ? 'b' : 'w';
    const name = (c: Color) => (c === 'w' ? 'Weiß' : 'Schwarz') + (c === setup.bottom ? ' · Du' : ' · Gegner');
    this.screens.hudSetup({
      top: { name: name(top), color: top },
      bottom: { name: name(setup.bottom), color: setup.bottom },
      menu: () => this.openPause(),
      clock: !!this.room?.clock,
    });
    this.screens.hudShow(true);
  }

  protected tick(now: number) {
    super.tick(now);
    const s = this.room;
    if (s?.clock && this.game?.setup.mode === 'online' && this.net) {
      const serverNow = this.net.serverNow();
      for (const c of ['w', 'b'] as Color[]) {
        const running = s.clock.running === c && !s.result;
        const ms = s.clock[c] - (running ? Math.max(0, serverNow - s.clock.graceUntil) : 0);
        this.screens.hudClock(c, ms, running && serverNow >= s.clock.graceUntil);
      }
    }
  }

  showMenu() {
    if (this.game?.setup.mode === 'online') this.leaveOnline();
    this.offerBox?.remove();
    super.showMenu();
  }
}
