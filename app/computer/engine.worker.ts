/// <reference lib="webworker" />
// Runs the chess engine off the main thread so the board never freezes while
// the computer thinks. Bundled by Next/webpack via `new URL(..., import.meta.url)`.

import { bestMove } from '../../lib/engine';
import type { EngineLevel } from '../../lib/engine-levels';

export interface EngineRequest {
  id: number;
  fen: string;
  level: EngineLevel;
}
export interface EngineResponse {
  id: number;
  move: { from: string; to: string; promotion?: string } | null;
}

self.onmessage = (e: MessageEvent<EngineRequest>) => {
  const { id, fen, level } = e.data;
  let move: EngineResponse['move'] = null;
  try {
    move = bestMove(fen, level);
  } catch {
    move = null;
  }
  (self as unknown as Worker).postMessage({ id, move } as EngineResponse);
};
