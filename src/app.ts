import type { Color, GameEnd, Move, Square } from '../shared/rules.ts';
import { END_TEXT } from '../shared/rules.ts';
import { AiClient } from './ai/client.ts';
import { Engine } from './ai/engine.ts';
import { LEVEL_NAMES, type AiLevel } from './ai/levels.ts';
import { shouldShowBattle } from './battle/kit.ts';
import { BattleRunner } from './battle/runner.ts';
import { GameController, type GameSetup } from './game/controller.ts';
import { loadGame, loadSettings, saveGame, saveSettings, type Settings } from './game/settings.ts';
import type { Actor } from './scene/actor.ts';
import { AtlasSprites } from './scene/atlasSprites.ts';
import { Director } from './scene/director.ts';
import { squareCenter } from './scene/iso.ts';
import { pickSquare } from './scene/picking.ts';
import { PlaceholderSprites } from './scene/placeholderSprites.ts';
import type { SpriteSource } from './scene/sprites.ts';
import { Stage } from './scene/stage.ts';
import { choosePromotion } from './ui/promotion.ts';
import { Screens } from './ui/screens.ts';
import { fitViewport, toLogical } from './ui/viewport.ts';

export type Mode = 'loading' | 'title' | 'menu' | 'game' | 'pause' | 'over';

/** Hält Bühne, Spielschleife, Menüs und die aktuelle Partie. */
export class App {
  readonly canvas: HTMLCanvasElement;
  readonly ui: HTMLElement;
  stage: Stage;
  director: Director;
  battle: BattleRunner;
  sprites: SpriteSource;
  screens: Screens;
  settings: Settings;
  game: GameController | null = null;
  aiClient: AiClient | null = null;
  mode: Mode = 'loading';
  /** Letzte Klicks (für Tests). */
  clickLog: string[] = [];
  protected seen: Set<string>;
  private last = performance.now();

  constructor(readonly root: HTMLElement) {
    this.canvas = root.querySelector('#view') as HTMLCanvasElement;
    this.ui = root.querySelector('#ui') as HTMLElement;
    fitViewport(root);
    this.settings = loadSettings();
    this.seen = new Set(this.settings.seen);
    this.sprites = new PlaceholderSprites();
    this.stage = new Stage(this.canvas, this.sprites);
    this.director = new Director(this.stage);
    this.battle = new BattleRunner(this.stage);
    this.director.hooks.battle = (a, v, m) => this.onCapture(a, v, m);
    this.screens = new Screens(this.ui, () => this.sprites);
    this.applySettings();
    this.bindInput();
  }

  async start() {
    requestAnimationFrame(this.frame);
    // Im Hintergrund-Tab pausiert requestAnimationFrame; Abläufe sollen trotzdem weiterlaufen.
    setInterval(() => {
      const now = performance.now();
      if (now - this.last > 120) this.tick(now);
    }, 50);
    this.screens.loading(0, 'Lade Figuren');
    this.sprites = await AtlasSprites.load('/assets/pieces', new PlaceholderSprites(), (p) => this.screens.loading(p * 0.9, 'Lade Figuren'));
    this.stage.sprites = this.sprites;
    this.screens.loading(1, 'Bereit');
    const q = new URLSearchParams(location.search);
    const start = q.get('start');
    if (start === 'ai') this.startAi((q.get('color') ?? 'w') as Color, Number(q.get('level') ?? 2) as AiLevel);
    else if (start === 'local') this.startLocal();
    else if (start === 'menu') this.showMenu();
    else this.showTitle();
  }

  // ---------- Bildschirme ----------

  protected demoBoard() {
    this.stage.flipped = false;
    this.stage.marks = [];
    this.stage.effects.reset();
    const g = new GameController({ mode: 'local', players: { w: 'human', b: 'human' }, aiLevel: 2, bottom: 'w' }, this.stage, this.director);
    g.syncActors();
  }

  showTitle() {
    this.mode = 'title';
    this.screens.hudShow(false);
    this.demoBoard();
    this.stage.camera.zoom = 1.25;
    this.screens.title(() => this.showMenu());
  }

  showMenu() {
    const fromGame = !!this.game;
    this.endGame();
    this.mode = 'menu';
    this.screens.hudShow(false);
    if (fromGame || !this.stage.actors.length) this.demoBoard();
    this.stage.camera.zoom = 1.15;
    const saved = loadGame();
    this.screens.menu({
      resume: saved ? () => this.resume() : undefined,
      single: () =>
        this.screens.singlePlayer(
          this.settings.aiLevel,
          (c, l) => this.startAi(c === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : c, l),
          () => this.showMenu(),
        ),
      local: () => this.startLocal(),
      online: () => this.showOnline(),
      settings: () => this.screens.settings(this.settings, (s) => this.changeSettings(s), () => this.showMenu()),
      credits: () => this.screens.credits(() => this.showMenu()),
    });
  }

