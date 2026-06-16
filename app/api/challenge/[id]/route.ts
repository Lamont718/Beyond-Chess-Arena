import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { createGame, assignColors } from '@/lib/game-logic';

export const dynamic = 'force-dynamic';

const schema = z.object({ action: z.enum(['accept', 'decline', 'cancel']) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const challenge = await prisma.challenge.findUnique({ where: { id: params.id } });
  if (!challenge || challenge.status !== 'open')
    return NextResponse.json({ error: 'Challenge no longer available.' }, { status: 410 });

  const { action } = parsed.data;

  if (action === 'cancel') {
    if (challenge.fromId !== me.id)
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    await prisma.challenge.update({ where: { id: challenge.id }, data: { status: 'cancelled' } });
    return NextResponse.json({ ok: true });
  }

  // accept / decline must come from the recipient.
  if (challenge.toId !== me.id)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  if (action === 'decline') {
    await prisma.challenge.update({ where: { id: challenge.id }, data: { status: 'declined' } });
    return NextResponse.json({ ok: true });
  }

  // accept → spin up a game.
  const { whiteId, blackId } = assignColors(challenge.fromId, me.id);
  const game = await createGame(whiteId, blackId, challenge.timeControlSec, challenge.incrementSec, { rated: challenge.rated });
  await prisma.challenge.update({
    where: { id: challenge.id },
    data: { status: 'accepted', gameId: game.id },
  });
  return NextResponse.json({ ok: true, gameId: game.id });
}
