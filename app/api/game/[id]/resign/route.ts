import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { serializeGame } from '@/lib/serialize';
import { finalizeGame, type GameResult } from '@/lib/game-logic';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  if (game.status !== 'active') return NextResponse.json({ error: 'Game is over' }, { status: 409 });

  const myColor = game.whiteId === me.id ? 'w' : game.blackId === me.id ? 'b' : null;
  if (!myColor) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const result: GameResult = myColor === 'w' ? 'black_wins' : 'white_wins';
  const winnerId = myColor === 'w' ? game.blackId : game.whiteId;
  await finalizeGame(game.id, { result, reason: 'resignation', winnerId });

  const after = await prisma.game.findUnique({
    where: { id: game.id },
    include: { white: true, black: true },
  });
  return NextResponse.json({ game: serializeGame(after, me.id) });
}