  /** Online-Bildschirm (Phase 7 überschreibt das). */
  showOnline() {
    this.showMenu();
  }

  protected changeSettings(s: Settings) {
    this.settings = s;
    this.applySettings();
    saveSettings(s);
  }

  protected applySettings() {
    this.stage.effects.gore = this.settings.gore;
    if (this.game) {
      this.game.showHints = this.settings.hints;
      this.game.refreshMarks();
    }
  }

  // ---------- Partie ----------

  startAi(human: Color, level: AiLevel) {
    this.settings.aiLevel = level;
    saveSettings(this.settings);
    this.newGame({ mode: 'ai', players: human === 'w' ? { w: 'human', b: 'ai' } : { w: 'ai', b: 'human' }, aiLevel: level, bottom: human });
  }

  startLocal() {
    this.newGame({ mode: 'local', players: { w: 'human', b: 'human' }, aiLevel: this.settings.aiLevel, bottom: 'w' });
  }

  resume() {
    const g = loadGame();
    if (!g) return this.showMenu();
    try {
      this.newGame({ ...g.setup, moves: g.moves });
    } catch {
      saveGame(null);
      this.showMenu();
    }
  }

  protected endGame() {
    this.aiClient?.dispose();
    this.aiClient = null;
    if (this.game && !this.game.end) this.game.end = { winner: null, reason: 'agreement' };
    this.game = null;
  }

  newGame(setup: GameSetup) {
    this.endGame();
    this.stage.effects.reset();
    this.stage.camera.zoom = 1;
    this.stage.camera.x = 480;
    this.stage.camera.y = 270;
    const game = new GameController(setup, this.stage, this.director);
    game.showHints = this.settings.hints;
    if (setup.mode === 'ai') {
      this.aiClient = new AiClient(setup.aiLevel);
      game.ai = this.aiClient;
    }
    game.events = {
      turn: (r) => this.onTurn(r.turn()),
      moved: (m) => this.onMoved(m),
      ended: (end) => this.onEnded(end),
      choosePromotion: (c) => choosePromotion(this.ui, c, this.sprites, () => this.screens.onClick()),
    };
    this.game = game;
    this.mode = 'game';
    this.screens.clear();
    this.setupHud(setup);
    game.start();
    this.screens.hudMoves(game.rules.history());
  }

  protected playerName(setup: GameSetup, c: Color): string {
    const color = c === 'w' ? 'Weiß' : 'Schwarz';
    if (setup.mode === 'ai') return setup.players[c] === 'ai' ? `${color} · KI ${LEVEL_NAMES[setup.aiLevel]}` : `${color} · Du`;
    return color;
  }

  protected setupHud(setup: GameSetup) {
    const top: Color = setup.bottom === 'w' ? 'b' : 'w';
    this.screens.hudSetup({
      top: { name: this.playerName(setup, top), color: top },
      bottom: { name: this.playerName(setup, setup.bottom), color: setup.bottom },
      menu: () => this.openPause(),
      undo: setup.mode !== 'online' ? () => this.game?.undo() : undefined,
      clock: false,
    });
    this.screens.hudShow(true);
  }

  protected onTurn(turn: Color) {
    const g = this.game;
    if (!g) return;
    this.screens.hudTurn(turn);
    const check = g.rules.inCheck();
    let text = `${turn === 'w' ? 'Weiß' : 'Schwarz'} ist am Zug`;
    if (g.setup.mode !== 'local') text = g.setup.players[turn] === 'human' ? 'Du bist am Zug' : g.setup.mode === 'ai' ? 'Die KI überlegt' : 'Der Gegner ist am Zug';
    if (check) text = 'Schach! ' + text;
    this.screens.hudStatus(text, check);
    this.screens.hudMoves(g.rules.history());
  }

  protected onMoved(_m: Move) {
    const g = this.game;
    if (!g) return;
    if (g.rules.inCheck() && !g.rules.end()) this.screens.banner('Schach!', 'check');
    if (g.setup.mode !== 'online') saveGame({ setup: { ...g.setup, moves: undefined }, moves: g.historyUci(), savedAt: Date.now() });
    this.screens.hudMoves(g.rules.history());
  }

  /** Ergebnistext aus Sicht des Spielers. */
  protected resultFor(end: GameEnd, setup: GameSetup): { title: string; good: boolean | null } {
    if (!end.winner) return { title: 'Remis', good: null };
    if (setup.mode === 'local') return { title: end.winner === 'w' ? 'Weiß siegt' : 'Schwarz siegt', good: true };
    const me: Color = setup.players.w === 'human' ? 'w' : 'b';
    return end.winner === me ? { title: 'Sieg!', good: true } : { title: 'Niederlage', good: false };
  }

