import 'server-only';
import { prisma } from './prisma';
import { applyElo } from './elo';

export type GameResult = 'white_wins' | 'black_wins' | 'draw';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Create a fresh active game. Colors are decided by the caller. */
export async function createGame(
  whiteId: string,
  blackId: string,
  seconds: number,
  increment: number,
  tournamentId?: string
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
      tournamentId: tournamentId ?? null,
    },
  });
}

/** Pick a random color assignment for two players. */
export function assignColors(a: string, b: string): { whiteId: string; blackId: string } {
  return Math.random() < 0.5 ? { whiteId: a, blackId: b } : { whiteId: b, blackId: a };
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

    const whiteScore = opts.result === 'white_wins' ? 1 : opts.result === 'black_wins' ? 0 : 0.5;
    const { newWhite, newBlack } = applyElo(white.rating, black.rating, whiteScore);

    await tx.game.update({
      where: { id: gameId },
      data: {
        status: 'completed',
        result: opts.result,
        reason: opts.reason,
        winnerId: opts.winnerId ?? null,
        endedAt: new Date(),
        drawOfferBy: null,
        whiteRatingBefore: white.rating,
        blackRatingBefore: black.rating,
        whiteRatingAfter: newWhite,
        blackRatingAfter: newBlack,
      },
    });

    await tx.user.update({
      where: { id: white.id },
      data: {
        rating: newWhite,
        wins: white.wins + (opts.result === 'white_wins' ? 1 : 0),
        losses: white.losses + (opts.result === 'black_wins' ? 1 : 0),
        draws: white.draws + (opts.result === 'draw' ? 1 : 0),
      },
    });
    await tx.user.update({
      where: { id: black.id },
      data: {
        rating: newBlack,
        wins: black.wins + (opts.result === 'black_wins' ? 1 : 0),
        losses: black.losses + (opts.result === 'white_wins' ? 1 : 0),
        draws: black.draws + (opts.result === 'draw' ? 1 : 0),
      },
    });

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
