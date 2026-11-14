import { START_FEN, uciToMove, type Color, type MoveInput, type Rules } from '../../shared/rules.ts';
import type { MoveProvider } from '../game/controller.ts';
import type { AiLevel } from './levels.ts';
import type { AiRequest, AiResponse } from './worker.ts';

/** Spricht mit der Engine im Web Worker. Mindestdenkzeit, damit die KI nicht hektisch wirkt. */
export class AiClient implements MoveProvider {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, (m: MoveInput | null) => void>();
  level: AiLevel;
  minThinkMs = 450;

  constructor(level: AiLevel) {
    this.level = level;
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<AiResponse>) => {
      const cb = this.pending.get(e.data.id);
      this.pending.delete(e.data.id);
      cb?.(e.data.move ? uciToMove(e.data.move) : null);
    };
  }

  request(rules: Rules, _color: Color): Promise<MoveInput | null> {
    const id = this.nextId++;
    const t0 = performance.now();
    const req: AiRequest = { id, fen: rules.fen(), startFen: START_FEN, history: rules.historyUci(), level: this.level };
    return new Promise((resolve) => {
      this.pending.set(id, (m) => {
        const wait = Math.max(0, this.minThinkMs - (performance.now() - t0));
        setTimeout(() => resolve(m), wait);
      });
      this.worker.postMessage(req);
    });
  }

  cancel() {
    // Ergebnisse alter Anfragen verwirft der Controller über sein Token
  }

  dispose() {
    this.worker.terminate();
    this.pending.clear();
  }
}