  protected onEnded(end: GameEnd) {
    const g = this.game;
    if (!g) return;
    if (g.setup.mode !== 'online') saveGame(null);
    this.screens.hudMoves(g.rules.history());
    const r = this.resultFor(end, g.setup);
    this.screens.hudStatus(`${r.title} - ${END_TEXT[end.reason]}`, false);
    this.mode = 'over';
    const setup = g.setup;
    setTimeout(() => {
      if (this.game !== g) return;
      this.screens.gameOver({
        title: r.title,
        reason: END_TEXT[end.reason],
        good: r.good,
        rematch: () => {
          if (setup.mode === 'ai') this.startAi(setup.players.w === 'human' ? 'b' : 'w', setup.aiLevel);
          else this.startLocal();
        },
        rematchText: setup.mode === 'ai' ? 'Revanche (Farben tauschen)' : 'Revanche',
        menu: () => this.showMenu(),
        view: () => this.screens.clear(),
      });
    }, 900);
  }

  openPause() {
    const g = this.game;
    if (!g) return;
    if (this.mode === 'over') return this.showMenu();
    this.mode = 'pause';
    const back = () => {
      this.mode = 'game';
      this.screens.clear();
    };
    this.screens.pause({
      resume: back,
      undo:
        g.setup.mode !== 'online'
          ? () => {
              g.undo();
              back();
            }
          : undefined,
      resign:
        g.setup.mode === 'ai'
          ? () => {
              back();
              const me: Color = g.setup.players.w === 'human' ? 'w' : 'b';
              g.finish({ winner: me === 'w' ? 'b' : 'w', reason: 'resign' });
            }
          : undefined,
      settings: () => this.screens.settings(this.settings, (s) => this.changeSettings(s), () => this.openPause(), true),
      menu: () => this.showMenu(),
    });
  }

  // ---------- Kämpfe ----------

  protected async onCapture(a: Actor, v: Actor, m: Move) {
    const show = shouldShowBattle(this.settings.battles, this.seen, a.kind, v.kind);
    if (this.settings.seen.length !== this.seen.size) {
      this.settings.seen = [...this.seen];
      saveSettings(this.settings);
    }
    if (show) await this.battle.run(a, v, m);
    else await this.battle.quick(a, v, m);
  }

  // ---------- Eingabe und Schleife ----------

  private squareAt(clientX: number, clientY: number): Square | null {
    const p = toLogical(this.canvas, clientX, clientY);
    const w = this.stage.viewToWorld(p.x, p.y);
    const g = this.game;
    const targets = g?.selected ? new Set(g.rules.movesFrom(g.selected).map((m) => m.to)) : null;
    return pickSquare(this.stage, w.x, w.y, (sq) => !!targets?.has(sq));
  }

  private bindInput() {
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'game' && this.mode !== 'over') return;
      // Klick während eines laufenden Zuges spult vor
      if (this.game?.busy && this.stage.tweens.busy) {
        this.stage.tweens.skipAll();
        this.clickLog.push('skip');
        return;
      }
      const sq = this.squareAt(e.clientX, e.clientY);
      this.clickLog.push(sq ?? '-');
      if (this.clickLog.length > 20) this.clickLog.shift();
      this.game?.click(sq);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.game || this.mode !== 'game') return;
      const sq = this.squareAt(e.clientX, e.clientY);
      this.game.setHover(sq);
      const p = sq ? this.game.rules.pieceAt(sq) : null;
      this.canvas.style.cursor = this.game.isHumanTurn() && (p?.color === this.game.rules.turn() || this.game.selected) ? 'pointer' : 'default';
    });
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape') {
        if (this.mode === 'game' || this.mode === 'over') this.openPause();
        else if (this.mode === 'pause') {
          this.mode = 'game';
          this.screens.clear();
        }
      }
      if ((e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') && this.mode === 'game') this.game?.undo();
      if (e.key === ' ' && this.game?.busy) this.stage.tweens.skipAll();
    });
  }

  protected tick(now: number) {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.mode === 'title' || this.mode === 'menu') {
      // Langsame Kamerafahrt über das Brett im Hintergrund
      const t = now / 1000;
      this.stage.camera.x = 480 + Math.sin(t * 0.12) * 60;
      this.stage.camera.y = 250 + Math.cos(t * 0.09) * 20;
    }
    this.stage.update(dt);
    this.stage.draw();
  }

  private frame = (now: number) => {
    requestAnimationFrame(this.frame);
    this.tick(now);
  };

  // ---------- Testhilfen ----------

  /** Engine-Vorschlag für die Seite am Zug (feste Tiefe, ohne Buch). */
  suggestMove(depth: number): string | null {
    const e = new Engine(this.game!.rules.fen());
    return e.think({ maxDepth: depth, timeMs: 1000 }).move;
  }

  /** Feldmitte in Client-Koordinaten. */
  squareToClient(sq: Square) {
    const c = squareCenter(sq, this.stage.flipped);
    const vp = this.stage.worldToView(c.x, c.y);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (vp.x / 960) * r.width, y: r.top + (vp.y / 540) * r.height };
  }
}
