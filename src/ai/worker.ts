/// <reference lib="webworker" />
import { chooseMove, type AiLevel } from './levels.ts';

export interface AiRequest {
  id: number;
  fen: string;
  startFen: string;
  history: string[];
  level: AiLevel;
}

export interface AiResponse {
  id: number;
  move: string | null;
  ms: number;
}

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const t0 = performance.now();
  const { id, fen, startFen, history, level } = e.data;
  const move = chooseMove(fen, startFen, history, level);
  const res: AiResponse = { id, move, ms: Math.round(performance.now() - t0) };
  (self as unknown as Worker).postMessage(res);
};
