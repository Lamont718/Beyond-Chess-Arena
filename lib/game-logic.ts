import 'server-only';
import { Chess } from 'chess.js';
import { prisma } from './prisma';
import { applyElo } from './elo';
import { XP_AWARDS } from './levels';
import { flaggedSide } from './clock';

export type GameResult = 'white_wins' | 'black_wins' | 'draw';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Create a fresh active game. Colors are decided by the caller. */
export async function createGame(
  whiteId: string,
  blackId: string,
  seconds: number,
  increment: number,
  opts: { tournamentId?: string; rated?: boolean } = {}
) {
  return prisma.game.create({
    data: {
      whiteId,
      blackId,
      fen: START_FEN,
      movesJson: '[]',
      turn: 'w',
      status: 'active',
      timeControlSec: seconds,
      incrementSec: increment,
      whiteMs: seconds > 0 ? seconds * 1000 : null,
      blackMs: seconds > 0 ? seconds * 1000 : null,
      lastMoveAt: new Date(),
      rated: opts.rated ?? true,
      tournamentId: opts.tournamentId ?? null,
    },
  });
}

/** Pick a random color assignment for two players. */
export function assignColors(a: string, b: string): { whiteId: string; blackId: string } {
  return Math.random() < 0.5 ? { whiteId: a, blackId: b } : { whiteId: b, blackId: a };
}

export interface MoveInput {
  from: string;
  to: string;
  promotion?: string;
}
export type ApplyMoveResult =
  | { status: 'ok' }
  | { status: 'illegal' }
  | { status: 'conflict' } // position changed under us (double-submit / race)
  | { status: 'flagged' }; // a clock had already run out — finalized as a timeout

/**
 * Apply one move by `mover` to an active game and persist it. Shared by the
 * human move route and the server-side bot. Assumes the CALLER already verified
 * it is `moverColor`'s turn and that mover is a player. Handles: a clock that
 * already flagged, legality, clock deduction + increment, an optimistic-locked
 * write (so a concurrent move / double-submit can't corrupt the board), and
 * finalizing terminal positions.
 */
export async function applyMove(
  game: {
    id: string;
    status: string;
    fen: string;
    movesJson: string;
    turn: string;
    timeControlSec: number;
    incrementSec: number;
    whiteMs: number | null;
    blackMs: number | null;
    lastMoveAt: Date;
    whiteId: string;
    blackId: string;
  },
  moverColor: 'w' | 'b',
  moverId: string,
  input: MoveInput
): Promise<ApplyMoveResult> {
  // Did the clock run out before this move landed?
  const flagged = flaggedSide(game);
  if (flagged) {
    const result: GameResult = flagged === 'w' ? 'black_wins' : 'white_wins';
    const winnerId = flagged === 'w' ? game.blackId : game.whiteId;
    await finalizeGame(game.id, { result, reason: 'timeout', winnerId });
    return { status: 'flagged' };
  }

  // Validate + apply authoritatively on the server.
  const chess = new Chess(game.fen);
  try {
    const move = chess.move({ from: input.from, to: input.to, promotion: (input.promotion as any) || 'q' });
    if (!move) throw new Error('illegal');
  } catch {
    return { status: 'illegal' };
  }

  const now = Date.now();
  let whiteMs = game.whiteMs;
  let blackMs = game.blackMs;
  if (game.timeControlSec > 0 && whiteMs != null && blackMs != null) {
    const elapsed = now - new Date(game.lastMoveAt).getTime();
    if (moverColor === 'w') whiteMs = Math.max(0, whiteMs - elapsed) + game.incrementSec * 1000;
    else blackMs = Math.max(0, blackMs - elapsed) + game.incrementSec * 1000;
  }

  const moves: string[] = safeParseMoves(game.movesJson);
  moves.push(chess.history().slice(-1)[0] ?? '');

  // Optimistic lock: only apply if the position is still exactly what we
  // validated against. A concurrent move / double-submit matches 0 rows.
  const applied = await prisma.game.updateMany({
    where: { id: game.id, status: 'active', turn: moverColor, fen: game.fen },
    data: {
      fen: chess.fen(),
      movesJson: JSON.stringify(moves),
      turn: chess.turn(),
      whiteMs,
      blackMs,
      lastMoveAt: new Date(now),
      drawOfferBy: null, // making a move declines any pending draw offer
    },
  });
  if (applied.count === 0) return { status: 'conflict' };

  if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      const result: GameResult = moverColor === 'w' ? 'white_wins' : 'black_wins';
      await finalizeGame(game.id, { result, reason: 'checkmate', winnerId: moverId });
    } else {
      const reason = chess.isStalemate()
        ? 'stalemate'
        : chess.isInsufficientMaterial()
          ? 'insufficient-material'
          : chess.isThreefoldRepetition()
            ? 'threefold-repetition'
            : 'fifty-move-rule';
      await finalizeGame(game.id, { result: 'draw', reason });
    }
  }

  return { status: 'ok' };
}

