import type { Square } from '../shared/rules.ts';
import { END_TEXT } from '../shared/rules.ts';
import { GameController, type GameSetup } from './game/controller.ts';
import { Director } from './scene/director.ts';
import { pickSquare } from './scene/picking.ts';
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
    this.newGame({ mode: 'local', players: { w: 'human', b: 'human' }, aiLevel: 2, bottom: 'w' });
    requestAnimationFrame(this.frame);
    // Im Hintergrund-Tab pausiert requestAnimationFrame; Abläufe sollen trotzdem weiterlaufen.
    setInterval(() => {
      const now = performance.now();
      if (now - this.last > 120) this.tick(now);
    }, 50);
  }

  newGame(setup: GameSetup) {
    const game = new GameController(setup, this.stage, this.director);
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
      if (this.stage.tweens.busy) {
        this.stage.tweens.skipAll();
        return;
      }
      this.game?.click(this.squareAt(e.clientX, e.clientY));
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

  /** Testhilfe: Feldmitte in Client-Koordinaten. */
  squareToClient(sq: Square) {
    const b = { x: sq.charCodeAt(0) - 97 + 0.5, y: sq.charCodeAt(1) - 49 + 0.5 };
    const u = this.stage.flipped ? 8 - b.x : b.x;
    const v = this.stage.flipped ? 8 - b.y : b.y;
    const wx = 480 - 256 + ((u + v) * 64) / 2;
    const wy = 300 + ((u - v) * 32) / 2;
    const vp = this.stage.worldToView(wx, wy);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (vp.x / 960) * r.width, y: r.top + (vp.y / 540) * r.height };
  }
}
