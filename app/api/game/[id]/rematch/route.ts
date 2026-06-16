import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { createGame } from '@/lib/game-logic';

export const dynamic = 'force-dynamic';

// Offer or accept a rematch on a finished game. Colors swap.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  if (game.status === 'active')
    return NextResponse.json({ error: 'Game is still in progress' }, { status: 409 });

  const isPlayer = game.whiteId === me.id || game.blackId === me.id;
  if (!isPlayer) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Already created? Send everyone to the new game.
  if (game.rematchGameId) return NextResponse.json({ gameId: game.rematchGameId });

  // The opponent already offered → accept and create the new game (colors swapped).
  if (game.rematchOfferBy && game.rematchOfferBy !== me.id) {
    const newGame = await createGame(game.blackId, game.whiteId, game.timeControlSec, game.incrementSec, { rated: game.rated });
    // Atomically attach: only the first accept to land wins. If we lose the race
    // (rematchGameId already set), discard our just-created game and use the winner's.
    const attached = await prisma.game.updateMany({
      where: { id: game.id, rematchGameId: null },
      data: { rematchGameId: newGame.id },
    });
    if (attached.count === 0) {
      await prisma.game.delete({ where: { id: newGame.id } }).catch(() => {});
      const fresh = await prisma.game.findUnique({ where: { id: game.id }, select: { rematchGameId: true } });
      return NextResponse.json({ gameId: fresh?.rematchGameId ?? newGame.id });
    }
    return NextResponse.json({ gameId: newGame.id });
  }

  // Otherwise record my offer and wait.
  await prisma.game.update({ where: { id: game.id }, data: { rematchOfferBy: me.id } });
  return NextResponse.json({ offered: true });
}
