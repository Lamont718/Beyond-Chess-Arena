import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().min(1),
  password: z.string().min(6).max(72),
});

// Reset a player's password (coach only).
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (me.role !== 'COACH') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) },
  });
  return NextResponse.json({ ok: true });
}
