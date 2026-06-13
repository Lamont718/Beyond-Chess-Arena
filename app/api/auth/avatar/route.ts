import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { isValidAvatar } from '@/lib/avatars';

export const dynamic = 'force-dynamic';

const schema = z.object({ emoji: z.string() });

// Any logged-in user can change their own avatar.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isValidAvatar(parsed.data.emoji)) {
    return NextResponse.json({ error: 'Pick an avatar from the list.' }, { status: 400 });
  }

  await prisma.user.update({ where: { id: me.id }, data: { emoji: parsed.data.emoji } });
  return NextResponse.json({ ok: true, emoji: parsed.data.emoji });
}
