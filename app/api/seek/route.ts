import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { tryMatchOpenSeek } from '@/lib/matchmaking';

export const dynamic = 'force-dynamic';

const schema = z.object({
  seconds: z.number().int().min(0).max(7200),
  increment: z.number().int().min(0).max(60),
  rated: z.boolean().optional().default(true),
});

// Quick-play: post (or refresh) my open seek, then try to pair with a waiting
// opponent on the same time control + rated flag. If two seekers race here, the
// pairing is atomic (see tryMatchOpenSeek) and the loser stays queued — the
// lobby poll re-runs the match, so nobody hangs forever waiting.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const { seconds, increment, rated } = parsed.data;

  // Replace any prior open seek with a fresh one for this time control.
  await prisma.challenge.updateMany({
    where: { fromId: me.id, status: 'open', toId: null },
    data: { status: 'cancelled' },
  });
  await prisma.challenge.create({
    data: { fromId: me.id, toId: null, timeControlSec: seconds, incrementSec: increment, rated },
  });

  const gameId = await tryMatchOpenSeek(me.id);
  if (gameId) return NextResponse.json({ gameId });
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