function safeParseMoves(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Finalize a game exactly once: set status/result/reason, stamp endedAt, apply Elo,
 * and update both players' win/loss/draw records. Idempotent — if the game is no
 * longer active (already finalized by a concurrent poll), it's a no-op.
 */
export async function finalizeGame(
  gameId: string,
  opts: { result: GameResult; reason: string; winnerId?: string | null }
) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game || game.status !== 'active') return game;

    const white = await tx.user.findUnique({ where: { id: game.whiteId } });
    const black = await tx.user.findUnique({ where: { id: game.blackId } });
    if (!white || !black) return game;

    // Casual games close out and award XP, but never move Elo or the W/L/D record.
    const rated = game.rated;
    const whiteScore = opts.result === 'white_wins' ? 1 : opts.result === 'black_wins' ? 0 : 0.5;
    const { newWhite, newBlack } = rated
      ? applyElo(white.rating, black.rating, whiteScore)
      : { newWhite: white.rating, newBlack: black.rating };

    await tx.game.update({
      where: { id: gameId },
      data: {
        status: 'completed',
        result: opts.result,
        reason: opts.reason,
        winnerId: opts.winnerId ?? null,
        endedAt: new Date(),
        drawOfferBy: null,
        // Rating snapshots only on rated games — left null marks a Casual game.
        whiteRatingBefore: rated ? white.rating : null,
        blackRatingBefore: rated ? black.rating : null,
        whiteRatingAfter: rated ? newWhite : null,
        blackRatingAfter: rated ? newBlack : null,
      },
    });

    const whiteXp = opts.result === 'white_wins' ? XP_AWARDS.win : opts.result === 'draw' ? XP_AWARDS.draw : XP_AWARDS.loss;
    const blackXp = opts.result === 'black_wins' ? XP_AWARDS.win : opts.result === 'draw' ? XP_AWARDS.draw : XP_AWARDS.loss;

    // Bots are a FIXED rating anchor: never move their rating / record / XP.
    // (Elo above still uses the bot's fixed rating to compute the human's delta.)
    if (white.role !== 'BOT') {
      await tx.user.update({
        where: { id: white.id },
        data: {
          xp: { increment: whiteXp },
          ...(rated && {
            rating: newWhite,
            wins: white.wins + (opts.result === 'white_wins' ? 1 : 0),
            losses: white.losses + (opts.result === 'black_wins' ? 1 : 0),
            draws: white.draws + (opts.result === 'draw' ? 1 : 0),
          }),
        },
      });
    }
    if (black.role !== 'BOT') {
      await tx.user.update({
        where: { id: black.id },
        data: {
          xp: { increment: blackXp },
          ...(rated && {
            rating: newBlack,
            wins: black.wins + (opts.result === 'black_wins' ? 1 : 0),
            losses: black.losses + (opts.result === 'white_wins' ? 1 : 0),
            draws: black.draws + (opts.result === 'draw' ? 1 : 0),
          }),
        },
      });
    }

    // Tournament scoring: if this game belongs to a tournament, update both
    // players' standings (win = 1, draw = 0.5) and auto-complete the tournament
    // once its last game finishes.
    if (game.tournamentId) {
      const whitePts = opts.result === 'white_wins' ? 1 : opts.result === 'draw' ? 0.5 : 0;
      const blackPts = opts.result === 'black_wins' ? 1 : opts.result === 'draw' ? 0.5 : 0;

      await tx.tournamentPlayer.updateMany({
        where: { tournamentId: game.tournamentId, userId: white.id },
        data: {
          points: { increment: whitePts },
          wins: { increment: opts.result === 'white_wins' ? 1 : 0 },
          draws: { increment: opts.result === 'draw' ? 1 : 0 },
          losses: { increment: opts.result === 'black_wins' ? 1 : 0 },
        },
      });
      await tx.tournamentPlayer.updateMany({
        where: { tournamentId: game.tournamentId, userId: black.id },
        data: {
          points: { increment: blackPts },
          wins: { increment: opts.result === 'black_wins' ? 1 : 0 },
          draws: { increment: opts.result === 'draw' ? 1 : 0 },
          losses: { increment: opts.result === 'white_wins' ? 1 : 0 },
        },
      });

      const remaining = await tx.game.count({
        where: { tournamentId: game.tournamentId, status: 'active' },
      });
      if (remaining === 0) {
        await tx.tournament.updateMany({
          where: { id: game.tournamentId, status: 'active' },
          data: { status: 'completed', endedAt: new Date() },
        });
      }
    }

    return tx.game.findUnique({ where: { id: gameId } });
  });
}
