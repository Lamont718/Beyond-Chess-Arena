import 'server-only';
import { prisma } from './prisma';
import { assignColors } from './game-logic';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Pair my open quick-play seek with another waiting seek on the same time
 * control + rated flag, if one exists. Returns the new game id, or null if
 * there was nothing to match.
 *
 * Why this exists: the old flow only matched at the instant a seek was POSTed —
 * if two kids hit "Find an opponent" within the same moment (everyone requeuing
 * after a game), both checked, found nobody waiting, and each posted an open
 * seek. Nothing ever paired two *existing* open seeks, so they both spun
 * forever. This is called both when a seek is posted AND on every lobby poll,
 * so any dangling pair gets matched within a few seconds.
 *
 * Concurrency: two pollers (one per player) can call this simultaneously. We
 * claim both seeks with guarded updateMany (status:'open' → 'accepted') in a
 * deterministic id order so the two transactions can't deadlock, and whichever
 * loses a claim rolls back and bails. The winner creates the game and stamps
 * gameId on both seeks inside the same transaction, so a crash can't leave a
 * seek "accepted" with no game.
 */
export async function tryMatchOpenSeek(meId: string): Promise<string | null> {
  const mine = await prisma.challenge.findFirst({
    where: { fromId: meId, toId: null, status: 'open', gameId: null },
    orderBy: { createdAt: 'asc' },
  });
  if (!mine) return null;

  const other = await prisma.challenge.findFirst({
    where: {
      status: 'open',
      toId: null,
      gameId: null,
      fromId: { not: meId },
      timeControlSec: mine.timeControlSec,
      incrementSec: mine.incrementSec,
      rated: mine.rated,
    },
    orderBy: { createdAt: 'asc' }, // oldest waiting opponent first (FIFO fairness)
  });
  if (!other) return null;

  // Always lock the lower id first so concurrent A↔B pairings can't deadlock.
  const [firstId, secondId] = [mine.id, other.id].sort();

  try {
    return await prisma.$transaction(async (tx) => {
      const a = await tx.challenge.updateMany({
        where: { id: firstId, status: 'open', gameId: null },
        data: { status: 'accepted' },
      });
      if (a.count === 0) return null; // someone grabbed it first

      const b = await tx.challenge.updateMany({
        where: { id: secondId, status: 'open', gameId: null },
        data: { status: 'accepted' },
      });
      if (b.count === 0) {
        // Couldn't claim the partner — release our first claim and bail.
        await tx.challenge.update({ where: { id: firstId }, data: { status: 'open' } });
        return null;
      }

      const { whiteId, blackId } = assignColors(meId, other.fromId);
      const game = await tx.game.create({
        data: {
          whiteId,
          blackId,
          fen: START_FEN,
          movesJson: '[]',
          turn: 'w',
          status: 'active',
          timeControlSec: mine.timeControlSec,
          incrementSec: mine.incrementSec,
          whiteMs: mine.timeControlSec > 0 ? mine.timeControlSec * 1000 : null,
          blackMs: mine.timeControlSec > 0 ? mine.timeControlSec * 1000 : null,
          lastMoveAt: new Date(),
          rated: mine.rated,
        },
      });

      await tx.challenge.updateMany({
        where: { id: { in: [firstId, secondId] } },
        data: { gameId: game.id },
      });

      return game.id;
    });
  } catch {
    // Lost a race / transient DB conflict — the next poll retries.
    return null;
  }
}
