import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { createGame, assignColors } from '@/lib/game-logic';

export const dynamic = 'force-dynamic';

const schema = z.object({
  seconds: z.number().int().min(0).max(7200),
  increment: z.number().int().min(0).max(60),
});

// Quick-play: pair with a waiting opponent on the same time control, or post a seek.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const { seconds, increment } = parsed.data;

  // Is someone already waiting on this exact time control?
  const waiting = await prisma.challenge.findFirst({
    where: {
      status: 'open',
      toId: null,
      fromId: { not: me.id },
      timeControlSec: seconds,
      incrementSec: increment,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (waiting) {
    const { whiteId, blackId } = assignColors(me.id, waiting.fromId);
    const game = await createGame(whiteId, blackId, seconds, increment);
    await prisma.challenge.update({
      where: { id: waiting.id },
      data: { status: 'accepted', gameId: game.id },
    });
    // Clear my own dangling seeks.
    await prisma.challenge.updateMany({
      where: { fromId: me.id, status: 'open', toId: null },
      data: { status: 'cancelled' },
    });
    return NextResponse.json({ gameId: game.id });
  }

  // No match — post (or keep) my open seek, replacing any prior one.
  await prisma.challenge.updateMany({
    where: { fromId: me.id, status: 'open', toId: null },
    data: { status: 'cancelled' },
  });
  await prisma.challenge.create({
    data: { fromId: me.id, toId: null, timeControlSec: seconds, incrementSec: increment },
  });
  return NextResponse.json({ seeking: true });
}

// Cancel my open seeks.
export async function DELETE() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await prisma.challenge.updateMany({
    where: { fromId: me.id, status: 'open', toId: null },
    data: { status: 'cancelled' },
  });
  return NextResponse.json({ ok: true });
}
