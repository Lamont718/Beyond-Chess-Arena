import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const scopeRe = /^(global|game:[a-zA-Z0-9_-]+)$/;

function validScope(s: string | null): string | null {
  if (!s) return null;
  return scopeRe.test(s) ? s : null;
}

// GET /api/chat?scope=global  → last 50 messages for that scope.
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const scope = validScope(new URL(req.url).searchParams.get('scope'));
  if (!scope) return NextResponse.json({ error: 'bad scope' }, { status: 400 });

  const rows = await prisma.chatMessage.findMany({
    where: { scope },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: true },
  });

  const messages = rows.reverse().map((m) => ({
    id: m.id,
    text: m.text,
    createdAt: m.createdAt,
    user: {
      id: m.user.id,
      username: m.user.username,
      displayName: m.user.displayName,
      emoji: m.user.emoji,
      role: m.user.role,
    },
    mine: m.userId === me.id,
  }));

  return NextResponse.json({ messages, canModerate: me.role === 'COACH' });
}

const postSchema = z.object({
  scope: z.string().refine((s) => scopeRe.test(s), 'bad scope'),
  text: z.string().trim().min(1).max(300),
});

// POST /api/chat  { scope, text }
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Message must be 1–300 characters.' }, { status: 400 });

  await prisma.chatMessage.create({
    data: { scope: parsed.data.scope, text: parsed.data.text, userId: me.id },
  });
  return NextResponse.json({ ok: true });
}
