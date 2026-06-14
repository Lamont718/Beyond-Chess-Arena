/// <reference lib="webworker" />
// Post-game analysis off the main thread: replays the game, scores every move at
// a shallow depth, and classifies each as good / inaccuracy / mistake / blunder
// by how much it loses versus the engine's best move. Posts progress as it goes.

import { Chess } from 'chess.js';
import { analyzeMoves, MATE } from '../../../lib/engine';

const ANALYSIS = { depth: 3, nodeCap: 120000, timeMs: 350 };

export type MoveLabel = 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface PlyAnalysis {
  ply: number; // 0-based half-move index
  mover: 'w' | 'b';
  san: string;
  fenBefore: string;
  fenAfter: string;
  bestUci: string; // engine's recommended move
  bestSan: string;
  cpLoss: number; // centipawns lost vs best (0 = played the best move)
  label: MoveLabel;
}

export interface AnalysisRequest {
  sanMoves: string[];
}
export type AnalysisResponse =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; plies: PlyAnalysis[] };

function classify(cpLoss: number): MoveLabel {
  if (cpLoss >= 300) return 'blunder';
  if (cpLoss >= 150) return 'mistake';
  if (cpLoss >= 80) return 'inaccuracy';
  return 'good';
}

self.onmessage = (e: MessageEvent<AnalysisRequest>) => {
  const { sanMoves } = e.data;
  const game = new Chess();
  const plies: PlyAnalysis[] = [];

  for (let i = 0; i < sanMoves.length; i++) {
    const fenBefore = game.fen();
    const mover = game.turn();

    const scores = analyzeMoves(fenBefore, ANALYSIS);
    let bestScore = -Infinity;
    let bestUci = '';
    for (const s of scores) {
      if (s.score > bestScore) {
        bestScore = s.score;
        bestUci = s.uci;
      }
    }

    // Translate the engine's best move (uci) into SAN for display.
    let bestSan = bestUci;
    try {
      const probe = new Chess(fenBefore);
      const mv = probe.move({
        from: bestUci.slice(0, 2),
        to: bestUci.slice(2, 4),
        promotion: bestUci.length > 4 ? bestUci[4] : undefined,
      });
      if (mv) bestSan = mv.san;
    } catch {
      /* keep uci */
    }

    // Play the actual move and find its score.
    let actualUci = '';
    try {
      const mv = game.move(sanMoves[i]);
      if (!mv) break;
      actualUci = mv.from + mv.to + (mv.promotion || '');
    } catch {
      break; // corrupt move list — stop gracefully
    }
    const actual = scores.find((s) => s.uci === actualUci);
    const actualScore = actual ? actual.score : bestScore;

    // Clamp huge mate-swing numbers so the UI shows a sane "centipawn" figure.
    let cpLoss = Math.max(0, bestScore - actualScore);
    if (cpLoss > MATE / 2) cpLoss = 1000;

    plies.push({
      ply: i,
      mover,
      san: sanMoves[i],
      fenBefore,
      fenAfter: game.fen(),
      bestUci,
      bestSan,
      cpLoss: Math.round(cpLoss),
      label: classify(cpLoss),
    });

    (self as unknown as Worker).postMessage({ type: 'progress', done: i + 1, total: sanMoves.length } as AnalysisResponse);
  }

  (self as unknown as Worker).postMessage({ type: 'done', plies } as AnalysisResponse);
};
