// Self-contained chess engine (no external API). Alpha-beta negamax with
// piece-square tables, iterative deepening, and a node/time budget so it stays
// snappy in the browser. Strength is tuned per level for kids.

import { Chess, Move } from 'chess.js';
import type { EngineLevel } from './engine-levels';

// Re-export so existing imports of these from '@/lib/engine' keep working.
export { ENGINE_LEVELS } from './engine-levels';
export type { EngineLevel } from './engine-levels';

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100000;

// Piece-square tables (white's view, a8..h1 reading like FEN rows). Encourage
// sensible development, center control, king safety.
// prettier-ignore
const PST: Record<string, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

function squareIndex(square: string, color: 'w' | 'b'): number {
  const file = square.charCodeAt(0) - 97; // a=0
  const rank = parseInt(square[1], 10); // 1..8
  // White tables are written from rank 8 (top) to rank 1 (bottom).
  const row = color === 'w' ? 8 - rank : rank - 1;
  const col = color === 'w' ? file : 7 - file;
  return row * 8 + col;
}

/** Static evaluation from the perspective of the side to move. */
function evaluate(game: Chess): number {
  let score = 0;
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const base = VALUE[piece.type] + (PST[piece.type]?.[squareIndex(piece.square, piece.color)] ?? 0);
      score += piece.color === 'w' ? base : -base;
    }
  }
  return game.turn() === 'w' ? score : -score;
}

function captureScore(m: Move): number {
  let s = 0;
  if (m.captured) s += 10 * VALUE[m.captured] - VALUE[m.piece]; // MVV-LVA
  if (m.promotion) s += VALUE[m.promotion];
  return s;
}

function orderMoves(moves: Move[]): Move[] {
  // Captures/promotions first (best alpha-beta pruning).
  return [...moves].sort((a, b) => captureScore(b) - captureScore(a));
}

interface SearchState {
  nodes: number;
  cap: number;
  deadline: number;
  aborted: boolean;
}

function outOfBudget(st: SearchState): boolean {
  if (st.aborted) return true;
  // Check the clock only every so often (Date.now is comparatively costly).
  if ((st.nodes & 1023) === 0 && Date.now() > st.deadline) st.aborted = true;
  if (st.nodes >= st.cap) st.aborted = true;
  return st.aborted;
}

/**
 * Quiescence search: once we hit the depth limit, keep resolving captures (and
 * check evasions) so we never evaluate in the middle of a trade — this is what
 * stops the "beginner" hanging-into-a-recapture blunders.
 */
function quiesce(game: Chess, alpha: number, beta: number, st: SearchState): number {
  st.nodes++;
  if (outOfBudget(st)) return evaluate(game);

  const inCheck = game.inCheck();
  if (!inCheck) {
    const standPat = evaluate(game);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
  } else if (game.isCheckmate()) {
    return -MATE;
  }

  // In check: consider every move (escape). Otherwise: only captures/promotions.
  const all = game.moves({ verbose: true }) as Move[];
  const moves = inCheck ? orderMoves(all) : orderMoves(all.filter((m) => m.captured || m.promotion));

  for (const m of moves) {
    game.move(m);
    const score = -quiesce(game, -beta, -alpha, st);
    game.undo();
    if (st.aborted) return alpha;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(game: Chess, depth: number, alpha: number, beta: number, st: SearchState): number {
  st.nodes++;
  if (game.isCheckmate()) return -MATE + (50 - depth); // prefer faster mates / later getting mated
  if (game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial() || game.isDraw())
    return 0;
  if (depth <= 0) return quiesce(game, alpha, beta, st);

  const moves = orderMoves(game.moves({ verbose: true }) as Move[]);
  let best = -Infinity;
  for (const m of moves) {
    game.move(m);
    const score = -negamax(game, depth - 1, -beta, -alpha, st);
    game.undo();
    if (st.aborted) return best === -Infinity ? alpha : best;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // beta cutoff
  }
  return best;
}

/** Choose the engine's move for a position. Returns {from,to,promotion} or null. */
export function bestMove(fen: string, level: EngineLevel): { from: string; to: string; promotion?: string } | null {
  const game = new Chess(fen);
  const legal = game.moves({ verbose: true }) as Move[];
  if (legal.length === 0) return null;
  if (legal.length === 1) return pick(legal[0]);

  // Easy bots sometimes just play a random legal move (a "blunder").
  if (level.randomChance > 0 && Math.random() < level.randomChance) {
    return pick(legal[Math.floor(Math.random() * legal.length)]);
  }

  const st: SearchState = { nodes: 0, cap: level.nodeCap, deadline: Date.now() + level.timeMs, aborted: false };
  let ordered = orderMoves(legal);

  // Best result from the deepest FULLY-COMPLETED iteration (never a partial one).
  let bestList: Move[] = [ordered[0]];

  for (let depth = 1; depth <= level.maxDepth; depth++) {
    let localBest = -Infinity;
    let localList: Move[] = [];
    let completed = true;

    for (const m of ordered) {
      game.move(m);
      // Full window per root move so we collect all near-equal best moves.
      const score = -negamax(game, depth - 1, -Infinity, Infinity, st);
      game.undo();
      if (st.aborted) {
        completed = false;
        break;
      }
      if (score > localBest + 8) {
        localBest = score;
        localList = [m];
      } else if (score >= localBest - 8) {
        if (score > localBest) localBest = score;
        localList.push(m);
      }
    }

    if (completed && localList.length) {
      bestList = localList;
      // Search the previous-best move first next iteration for better pruning.
      ordered = [...localList, ...ordered.filter((m) => !localList.includes(m))];
    } else {
      break; // ran out of budget mid-depth — keep the last completed depth's result
    }
  }

  return pick(bestList[Math.floor(Math.random() * bestList.length)]);
}

function pick(m: Move): { from: string; to: string; promotion?: string } {
  return { from: m.from, to: m.to, promotion: m.promotion };
}

export interface ScoredMove {
  uci: string; // e.g. "e2e4", "e7e8q"
  score: number; // centipawns from the side-to-move's perspective (mate ≈ ±MATE)
}

/**
 * Score every legal move in a position to a fixed depth. Used by post-game
 * analysis: the best move is the max score, and a played move's "centipawn loss"
 * is bestScore − thatMove'sScore. One search covers both, so analysing a whole
 * game is one search per ply.
 */
export function analyzeMoves(
  fen: string,
  opts: { depth: number; nodeCap: number; timeMs: number }
): ScoredMove[] {
  const game = new Chess(fen);
  const legal = game.moves({ verbose: true }) as Move[];
  if (legal.length === 0) return [];

  const st: SearchState = { nodes: 0, cap: opts.nodeCap, deadline: Date.now() + opts.timeMs, aborted: false };
  const out: ScoredMove[] = [];
  for (const m of orderMoves(legal)) {
    game.move(m);
    const score = -negamax(game, opts.depth - 1, -Infinity, Infinity, st);
    game.undo();
    out.push({ uci: m.from + m.to + (m.promotion || ''), score });
  }
  return out;
}

export { MATE };
