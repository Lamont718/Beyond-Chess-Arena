import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { serializeGame } from '@/lib/serialize';
import { finalizeGame } from '@/lib/game-logic';

export const dynamic = 'force-dynamic';

const schema = z.object({ action: z.enum(['offer', 'accept', 'decline']) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  if (game.status !== 'active') return NextResponse.json({ error: 'Game is over' }, { status: 409 });

  const myColor = game.whiteId === me.id ? 'w' : game.blackId === me.id ? 'b' : null;
  if (!myColor) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { action } = parsed.data;

  if (action === 'offer') {
    await prisma.game.update({ where: { id: game.id }, data: { drawOfferBy: me.id } });
  } else if (action === 'decline') {
    await prisma.game.update({ where: { id: game.id }, data: { drawOfferBy: null } });
  } else if (action === 'accept') {
    // Only valid if the OTHER player has an outstanding offer.
    if (!game.drawOfferBy || game.drawOfferBy === me.id) {
      return NextResponse.json({ error: 'No draw to accept.' }, { status: 409 });
    }
    await finalizeGame(game.id, { result: 'draw', reason: 'draw-agreement' });
  }

  const after = await prisma.game.findUnique({
    where: { id: game.id },
    include: { white: true, black: true },
  });
  return NextResponse.json({ game: serializeGame(after, me.id) });
}
