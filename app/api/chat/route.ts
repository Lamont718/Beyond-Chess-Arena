import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { moderateMessage } from '@/lib/profanity';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const scopeRe = /^(global|game:[a-zA-Z0-9_-]+)$/;

function validScope(s: string | null): string | null {
  if (!s) return null;
  return scopeRe.test(s) ? s : null;
}

/**
 * Authorization for a chat scope. `global` is open to all logged-in members;
 * a `game:<id>` scope is restricted to that game's two players (and coaches,
 * for moderation/spectating). Prevents reading or posting in strangers' games.
 */
async function canAccessScope(scope: string, me: { id: string; role: string }): Promise<boolean> {
  if (scope === 'global') return true;
  if (me.role === 'COACH') return true;
  const gameId = scope.slice('game:'.length);
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { whiteId: true, blackId: true },
  });
  if (!game) return false;
  return game.whiteId === me.id || game.blackId === me.id;
}

// GET /api/chat?scope=global  → last 50 messages for that scope.
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const scope = validScope(new URL(req.url).searchParams.get('scope'));
  if (!scope) return NextResponse.json({ error: 'bad scope' }, { status: 400 });

  if (!(await canAccessScope(scope, me))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const isCoach = me.role === 'COACH';
  const rows = await prisma.chatMessage.findMany({
    // Hidden messages stay visible to coaches (audit) but disappear for kids.
    where: isCoach ? { scope } : { scope, hiddenAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: true },
  });

  const messages = rows.reverse().map((m) => ({
    id: m.id,
    text: m.text,
    createdAt: m.createdAt,
    hidden: m.hiddenAt != null,
    reportCount: m.reportCount,
    user: {
      id: m.user.id,
      username: m.user.username,
      displayName: m.user.displayName,
      emoji: m.user.emoji,
      role: m.user.role,
    },
    mine: m.userId === me.id,
  }));

  return NextResponse.json({ messages, canModerate: isCoach });
}

const postSchema = z.object({
  scope: z.string().refine((s) => scopeRe.test(s), 'bad scope'),
  text: z.string().trim().min(1).max(300),
});

// POST /api/chat  { scope, text }
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Anti-flood: ~1 message / 1.2s, burst of 5 per 10s, per user.
  const burst = rateLimit(`chat:burst:${me.id}`, 5, 10_000);
  if (!burst.ok) {
    return NextResponse.json(
      { error: "You're sending messages too fast — take a breath! 🙂" },
      { status: 429, headers: { 'Retry-After': String(burst.retryAfterSec) } }
    );
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Message must be 1–300 characters.' }, { status: 400 });

  if (!(await canAccessScope(parsed.data.scope, me))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Block contact-info sharing + profanity outright (kid-safety), with a friendly reason.
  const verdict = moderateMessage(parsed.data.text);
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason }, { status: 400 });
  }

  await prisma.chatMessage.create({
    data: { scope: parsed.data.scope, text: verdict.clean, userId: me.id },
  });
  return NextResponse.json({ ok: true });
}
