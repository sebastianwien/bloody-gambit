import type { Square } from '../shared/rules.ts';
import { END_TEXT } from '../shared/rules.ts';
import { AiClient } from './ai/client.ts';
import { Engine } from './ai/engine.ts';
import type { AiLevel } from './ai/levels.ts';
import { GameController, type GameSetup } from './game/controller.ts';
import { Director } from './scene/director.ts';
import { pickSquare } from './scene/picking.ts';
import { squareCenter } from './scene/iso.ts';
import { PlaceholderSprites } from './scene/placeholderSprites.ts';
import type { SpriteSource } from './scene/sprites.ts';
import { Stage } from './scene/stage.ts';
import { el } from './ui/dom.ts';
import { choosePromotion } from './ui/promotion.ts';
import { fitViewport, toLogical } from './ui/viewport.ts';

/** Hält Bühne, Spielschleife und die aktuelle Partie. */
export class App {
  readonly canvas: HTMLCanvasElement;
  readonly ui: HTMLElement;
  stage: Stage;
  director: Director;
  sprites: SpriteSource;
  game: GameController | null = null;
  aiClient: AiClient | null = null;
  /** Letzte Klicks (für Tests). */
  clickLog: string[] = [];
  private last = performance.now();
  private status: HTMLElement;

  constructor(readonly root: HTMLElement) {
    this.canvas = root.querySelector('#view') as HTMLCanvasElement;
    this.ui = root.querySelector('#ui') as HTMLElement;
    fitViewport(root);
    this.sprites = new PlaceholderSprites();
    this.stage = new Stage(this.canvas, this.sprites);
    this.director = new Director(this.stage);
    this.status = el('div', { class: 'panel passthrough', 'data-testid': 'status', style: 'position:absolute;left:16px;top:16px;font-size:20px;line-height:20px' });
    this.ui.append(this.status);
    this.bindInput();
  }

  async start() {
    const q = new URLSearchParams(location.search);
    if (q.get('start') === 'ai') {
      const human = (q.get('color') ?? 'w') as 'w' | 'b';
      const level = Number(q.get('level') ?? 2) as AiLevel;
      this.newGame({
        mode: 'ai',
        players: human === 'w' ? { w: 'human', b: 'ai' } : { w: 'ai', b: 'human' },
        aiLevel: level,
        bottom: human,
      });
    } else this.newGame({ mode: 'local', players: { w: 'human', b: 'human' }, aiLevel: 2, bottom: 'w' });
    requestAnimationFrame(this.frame);
    // Im Hintergrund-Tab pausiert requestAnimationFrame; Abläufe sollen trotzdem weiterlaufen.
    setInterval(() => {
      const now = performance.now();
      if (now - this.last > 120) this.tick(now);
    }, 50);
  }

  newGame(setup: GameSetup) {
    this.aiClient?.dispose();
    this.aiClient = null;
    const game = new GameController(setup, this.stage, this.director);
    if (setup.mode === 'ai') {
      this.aiClient = new AiClient(setup.aiLevel);
      game.ai = this.aiClient;
    }
    game.events = {
      turn: (r) => this.setStatus(r.turn() === 'w' ? 'Weiß ist am Zug' : 'Schwarz ist am Zug'),
      ended: (end) => this.setStatus(END_TEXT[end.reason] + (end.winner ? (end.winner === 'w' ? ' - Weiß gewinnt' : ' - Schwarz gewinnt') : ' - Remis')),
      choosePromotion: (c) => choosePromotion(this.ui, c, this.sprites),
    };
    this.game = game;
    game.start();
  }

  setStatus(t: string) {
    this.status.textContent = t;
  }

  private squareAt(clientX: number, clientY: number): Square | null {
    const p = toLogical(this.canvas, clientX, clientY);
    const w = this.stage.viewToWorld(p.x, p.y);
    const g = this.game;
    const targets = g?.selected ? new Set(g.rules.movesFrom(g.selected).map((m) => m.to)) : null;
    return pickSquare(this.stage, w.x, w.y, (sq) => !!targets?.has(sq));
  }

  private bindInput() {
    this.canvas.addEventListener('pointerdown', (e) => {
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
      if (!this.game) return;
      const sq = this.squareAt(e.clientX, e.clientY);
      this.game.setHover(sq);
      const p = sq ? this.game.rules.pieceAt(sq) : null;
      this.canvas.style.cursor = this.game.isHumanTurn() && (p?.color === this.game.rules.turn() || this.game.selected) ? 'pointer' : 'default';
    });
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'z' || e.key === 'Backspace') && this.game) this.game.undo();
    });
  }

  private tick(now: number) {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.stage.update(dt);
    this.stage.draw();
  }

  private frame = (now: number) => {
    this.tick(now);
    requestAnimationFrame(this.frame);
  };

  /** Testhilfe: Engine-Vorschlag für die Seite am Zug (feste Tiefe, ohne Buch). */
  suggestMove(depth: number): string | null {
    const e = new Engine(this.game!.rules.fen());
    return e.think({ maxDepth: depth, timeMs: 1000 }).move;
  }

  /** Testhilfe: Feldmitte in Client-Koordinaten. */
  squareToClient(sq: Square) {
    const c = squareCenter(sq, this.stage.flipped);
    const vp = this.stage.worldToView(c.x, c.y);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (vp.x / 960) * r.width, y: r.top + (vp.y / 540) * r.height };
  }
}
