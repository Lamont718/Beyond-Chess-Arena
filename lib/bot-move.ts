import 'server-only';
import { prisma } from './prisma';
import { bestMove } from './engine';
import { ENGINE_LEVELS } from './engine-levels';
import { botByUsername } from './bots';
import { applyMove } from './game-logic';

// Cap the server-side think time so a bot reply never makes the move request
// drag (and to keep serverless CPU cheap). Still plenty strong for a kids' club.
const MAX_BOT_MS = 1200;
const MAX_BOT_NODES = 600_000;

/**
 * If it's a bot's turn in an active game, generate and apply its reply.
 * No-op when it's a human's turn (or the game is over). Safe to call on every
 * move and every game poll — the move write is optimistically locked, so a
 * double-trigger from two concurrent polls can't double-move.
 */
export async function maybeBotReply(gameId: string): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { white: true, black: true },
  });
  if (!game || game.status !== 'active') return;

  const toMove = game.turn === 'w' ? game.white : game.black;
  const bot = botByUsername(toMove.username);
  if (toMove.role !== 'BOT' || !bot) return; // human's turn — nothing to do

  const base = ENGINE_LEVELS.find((l) => l.key === bot.level) ?? ENGINE_LEVELS[0];
  const level = { ...base, timeMs: Math.min(base.timeMs, MAX_BOT_MS), nodeCap: Math.min(base.nodeCap, MAX_BOT_NODES) };

  const mv = bestMove(game.fen, level);
  if (!mv) return; // no legal move (position is terminal — a poll will finalize)

  await applyMove(game, game.turn as 'w' | 'b', toMove.id, mv);
}
