import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const schema = z.object({
  toUserId: z.string().min(1),
  seconds: z.number().int().min(0).max(7200),
  increment: z.number().int().min(0).max(60),
  rated: z.boolean().optional().default(true),
});

// Challenge a specific player by id.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const { toUserId, seconds, increment, rated } = parsed.data;

  if (toUserId === me.id)
    return NextResponse.json({ error: "You can't challenge yourself." }, { status: 400 });

  const opponent = await prisma.user.findUnique({ where: { id: toUserId } });
  if (!opponent) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

  // Avoid stacking duplicate pending challenges to the same player.
  const existing = await prisma.challenge.findFirst({
    where: { fromId: me.id, toId: toUserId, status: 'open' },
  });
  if (existing) {
    await prisma.challenge.update({
      where: { id: existing.id },
      data: { timeControlSec: seconds, incrementSec: increment, rated, createdAt: new Date() },
    });
    return NextResponse.json({ ok: true, id: existing.id });
  }

  const challenge = await prisma.challenge.create({
    data: { fromId: me.id, toId: toUserId, timeControlSec: seconds, incrementSec: increment, rated },
  });
  return NextResponse.json({ ok: true, id: challenge.id });
}
