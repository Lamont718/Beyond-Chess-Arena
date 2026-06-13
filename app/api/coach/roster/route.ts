import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const schema = z.object({
  username: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, - and _ only.'),
  displayName: z.string().min(1).max(40),
  password: z.string().min(4).max(72),
  emoji: z.string().max(8).optional(),
  role: z.enum(['KID', 'COACH']).optional(),
});

// Create a player (coach only).
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (me.role !== 'COACH') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'bad request' }, { status: 400 });
  }
  const username = parsed.data.username.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return NextResponse.json({ error: 'That username is taken.' }, { status: 409 });

  const user = await prisma.user.create({
    data: {
      username,
      displayName: parsed.data.displayName.trim(),
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      emoji: parsed.data.emoji || '♟️',
      role: parsed.data.role ?? 'KID',
    },
  });

  return NextResponse.json({ ok: true, id: user.id, username: user.username });
}
