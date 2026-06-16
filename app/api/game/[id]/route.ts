import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { serializeGame } from '@/lib/serialize';
import { flaggedSide } from '@/lib/clock';
import { finalizeGame } from '@/lib/game-logic';
import { maybeBotReply } from '@/lib/bot-move';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let game = await prisma.game.findUnique({
    where: { id: params.id },
    include: { white: true, black: true },
  });
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  // Lazily flag a time-out the moment anyone reads the game after the clock hits zero.
  const flagged = flaggedSide(game);
  if (flagged) {
    const result = flagged === 'w' ? 'black_wins' : 'white_wins';
    const winnerId = flagged === 'w' ? game.blackId : game.whiteId;
    await finalizeGame(game.id, { result, reason: 'timeout', winnerId });
    game = await prisma.game.findUnique({
      where: { id: params.id },
      include: { white: true, black: true },
    });
  }

  // If it's a bot's turn (e.g. the bot has White and must open, or a reply was
  // missed), generate its move before responding so the kid never waits on it.
  if (game && game.status === 'active') {
    const toMove = game.turn === 'w' ? game.white : game.black;
    if (toMove?.role === 'BOT') {
      await maybeBotReply(game.id);
      game = await prisma.game.findUnique({
        where: { id: params.id },
        include: { white: true, black: true },
      });
    }
  }

  return NextResponse.json({ game: serializeGame(game, me.id) });
}
